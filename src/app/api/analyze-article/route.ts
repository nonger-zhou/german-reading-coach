import { NextResponse } from "next/server";
import {
  createServerOpenAIClient,
  formatOpenAIRouteErrorMessage,
} from "@/lib/openai/createServerOpenAIClient";
import {
  ARTICLE_ANALYSIS_JSON_SCHEMA_LEGACY,
} from "@/lib/articleAnalysis/articleAnalysisJsonSchema";
import { ARTICLE_VOCAB_FIRST_JSON_SCHEMA } from "@/lib/articleAnalysis/articleAnalysisVocabFirstJsonSchema";
import { isLegacyAutoGrammarAnalysisEnabled } from "@/lib/articleAnalysis/articleAnalysisFeatureFlags";
import { filterArticleAnalysisGrammarByArticleText } from "@/lib/articleAnalysis/filterAnalysisByArticleText";
import { listRealAiEntriesWithoutTextMatch } from "@/lib/articleAnalysis/convertAnalysisToArticleItems";
import {
  filterArticleAnalysisGrammarByBlockedSet,
  formatGrammarLibraryBlockPromptFromRows,
} from "@/lib/articleAnalysis/filterGrammarByUserLibrary";
import { formatVocabLibraryBlockPromptFromRows } from "@/lib/articleAnalysis/filterVocabularyByUserLibrary";
import {
  buildOpenAIAnalysisUserContent,
  normalizeOpenAIArticleAnalysis,
  normalizeOpenAIVocabFirstArticleAnalysis,
  SYSTEM_PROMPT_LEGACY,
  SYSTEM_PROMPT_VOCAB_FIRST,
  OPENAI_ANALYSIS_TEXT_CHAR_LIMIT,
} from "@/lib/articleAnalysis/openaiArticleAnalysis";
import type { ArticleAnalysisResult } from "@/lib/articleAnalysis/types";
import { getSupabaseUserFromBearer } from "@/lib/supabase/routeFromBearer";
import { resolveArticleLanguage } from "@/lib/supabase/articles";
import { fetchGrammarMasteredIgnoredKeysForArticleAnalysis } from "@/lib/supabase/grammar";
import { fetchVocabularyProfileRowsForArticleAnalysis } from "@/lib/supabase/vocabulary";
import { buildUserVocabProfile } from "@/lib/vocabSelection/userVocabProfile";
import {
  applyVocabularySelection,
  mergeVocabularyLists,
  planVocabularySelection,
} from "@/lib/vocabSelection/selectVocabulary";
import { splitArticleForAnalysis } from "@/lib/articleAnalysis/splitArticleForAnalysis";
import type { CefrLevel } from "@/lib/types";

/** 整文分析可能接近分钟级，放宽服务端限时（部署平台支持时生效） */
export const maxDuration = 180;

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

/**
 * 整文分析模型。默认 gpt-5-mini（选词质量明显好于 gpt-4o-mini，单篇约 $0.02–0.03）；
 * 可用环境变量 OPENAI_ANALYSIS_MODEL 覆盖（例如改回 gpt-4o-mini）。
 */
const ANALYSIS_MODEL =
  process.env.OPENAI_ANALYSIS_MODEL?.trim() || "gpt-5-mini";

/** 长文最多分几段分析（每段约 1 万字符；4 段 ≈ 4 万字符，单篇费用约为短文的 4 倍） */
const MAX_ANALYSIS_CHUNKS = 4;

/** gpt-5 / o 系列为推理模型：不接受 temperature，改用 reasoning_effort */
function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o\d)/i.test(model);
}

type OkBody = {
  ok: true;
  analysis: ArticleAnalysisResult;
  warning?: string;
  schemaVersion?: "vocab_first_v1" | "legacy_full_v1";
};

type ErrBody = {
  ok: false;
  error: {
    message: string;
    code?: string;
    details?: string;
  };
};

function isCefrLevel(s: unknown): s is CefrLevel {
  return typeof s === "string" && (LEVELS as string[]).includes(s);
}

export async function POST(req: Request): Promise<NextResponse<OkBody | ErrBody>> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: "OPENAI_API_KEY 未配置",
          code: "missing_api_key",
        },
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { message: "请求体不是合法 JSON", code: "invalid_json" },
      },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      {
        ok: false,
        error: { message: "请求体无效", code: "invalid_body" },
      },
      { status: 400 },
    );
  }

  const b = body as Record<string, unknown>;
  const articleId = typeof b.articleId === "string" ? b.articleId.trim() : "";
  const title = typeof b.title === "string" ? b.title : "";
  const originalText =
    typeof b.originalText === "string" ? b.originalText : "";
  const userLevel = b.userLevel;

  if (!articleId) {
    return NextResponse.json(
      {
        ok: false,
        error: { message: "缺少 articleId", code: "missing_article_id" },
      },
      { status: 400 },
    );
  }
  if (!isCefrLevel(userLevel)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: "userLevel 必须是 A1–C2 之一",
          code: "invalid_user_level",
        },
      },
      { status: 400 },
    );
  }

  const auth = await getSupabaseUserFromBearer(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: auth.message,
          code: "unauthorized",
        },
      },
      { status: auth.status },
    );
  }

  const legacy = isLegacyAutoGrammarAnalysisEnabled();

  /**
   * 文章语言以数据库为准（不信任请求体）；读不到时（如 mock 文章）用请求体，最后回落德语。
   * 词库画像、语法过滤都只取该语言，德语 / 英语互不影响。
   */
  const language = await resolveArticleLanguage(
    auth.supabase,
    auth.user.id,
    articleId,
    b.language,
  );

  const vocabRes = await fetchVocabularyProfileRowsForArticleAnalysis(
    auth.supabase,
    auth.user.id,
    language,
  );
  if (vocabRes.error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: vocabRes.error,
          code: "vocabulary_filter_fetch_failed",
        },
      },
      { status: 502 },
    );
  }

  let grammarLibraryBlockAppendix: string | undefined;
  let grammarBlockedSet = new Set<string>();

  if (legacy) {
    const grammarRes = await fetchGrammarMasteredIgnoredKeysForArticleAnalysis(
      auth.supabase,
      auth.user.id,
      language,
    );
    if (grammarRes.error) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: grammarRes.error,
            code: "grammar_filter_fetch_failed",
          },
        },
        { status: 502 },
      );
    }
    const formatted = formatGrammarLibraryBlockPromptFromRows(grammarRes.rows);
    grammarLibraryBlockAppendix = formatted.blockLines;
    grammarBlockedSet = formatted.blockedSet;
  }

  const vocabProfile = buildUserVocabProfile(userLevel, vocabRes.rows);
  const { blockLines: vocabLibraryBlockLines } =
    formatVocabLibraryBlockPromptFromRows(
      vocabRes.rows.filter(
        (r) => r.mastery_status === "mastered" || r.mastery_status === "ignored",
      ),
    );

  /** legacy（含 grammar）仍只分析第一段；默认词汇模式下长文分段并行分析 */
  const { chunks, truncated, analyzedChars } = splitArticleForAnalysis(
    originalText,
    OPENAI_ANALYSIS_TEXT_CHAR_LIMIT,
    legacy ? 1 : MAX_ANALYSIS_CHUNKS,
  );
  const textForModel = chunks[0];
  const extraChunks = chunks.slice(1);
  const warnings: string[] = [];
  if (truncated) {
    warnings.push(
      legacy
        ? "当前仅分析文章前半部分。"
        : `文章很长，只分析了前约 ${Math.round(analyzedChars / 1000)} 千字（${chunks.length} 段）。`,
    );
  } else if (extraChunks.length > 0) {
    warnings.push(`长文已分 ${chunks.length} 段分析。`);
  }

  const vocabPlan = planVocabularySelection(textForModel, vocabProfile);
  const vocabLibraryBlockAppendix = [
    vocabPlan.promptAppendix,
    vocabLibraryBlockLines,
  ]
    .filter(Boolean)
    .join("\n\n");

  const openai = createServerOpenAIClient({
    apiKey,
    timeout: 180_000,
    maxRetries: 1,
  });

  const systemPrompt = legacy ? SYSTEM_PROMPT_LEGACY : SYSTEM_PROMPT_VOCAB_FIRST;
  const jsonSchema = legacy
    ? ARTICLE_ANALYSIS_JSON_SCHEMA_LEGACY
    : ARTICLE_VOCAB_FIRST_JSON_SCHEMA;

  const requestCompletion = (text: string, vocabAppendix: string) =>
    openai.chat.completions.create({
      model: ANALYSIS_MODEL,
      ...(isReasoningModel(ANALYSIS_MODEL)
        ? { reasoning_effort: "low" as const }
        : { temperature: 0.3 }),
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: buildOpenAIAnalysisUserContent({
            title,
            originalText: text,
            userLevel,
            vocabLibraryBlockAppendix: vocabAppendix,
            grammarLibraryBlockAppendix,
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: jsonSchema,
      },
    });

  /** 后续段与第一段并行请求；单段失败只记 warning，不影响整体结果 */
  const extraChunkPromises = extraChunks.map(async (chunkText, i) => {
    const plan = planVocabularySelection(chunkText, vocabProfile);
    const appendix = [plan.promptAppendix, vocabLibraryBlockLines]
      .filter(Boolean)
      .join("\n\n");
    try {
      const res = await requestCompletion(chunkText, appendix);
      const raw = res.choices[0]?.message?.content;
      if (!raw) throw new Error("empty");
      const vocab = normalizeOpenAIVocabFirstArticleAnalysis(JSON.parse(raw)).vocabulary;
      return { ok: true as const, chunkText, plan, vocab };
    } catch (err) {
      console.warn(`[analyze-article] chunk ${i + 2} failed`, err);
      return { ok: false as const, index: i + 2 };
    }
  });

  try {
    const completion = await requestCompletion(textForModel, vocabLibraryBlockAppendix);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: "OpenAI 返回空内容",
            code: "empty_completion",
          },
        },
        { status: 502 },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: "无法解析模型返回的 JSON",
            code: "parse_error",
            details: content.slice(0, 500),
          },
        },
        { status: 502 },
      );
    }

    let analysis: ArticleAnalysisResult = legacy
      ? normalizeOpenAIArticleAnalysis(parsed)
      : normalizeOpenAIVocabFirstArticleAnalysis(parsed);

    if (legacy) {
      const {
        analysis: analysisGrammarFiltered,
        removedGrammar: grammarNotInText,
      } = filterArticleAnalysisGrammarByArticleText(analysis, textForModel);
      analysis = analysisGrammarFiltered;
      if (grammarNotInText.length > 0) {
        warnings.push(
          `已剔除 ${grammarNotInText.length} 条语法推荐（selected_text 非正文连续子串）：${grammarNotInText.slice(0, 3).join("、")}${grammarNotInText.length > 3 ? "…" : ""}`,
        );
      }

      const { grammar: graFiltered, removedCount: grammarRemoved } =
        filterArticleAnalysisGrammarByBlockedSet(
          analysis.grammar,
          grammarBlockedSet,
        );
      if (grammarRemoved > 0) {
        analysis = { ...analysis, grammar: graFiltered };
        warnings.push(
          `已按您总语法库中「已掌握 / 暂忽略」记录剔除 ${grammarRemoved} 条语法推荐（与 grammar_key + normalized_key 完全一致）。`,
        );
      }
    }

    const unmatchedVocab = listRealAiEntriesWithoutTextMatch(
      analysis,
      textForModel,
    ).vocabulary;
    if (unmatchedVocab.length > 0) {
      warnings.push(
        `有 ${unmatchedVocab.length} 条词汇推荐的 surface_form 未在正文中精确匹配，预览保存时可能无法高亮（未剔除）：${unmatchedVocab.slice(0, 3).join("、")}${unmatchedVocab.length > 3 ? "…" : ""}`,
      );
    }

    const selection = applyVocabularySelection(
      analysis.vocabulary,
      vocabPlan,
      vocabProfile,
      textForModel,
    );
    const extraResults = await Promise.all(extraChunkPromises);
    const extraLists: (typeof selection.vocabulary)[] = [];
    let extraDroppedKnown = 0;
    for (const r of extraResults) {
      if (!r.ok) {
        warnings.push(`第 ${r.index} 段分析失败，已跳过。`);
        continue;
      }
      const sel = applyVocabularySelection(r.vocab, r.plan, vocabProfile, r.chunkText);
      extraDroppedKnown += sel.droppedKnown.length;
      extraLists.push(sel.vocabulary);
    }
    analysis = {
      ...analysis,
      vocabulary: mergeVocabularyLists([selection.vocabulary, ...extraLists]),
    };
    console.info(
      `[analyze-article] vocab v2 model=${ANALYSIS_MODEL} level=${userLevel} cutoff=${vocabProfile.cutoff} (${vocabProfile.cutoffNote}) candidates=${vocabPlan.candidates.length} learningInText=${vocabPlan.learningInArticle.length} kept=${selection.vocabulary.length} droppedKnown=${selection.droppedKnown.length} droppedTooCommon=${selection.droppedTooCommon.length} droppedProperNames=${selection.droppedProperNames.length} addedLearning=${selection.addedLearning.length} chunks=${chunks.length} total=${analysis.vocabulary.length}`,
    );
    const droppedKnownTotal = selection.droppedKnown.length + extraDroppedKnown;
    if (droppedKnownTotal > 0) {
      warnings.push(
        `已按您总词库中「已掌握 / 暂忽略」记录剔除 ${droppedKnownTotal} 条词汇推荐。`,
      );
    }

    const payload: OkBody = {
      ok: true,
      analysis,
      schemaVersion: legacy ? "legacy_full_v1" : "vocab_first_v1",
    };
    if (warnings.length) {
      payload.warning = warnings.join(" ");
    }
    return NextResponse.json(payload);
  } catch (e: unknown) {
    const msg = formatOpenAIRouteErrorMessage(e);
    const status =
      msg.includes("401") || msg.toLowerCase().includes("incorrect api key")
        ? 401
        : 502;
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: msg || "OpenAI 调用失败",
          code: "openai_error",
          details:
            typeof e === "object" && e !== null && "status" in e
              ? String((e as { status?: unknown }).status)
              : undefined,
        },
      },
      { status },
    );
  }
}
