/**
 * 新用户注册通知：Supabase 在 auth.users 新增一行时（触发器 + pg_net）POST 到
 * /api/hooks/new-user，本模块组装邮件并通过 Resend 发给站长。
 *
 * 环境变量（仅服务端）：
 * - RESEND_API_KEY：Resend 密钥（re_ 开头）
 * - SIGNUP_NOTIFY_TO：收件地址（未验证域名时必须是 Resend 注册邮箱）
 * - SIGNUP_WEBHOOK_SECRET：与 Supabase 触发器里写的一致，防止他人伪造请求
 * - SIGNUP_NOTIFY_FROM（可选）：发件人，默认 Resend 测试发件地址
 */

import { timingSafeEqual } from "node:crypto";

export type NewUserPayload = {
  id?: string;
  email?: string | null;
  created_at?: string | null;
  provider?: string | null;
};

export type SignupNotifyConfig = {
  apiKey: string;
  to: string;
  secret: string;
  from: string;
};

export const DEFAULT_SIGNUP_NOTIFY_FROM = "Reading Coach <onboarding@resend.dev>";

export function readSignupNotifyConfig(
  env: Record<string, string | undefined> = process.env,
): SignupNotifyConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const to = env.SIGNUP_NOTIFY_TO?.trim();
  const secret = env.SIGNUP_WEBHOOK_SECRET?.trim();
  if (!apiKey || !to || !secret) return null;
  return { apiKey, to, secret, from: env.SIGNUP_NOTIFY_FROM?.trim() || DEFAULT_SIGNUP_NOTIFY_FROM };
}

/** 常量时间比较，避免通过响应时间猜密钥 */
export function secretMatches(provided: string | null | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function parseNewUserPayload(body: unknown): NewUserPayload | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  // 兼容直接传用户行，或 Supabase Database Webhook 的 { record: {...} } 形式
  const rec = (o.record && typeof o.record === "object" ? o.record : o) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const meta = rec.raw_app_meta_data as Record<string, unknown> | undefined;
  const payload: NewUserPayload = {
    id: str(rec.id) ?? undefined,
    email: str(rec.email),
    created_at: str(rec.created_at),
    provider: str(rec.provider) ?? (meta ? str(meta.provider) : null),
  };
  if (!payload.id && !payload.email) return null;
  return payload;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

export function formatZurichTime(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return iso ?? "";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Europe/Zurich",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

/** 从 NEXT_PUBLIC_SUPABASE_URL 推出后台「用户」页链接 */
export function supabaseUsersPageUrl(supabaseUrl: string | undefined): string | null {
  const m = supabaseUrl?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? `https://supabase.com/dashboard/project/${m[1]}/auth/users` : null;
}

export function buildSignupEmail(
  user: NewUserPayload,
  usersPageUrl: string | null,
): { subject: string; html: string; text: string } {
  const email = user.email || "（无邮箱）";
  const when = formatZurichTime(user.created_at);
  const lines = [
    `新用户注册：${email}`,
    `时间：${when}（瑞士时间）`,
    user.provider ? `方式：${user.provider}` : null,
    user.id ? `用户 ID：${user.id}` : null,
    usersPageUrl ? `查看全部用户：${usersPageUrl}` : null,
  ].filter((l): l is string => Boolean(l));
  const html =
    lines
      .map((l) => {
        if (usersPageUrl && l.endsWith(usersPageUrl)) {
          return `<p><a href="${escapeHtml(usersPageUrl)}">在 Supabase 查看全部用户</a></p>`;
        }
        return `<p>${escapeHtml(l)}</p>`;
      })
      .join("\n");
  return { subject: `新用户注册：${email}`, html, text: lines.join("\n") };
}

export async function sendViaResend(
  config: SignupNotifyConfig,
  mail: { subject: string; html: string; text: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; id?: string } | { ok: false; status: number; message: string }> {
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: config.from, to: [config.to], ...mail }),
  });
  if (!res.ok) {
    const message = (await res.text().catch(() => "")).slice(0, 500);
    return { ok: false, status: res.status, message };
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { ok: true, id: data.id };
}
