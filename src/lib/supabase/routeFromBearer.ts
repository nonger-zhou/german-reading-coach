import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

function readBearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h || !h.toLowerCase().startsWith("bearer ")) return null;
  const t = h.slice(7).trim();
  return t.length ? t : null;
}

export type RouteAuthResult =
  | { ok: true; user: User; supabase: SupabaseClient }
  | { ok: false; status: number; message: string };

/** 从 Authorization Bearer 校验用户，返回带 JWT 的 Supabase 客户端（走 RLS） */
export async function getSupabaseUserFromBearer(
  req: Request,
): Promise<RouteAuthResult> {
  const token = readBearer(req);
  if (!token) {
    return { ok: false, status: 401, message: "请先登录（缺少 Authorization）。" };
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return {
      ok: false,
      status: 503,
      message: "Supabase 环境变量未配置。",
    };
  }
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return {
      ok: false,
      status: 401,
      message: error?.message ?? "登录已失效，请重新登录。",
    };
  }
  return { ok: true, user: data.user, supabase };
}
