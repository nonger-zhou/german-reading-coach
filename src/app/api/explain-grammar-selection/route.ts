import { NextResponse } from "next/server";
import {
  createServerOpenAIClient,
  formatOpenAIRouteErrorMessage,
} from "@/lib/openai/createServerOpenAIClient";
import { buildGrammarExplainSelectionUserContent } from "@/lib/articleAnalysis/grammarExplainSelectionPrompt";
import { GRAMMAR_EXPLAIN_SELECTION_JSON_SCHEMA } from "@/lib/articleAnalysis/grammarExplainSelectionSchema";
import {
  normalizeGrammarExplainSelection,
  type GrammarExplainSelectionResult,
} from "@/lib/articleAnalysis/grammarExplainSelectionSchema";
import { GRAMMAR_EXPLAIN_SELECTION_SYSTEM_PROMPT } from "@/lib/articleAnalysis/grammarExplainSelectionPrompt";
import { resolveGrammarSelectionContext } from "@/lib/articleAnalysis/resolveGrammarSelectionContext";
import { getSupabaseUserFromBearer } from "@/lib/supabase/routeFromBearer";

export const maxDuration = 120;

type OkBody = {
  ok: true;
  explanation: GrammarExplainSelectionResult;
  occurrence_sentence: string;
};

type ErrBody = {
  ok: false;
  error: string;
  code?: string;
};

export async function POST(req: Request): Promise<NextResponse<OkBody | ErrBody>> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "OPENAI_API_KEY 未配置", code: "missing_api_key" },
      { status: 503 },
    );
  }

  const auth = await getSupabaseUserFromBearer(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.message, code: "unauthorized" },
      { status: auth.status },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "请求体不是合法 JSON", code: "invalid_json" },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { ok: false, error: "请求体无效", code: "invalid_body" },
      { status: 400 },
    );
  }
  const b = body as Record<string, unknown>;
  const articleId = typeof b.articleId === "string" ? b.articleId.trim() : "";
  const selectedText =
    typeof b.selected_text === "string" ? b.selected_text.trim() : "";

  if (!articleId || !selectedText) {
    return NextResponse.json(
      {
        ok: false,
        error: "缺少 articleId 或 selected_text",
        code: "missing_fields",
      },
      { status: 400 },
    );
  }

  const { data: article, error: artErr } = await auth.supabase
    .from("articles")
    .select("id,title,original_text")
    .eq("id", articleId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (artErr) {
    return NextResponse.json(
      { ok: false, error: artErr.message, code: "article_fetch_failed" },
      { status: 502 },
    );
  }
  if (!article?.original_text) {
    return NextResponse.json(
      { ok: false, error: "文章不存在或无权访问", code: "article_not_found" },
      { status: 404 },
    );
  }

  const originalText = String(article.original_text);
  const ctx = resolveGrammarSelectionContext(originalText, selectedText);
  if (!ctx.ok) {
    return NextResponse.json(
      { ok: false, error: ctx.message, code: "invalid_selected_text" },
      { status: 400 },
    );
  }

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
        { role: "system", content: GRAMMAR_EXPLAIN_SELECTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildGrammarExplainSelectionUserContent({
            articleTitle: String(article.title ?? ""),
            selectedText: originalText.slice(ctx.start, ctx.end),
            occurrenceSentence: ctx.occurrenceSentence,
            originalTextSnippet: ctx.snippet,
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: GRAMMAR_EXPLAIN_SELECTION_JSON_SCHEMA,
      },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { ok: false, error: "OpenAI 返回空内容", code: "empty_completion" },
        { status: 502 },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { ok: false, error: "无法解析模型返回的 JSON", code: "parse_error" },
        { status: 502 },
      );
    }

    const explanation = normalizeGrammarExplainSelection(parsed);
    return NextResponse.json({
      ok: true,
      explanation,
      occurrence_sentence: ctx.occurrenceSentence,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: formatOpenAIRouteErrorMessage(e) || "OpenAI 调用失败",
        code: "openai_error",
      },
      { status: 502 },
    );
  }
}
