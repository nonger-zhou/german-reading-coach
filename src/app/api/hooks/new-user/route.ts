import { NextResponse } from "next/server";
import {
  buildSignupEmail,
  parseNewUserPayload,
  readSignupNotifyConfig,
  secretMatches,
  sendViaResend,
  supabaseUsersPageUrl,
} from "@/lib/notify/signupNotification";

/**
 * 新用户注册通知（由 Supabase 触发器调用，见 supabase/fixes/011_signup_notify.sql）。
 * 需要请求头 x-webhook-secret 与 SIGNUP_WEBHOOK_SECRET 一致。
 * 发信失败只记日志并返回非 2xx，不影响用户注册（触发器是异步的）。
 */
export async function POST(req: Request) {
  const config = readSignupNotifyConfig();
  if (!config) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }
  if (!secretMatches(req.headers.get("x-webhook-secret"), config.secret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const user = parseNewUserPayload(body);
  if (!user) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const mail = buildSignupEmail(user, supabaseUsersPageUrl(process.env.NEXT_PUBLIC_SUPABASE_URL));
  const result = await sendViaResend(config, mail);
  if (!result.ok) {
    console.error("[signup-notify] Resend failed", result.status, result.message);
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, id: result.id });
}
