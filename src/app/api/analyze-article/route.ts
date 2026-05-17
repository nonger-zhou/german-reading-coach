import { NextResponse } from "next/server";
import {
  createServerOpenAIClient,
  formatOpenAIRouteErrorMessage,
} from "@/lib/openai/createServerOpenAIClient";
import { ARTICLE_ANALYSIS_JSON_SCHEMA } from "@/lib/articleAnalysis/articleAnalysisJsonSchema";
import { filterArticleAnalysisGrammarByArticleText } from "@/lib/articleAnalysis/filterAnalysisByArticleText";
import { listRealAiEntriesWithoutTextMatch } from "@/lib/articleAnalysis/convertAnalysisToArticleItems";
import {
  filterArticleAnalysisGrammarByBlockedSet,
  formatGrammarLibraryBlockPromptFromRows,
} from "@/lib/articleAnalysis/filterGrammarByUserLibrary";
import {
  filterArticleAnalysisVocabularyByBlockedSet,
  formatVocabLibraryBlockPromptFromRows,
} from "@/lib/articleAnalysis/filterVocabularyByUserLibrary";
import {
  buildOpenAIAnalysisUserContent,
  normalizeOpenAIArticleAnalysis,
  SYSTEM_PROMPT,
  truncateForOpenAIAnalysis,
} from "@/lib/articleAnalysis/openaiArticleAnalysis";
import type { ArticleAnalysisResult } from "@/lib/articleAnalysis/types";
import { getSupabaseUserFromBearer } from "@/lib/supabase/routeFromBearer";
import { fetchGrammarMasteredIgnoredKeysForArticleAnalysis } from "@/lib/supabase/grammar";
import { fetchVocabularyMasteredIgnoredKeysForArticleAnalysis } from "@/lib/supabase/vocabulary";
import type { CefrLevel } from "@/lib/types";

/** 整文分析可能接近分钟级，放宽服务端限时（部署平台支持时生效） */
export const maxDuration = 180;

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

type OkBody = {
  ok: true;
  analysis: ArticleAnalysisResult;
  warning?: string;
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

  const [vocabRes, grammarRes] = await Promise.all([
    fetchVocabularyMasteredIgnoredKeysForArticleAnalysis(
      auth.supabase,
      auth.user.id,
    ),
    fetchGrammarMasteredIgnoredKeysForArticleAnalysis(
      auth.supabase,
      auth.user.id,
    ),
  ]);

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

  const { blockLines: vocabLibraryBlockAppendix, blockedSet } =
    formatVocabLibraryBlockPromptFromRows(vocabRes.rows);
  const {
    blockLines: grammarLibraryBlockAppendix,
    blockedSet: grammarBlockedSet,
  } = formatGrammarLibraryBlockPromptFromRows(grammarRes.rows);

  const { text: textForModel, truncated } =
    truncateForOpenAIAnalysis(originalText);
  const warnings: string[] = [];
  if (truncated) {
    warnings.push("当前仅分析文章前半部分。");
  }

  const openai = createServerOpenAIClient({
    apiKey,
    timeout: 180_000,
    maxRetries: 1,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: buildOpenAIAnalysisUserContent({
            title,
            originalText: textForModel,
            userLevel,
            vocabLibraryBlockAppendix,
            grammarLibraryBlockAppendix,
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: ARTICLE_ANALYSIS_JSON_SCHEMA,
      },
    });

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

    let analysis = normalizeOpenAIArticleAnalysis(parsed);

    const { analysis: analysisGrammarFiltered, removedGrammar: grammarNotInText } =
      filterArticleAnalysisGrammarByArticleText(analysis, textForModel);
    analysis = analysisGrammarFiltered;
    if (grammarNotInText.length > 0) {
      warnings.push(
        `已剔除 ${grammarNotInText.length} 条语法推荐（selected_text 非正文连续子串）：${grammarNotInText.slice(0, 3).join("、")}${grammarNotInText.length > 3 ? "…" : ""}`,
      );
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

    const { vocabulary: vocFiltered, removedCount: vocabRemoved } =
      filterArticleAnalysisVocabularyByBlockedSet(
        analysis.vocabulary,
        blockedSet,
      );
    if (vocabRemoved > 0) {
      analysis = { ...analysis, vocabulary: vocFiltered };
      warnings.push(
        `已按您总词库中「已掌握 / 暂忽略」记录剔除 ${vocabRemoved} 条词汇推荐（与 normalized_key + 词性完全一致）。`,
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

    const payload: OkBody = {
      ok: true,
      analysis,
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
