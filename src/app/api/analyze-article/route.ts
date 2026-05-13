import { NextResponse } from "next/server";
import {
  createServerOpenAIClient,
  formatOpenAIRouteErrorMessage,
} from "@/lib/openai/createServerOpenAIClient";

/** 整文分析可能接近分钟级，放宽服务端限时（部署平台支持时生效） */
export const maxDuration = 180;
import { ARTICLE_ANALYSIS_JSON_SCHEMA } from "@/lib/articleAnalysis/articleAnalysisJsonSchema";
import {
  buildOpenAIAnalysisUserContent,
  normalizeOpenAIArticleAnalysis,
  SYSTEM_PROMPT,
  truncateForOpenAIAnalysis,
} from "@/lib/articleAnalysis/openaiArticleAnalysis";
import type { ArticleAnalysisResult } from "@/lib/articleAnalysis/types";
import type { CefrLevel } from "@/lib/types";

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

    const analysis = normalizeOpenAIArticleAnalysis(parsed);

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
