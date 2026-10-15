import { describe, expect, it, vi } from "vitest";
import {
  buildSignupEmail,
  parseNewUserPayload,
  readSignupNotifyConfig,
  secretMatches,
  sendViaResend,
  supabaseUsersPageUrl,
} from "./signupNotification";

describe("signupNotification", () => {
  it("config needs key, recipient and secret", () => {
    expect(readSignupNotifyConfig({ RESEND_API_KEY: "re_x", SIGNUP_NOTIFY_TO: "a@b.ch" })).toBeNull();
    const c = readSignupNotifyConfig({
      RESEND_API_KEY: " re_x ",
      SIGNUP_NOTIFY_TO: "a@b.ch",
      SIGNUP_WEBHOOK_SECRET: "s3cret",
    });
    expect(c).toMatchObject({ apiKey: "re_x", to: "a@b.ch", secret: "s3cret" });
    expect(c?.from).toContain("onboarding@resend.dev");
  });

  it("secretMatches", () => {
    expect(secretMatches("abc", "abc")).toBe(true);
    expect(secretMatches("abd", "abc")).toBe(false);
    expect(secretMatches("ab", "abc")).toBe(false);
    expect(secretMatches(null, "abc")).toBe(false);
  });

  it("parses flat and webhook-style payloads", () => {
    expect(parseNewUserPayload({ id: "u1", email: "x@y.de", created_at: "2026-10-15T20:00:00Z" })).toMatchObject({
      id: "u1",
      email: "x@y.de",
    });
    expect(
      parseNewUserPayload({ type: "INSERT", record: { id: "u2", email: "z@y.de", raw_app_meta_data: { provider: "email" } } }),
    ).toMatchObject({ id: "u2", provider: "email" });
    expect(parseNewUserPayload({})).toBeNull();
    expect(parseNewUserPayload("x")).toBeNull();
  });

  it("builds users page url from supabase url", () => {
    expect(supabaseUsersPageUrl("https://abcd1234.supabase.co")).toBe(
      "https://supabase.com/dashboard/project/abcd1234/auth/users",
    );
    expect(supabaseUsersPageUrl(undefined)).toBeNull();
  });

  it("builds email with escaped content", () => {
    const m = buildSignupEmail({ email: "<b>@x.de", created_at: "2026-10-15T20:00:00Z" }, null);
    expect(m.subject).toBe("新用户注册：<b>@x.de");
    expect(m.html).toContain("&lt;b&gt;");
    expect(m.text).toContain("瑞士时间");
  });

  it("sends via resend", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "e1" }), { status: 200 }));
    const r = await sendViaResend(
      { apiKey: "re_x", to: "a@b.ch", secret: "s", from: "f <f@resend.dev>" },
      { subject: "s", html: "h", text: "t" },
      fetchImpl as unknown as typeof fetch,
    );
    expect(r).toEqual({ ok: true, id: "e1" });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_x");
    expect(JSON.parse(init.body as string).to).toEqual(["a@b.ch"]);
  });
});
