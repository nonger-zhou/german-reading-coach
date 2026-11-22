/**
 * 浏览器端：iPhone 导入令牌与手机收件箱的读写（走登录用户的 RLS）。
 * 表见 supabase/fixes/013_iphone_clip.sql；未执行时各函数返回 missingTable = true，页面隐藏相关区域。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompletenessReason } from "@/lib/clip/completeness";

export type ImportTokenRow = {
  id: string;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export type ClipInboxRow = {
  id: string;
  title: string | null;
  url: string | null;
  source_name: string | null;
  published_at_text: string | null;
  extracted_text: string | null;
  word_count: number;
  status: "partial" | "failed";
  reasons: CompletenessReason[];
  via: "page" | "server";
  language: "de" | "en" | null;
  created_at: string;
};

export function isMissingClipTable(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const err = e as { code?: unknown; message?: unknown };
  return (
    err.code === "42P01" ||
    err.code === "PGRST205" ||
    (typeof err.message === "string" && /could not find the table|does not exist/i.test(err.message))
  );
}

/** 32 字节随机数 → base64url（43 个字符） */
export function generateImportToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function listImportTokens(
  supabase: SupabaseClient,
): Promise<{ rows: ImportTokenRow[]; missingTable: boolean; error: unknown }> {
  const { data, error } = await supabase
    .from("import_tokens")
    .select("id, label, created_at, last_used_at, revoked_at")
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) return { rows: [], missingTable: isMissingClipTable(error), error };
  return { rows: (data ?? []) as ImportTokenRow[], missingTable: false, error: null };
}

/** 生成新令牌：只把摘要存进数据库；返回的令牌原文只显示这一次 */
export async function createImportToken(
  supabase: SupabaseClient,
  userId: string,
  label: string,
): Promise<string> {
  const token = generateImportToken();
  const token_hash = await sha256Hex(token);
  const { error } = await supabase
    .from("import_tokens")
    .insert({ user_id: userId, token_hash, label: label.trim() || null });
  if (error) throw error;
  return token;
}

export async function revokeImportToken(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase
    .from("import_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

function normalizeReasons(raw: unknown): CompletenessReason[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is CompletenessReason =>
      !!r && typeof r === "object" && typeof (r as { message?: unknown }).message === "string",
  );
}

export async function listClipInbox(
  supabase: SupabaseClient,
): Promise<{ rows: ClipInboxRow[]; missingTable: boolean; error: unknown }> {
  const { data, error } = await supabase
    .from("clip_inbox")
    .select(
      "id, title, url, source_name, published_at_text, extracted_text, word_count, status, reasons, via, language, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return { rows: [], missingTable: isMissingClipTable(error), error };
  const rows = (data ?? []).map((r) => ({
    ...(r as ClipInboxRow),
    reasons: normalizeReasons((r as { reasons?: unknown }).reasons),
  }));
  return { rows, missingTable: false, error: null };
}

export async function deleteClipInboxItem(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("clip_inbox").delete().eq("id", id);
  if (error) throw error;
}
