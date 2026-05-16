import { NextResponse } from "next/server";
import {
  createServerOpenAIClient,
  formatOpenAIRouteErrorMessage,
} from "@/lib/openai/createServerOpenAIClient";

export const maxDuration = 120;
import { GRAMMAR_ENRICHMENT_JSON_SCHEMA } from "@/lib/articleAnalysis/enrichmentJsonSchemas";
import { GRAMMAR_ENRICH_V2_SYSTEM_SECTION } from "@/lib/articleAnalysis/grammarAnalysisV2Prompt";
import {
  parseFiniteVerbPosition,
  parseGrammarType,
  parseIsSubordinateClause,
} from "@/lib/articleAnalysis/grammarTypes";
import { snippetAroundOffsets } from "@/lib/articleAnalysis/enrichmentContext";
import { validateGrammarLabel } from "@/lib/grammar/labelValidation";
import { applyGrammarAiEnrichment } from "@/lib/supabase/grammar";
import { getSupabaseUserFromBearer } from "@/lib/supabase/routeFromBearer";
import type { CefrLevel } from "@/lib/types";

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

function isCefrLevel(s: unknown): s is CefrLevel {
  return typeof s === "string" && (LEVELS as string[]).includes(s);
}

const SYSTEM_PROMPT = `你是德语阅读教练。用户在文章中手动标记了一处语法现象，尚未有完整解释。请根据提供的标题、学习者水平、标记片段、出现句和原文短片段，输出语法说明。

${GRAMMAR_ENRICH_V2_SYSTEM_SECTION}

只输出 JSON schema 要求的字段，不要其它文字。`;

type OkBody = {
  ok: true;
  grammar_type: string;
  name_de: string;
  name_zh: string;
  is_subordinate_clause: boolean;
  finite_verb: string;
  finite_verb_position: string;
  explanation_zh: string;
  explanation_de_simple: string;
  level_estimate: CefrLevel;
  reason_for_selection: string;
  example_sentence: string;
  was_label_corrected: boolean;
  corrected_label: string;
  correction_reason: string;
  corrected_from?: string | null;
};

type ErrBody = {
  ok: false;
  error: string;
};

export async function POST(req: Request): Promise<NextResponse<OkBody | ErrBody>> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "OPENAI_API_KEY 未配置" },
      { status: 503 },
    );
  }

  const auth = await getSupabaseUserFromBearer(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.message },
      { status: auth.status },
    );
  }
  const { user, supabase } = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "请求体不是合法 JSON" },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "请求体无效" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const articleId = typeof b.articleId === "string" ? b.articleId.trim() : "";
  const grammarItemId =
    typeof b.grammarItemId === "string" ? b.grammarItemId.trim() : "";
  const userLevel = b.userLevel;

  if (!articleId || !grammarItemId) {
    return NextResponse.json(
      { ok: false, error: "缺少 articleId 或 grammarItemId" },
      { status: 400 },
    );
  }
  if (!isCefrLevel(userLevel)) {
    return NextResponse.json(
      { ok: false, error: "userLevel 必须是 A1–C2 之一" },
      { status: 400 },
    );
  }

  const { data: article, error: artErr } = await supabase
    .from("articles")
    .select("id,user_id,title,original_text")
    .eq("id", articleId)
    .maybeSingle();

  if (artErr) {
    return NextResponse.json(
      { ok: false, error: artErr.message || "无法读取文章" },
      { status: 500 },
    );
  }
  if (!article || article.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "无权访问该文章" }, { status: 403 });
  }

  const { data: grow, error: gErr } = await supabase
    .from("grammar_items")
    .select("id,user_id,source,grammar_key,normalized_key,name_de,name_zh")
    .eq("id", grammarItemId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (gErr) {
    return NextResponse.json(
      { ok: false, error: gErr.message || "无法读取语法项" },
      { status: 500 },
    );
  }
  if (!grow || grow.source !== "manual") {
    return NextResponse.json(
      { ok: false, error: "仅支持用户手动添加的语法（source=manual）。" },
      { status: 403 },
    );
  }

  const { data: occRows, error: occErr } = await supabase
    .from("grammar_occurrences")
    .select("sentence,selected_text,start_offset,end_offset")
    .eq("article_id", articleId)
    .eq("grammar_item_id", grammarItemId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (occErr) {
    return NextResponse.json(
      { ok: false, error: occErr.message || "无法读取出现记录" },
      { status: 500 },
    );
  }
  const occ0 = occRows?.[0] as
    | {
        sentence: string | null;
        selected_text: string | null;
        start_offset: number | null;
        end_offset: number | null;
      }
    | undefined;

  const originalText = String(article.original_text ?? "");
  const snippet = snippetAroundOffsets(
    originalText,
    occ0?.start_offset ?? undefined,
    occ0?.end_offset ?? undefined,
  );
  const occurrenceSentence =
    (occ0?.sentence && occ0.sentence.trim()) ||
    "（未提供出现句，请根据标记片段与上下文推断）";
  const selectedText =
    (occ0?.selected_text && occ0.selected_text.trim()) ||
    String(grow.name_de ?? "");

  const userPayload = {
    article_title: article.title ?? "",
    user_level: userLevel,
    grammar_key: grow.grammar_key ?? "",
    normalized_key: grow.normalized_key ?? "",
    current_name_de: grow.name_de ?? "",
    current_name_zh: grow.name_zh ?? "",
    selected_text_in_article: selectedText,
    occurrence_sentence: occurrenceSentence,
    original_text_snippet: snippet,
  };

  const openai = createServerOpenAIClient({
    apiKey,
    timeout: 120_000,
    maxRetries: 1,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.35,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify(userPayload),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: GRAMMAR_ENRICHMENT_JSON_SCHEMA,
      },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { ok: false, error: "OpenAI 返回空内容" },
        { status: 502 },
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { ok: false, error: "无法解析模型返回的 JSON" },
        { status: 502 },
      );
    }

    const grammar_type = parseGrammarType(parsed.grammar_type);
    const was_label_corrected = parsed.was_label_corrected === true;
    const corrected_label = String(parsed.corrected_label ?? "").trim();
    const correction_reason = String(parsed.correction_reason ?? "").trim();
    const is_subordinate_clause = parseIsSubordinateClause(
      parsed.is_subordinate_clause,
    );
    const finite_verb =
      typeof parsed.finite_verb === "string" ? parsed.finite_verb.trim() : "";
    const finite_verb_position = parseFiniteVerbPosition(
      parsed.finite_verb_position,
    );

    const name_de_raw = String(parsed.name_de ?? "").trim();
    const name_zh_raw = String(parsed.name_zh ?? "").trim();
    const explanation_zh_raw = String(parsed.explanation_zh ?? "").trim();
    const explanation_de_simple_raw = String(
      parsed.explanation_de_simple ?? "",
    ).trim();
    const level_estimate = parsed.level_estimate;
    const reason_for_selection = String(
      parsed.reason_for_selection ?? "",
    ).trim();
    const example_sentence = String(parsed.example_sentence ?? "").trim();

    if (
      !name_de_raw ||
      !name_zh_raw ||
      !explanation_zh_raw ||
      !explanation_de_simple_raw
    ) {
      return NextResponse.json(
        { ok: false, error: "模型返回的语法解释字段不完整" },
        { status: 502 },
      );
    }
    const validated = validateGrammarLabel(
      {
        name_de: name_de_raw,
        name_zh: name_zh_raw,
        explanation_zh: explanation_zh_raw,
        explanation_de_simple: explanation_de_simple_raw,
      },
      {
        sentence: occurrenceSentence,
        selectedText,
      },
    );
    const name_de = validated.name_de;
    const name_zh = validated.name_zh;
    const explanation_zh = validated.fixed_expression
      ? `${validated.explanation_zh}\n固定表达：${validated.fixed_expression}（某人缺少某物 / 某方面不足）`
      : validated.explanation_zh;
    const explanation_de_simple = validated.explanation_de_simple;
    const reason_for_selection_final = validated.fixed_expression
      ? `${reason_for_selection || "该结构在新闻转述中高频出现。"} 固定表达：${validated.fixed_expression}。`
      : reason_for_selection;

    if (!isCefrLevel(level_estimate)) {
      return NextResponse.json(
        { ok: false, error: "模型返回的 level_estimate 无效" },
        { status: 502 },
      );
    }

    const { error: saveErr } = await applyGrammarAiEnrichment(supabase, {
      userId: user.id,
      grammarItemId,
      grammar_key: grammar_type,
      name_de,
      name_zh,
      explanation_zh,
      explanation_de_simple,
      level_estimate,
    });

    if (saveErr) {
      return NextResponse.json({ ok: false, error: saveErr }, { status: 500 });
    }

    const corrected_from =
      validated.corrected_from ??
      (was_label_corrected
        ? `${grow.name_zh ?? ""} / ${grow.grammar_key ?? ""}`
        : null);

    return NextResponse.json({
      ok: true,
      grammar_type,
      name_de,
      name_zh,
      is_subordinate_clause,
      finite_verb,
      finite_verb_position,
      explanation_zh,
      explanation_de_simple,
      level_estimate,
      reason_for_selection: reason_for_selection_final,
      example_sentence,
      was_label_corrected,
      corrected_label: corrected_label || name_zh,
      correction_reason,
      corrected_from,
    });
  } catch (e: unknown) {
    const msg = formatOpenAIRouteErrorMessage(e);
    return NextResponse.json(
      { ok: false, error: msg || "OpenAI 调用失败" },
      { status: 502 },
    );
  }
}
