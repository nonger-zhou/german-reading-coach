import { NextResponse } from "next/server";
import { importArticleFromUrl, UrlImportError } from "@/lib/import/importFromUrl";

/** 链接抓取含网络与解析，避免平台默认短限时过早中断 */
export const maxDuration = 300;

type OkBody = {
  ok: true;
  article: {
    title: string;
    source_url: string;
    source_name: string;
    published_at_text: string;
    cleaned_text: string;
    raw_text?: string;
    excerpt?: string;
  };
};

type ErrBody = {
  ok: false;
  error: {
    message: string;
    code: string;
  };
};

export async function POST(req: Request): Promise<NextResponse<OkBody | ErrBody>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { message: "请求体不是合法 JSON。", code: "invalid_json" },
      },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      {
        ok: false,
        error: { message: "请求体无效。", code: "invalid_body" },
      },
      { status: 400 },
    );
  }
  const payload = body as Record<string, unknown>;
  const rawUrl = payload.url;
  const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!url) {
    return NextResponse.json(
      {
        ok: false,
        error: { message: "缺少 url。", code: "missing_url" },
      },
      { status: 400 },
    );
  }

  try {
    const article = await importArticleFromUrl(url);
    return NextResponse.json({ ok: true, article });
  } catch (e) {
    if (e instanceof UrlImportError) {
      return NextResponse.json(
        { ok: false, error: { message: e.message, code: e.code } },
        { status: 400 },
      );
    }
    const msg = e instanceof Error ? e.message : "抓取失败，请稍后重试。";
    return NextResponse.json(
      { ok: false, error: { message: msg, code: "import_failed" } },
      { status: 500 },
    );
  }
}
