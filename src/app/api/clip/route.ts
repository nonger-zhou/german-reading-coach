import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { handleClipRequest, type ClipResponse } from "@/lib/clip/handleClip";
import { importArticleFromUrl } from "@/lib/import/importFromUrl";

/** 只有网址时由服务器抓取网页，可能较慢 */
export const maxDuration = 120;

/**
 * iPhone 快捷指令「分享 → 保存到读报学外语」的接收接口。
 *
 * 身份：请求头 Authorization: Bearer <个人导入令牌>（在「设置 → iPhone 分享保存」生成）。
 * 写库：经 Supabase 函数 clip_resolve_token / clip_ingest（013_iphone_clip.sql），
 *       用公开 anon key 调用，服务器不需要 service role key。
 *
 * 一律返回 HTTP 200 + { ok, message }：快捷指令直接把 message 显示为通知，
 * 不必处理各种状态码（错误时 ok = false）。
 */
export async function POST(req: Request): Promise<NextResponse<ClipResponse>> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;

  let body: unknown = null;
  try {
    /** 快捷指令可能以「文件」方式发送 JSON 文本，Content-Type 不一定正确，所以按文本读再解析 */
    const raw = await req.text();
    body = raw.trim() ? JSON.parse(raw) : null;
  } catch {
    return NextResponse.json({
      ok: false,
      message: "收到的内容不是合法 JSON：请检查快捷指令「获取 URL 内容」的请求体设置。",
    });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, message: "服务器未配置 Supabase 环境变量。" });
  }
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const result = await handleClipRequest(token, body, {
      rpc: async (fn, args) => {
        const { data, error } = await supabase.rpc(fn, args);
        return { data, error: error ? { code: error.code, message: error.message } : null };
      },
      importFromUrl: importArticleFromUrl,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({
      ok: false,
      message: `保存失败：${e instanceof Error ? e.message : "未知错误"}`,
    });
  }
}
