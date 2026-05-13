"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatSupabaseOrUnknownError } from "@/lib/supabase/errors";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100";

type Phase =
  | "parsing"
  | "hash_error"
  | "need_link"
  | "ready"
  | "submitting"
  | "done";

export default function AuthRecoveryPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("parsing");
  const [hashError, setHashError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.location.hash.replace(/^#/, "");
    if (raw) {
      const params = new URLSearchParams(raw);
      const errorCode = params.get("error_code");
      const errorDescription = params.get("error_description");
      if (errorCode) {
        const desc = errorDescription
          ? decodeURIComponent(errorDescription.replace(/\+/g, " "))
          : errorCode;
        setHashError(
          errorCode === "otp_expired"
            ? `${desc}（请回到登录页使用「忘记密码」重新发送邮件，并尽快只点击新邮件中的链接一次。）`
            : desc,
        );
        setPhase("hash_error");
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}`,
        );
        return;
      }
    }

    const supabase = getSupabaseBrowserClient();
    let cancelled = false;

    const fallbackTimer = window.setTimeout(() => {
      if (!cancelled) {
        setPhase((p) => (p === "parsing" ? "need_link" : p));
      }
    }, 2000);

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" && session) {
        window.clearTimeout(fallbackTimer);
        setPhase("ready");
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) {
        window.clearTimeout(fallbackTimer);
        setPhase("ready");
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      data.subscription.unsubscribe();
    };
  }, []);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (password.length < 6) {
      setFormError("密码至少 6 位");
      return;
    }
    if (password !== confirm) {
      setFormError("两次输入的密码不一致");
      return;
    }
    setPhase("submitting");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setFormError(error.message);
        setPhase("ready");
        return;
      }
      setPhase("done");
      router.push("/account");
      router.refresh();
    } catch (e: unknown) {
      setFormError(formatSupabaseOrUnknownError(e));
      setPhase("ready");
    }
  }

  if (phase === "parsing") {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">正在验证重置链接…</p>
      </div>
    );
  }

  if (phase === "hash_error" && hashError) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          无法完成密码重置
        </h1>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          {hashError}
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          返回登录页
        </Link>
      </div>
    );
  }

  if (phase === "need_link") {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          设置新密码
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          未检测到有效的重置会话。请从 Supabase 或登录页的「忘记密码」重新获取邮件，并点击邮件中的链接进入本页。
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          前往登录
        </Link>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <p className="text-sm text-emerald-800 dark:text-emerald-200">
          密码已更新，正在跳转账户页…
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          设置新密码
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          请为你的账户设置新密码（至少 6 位）。
        </p>
      </div>

      <Card>
        <form onSubmit={(e) => void handleSetPassword(e)} className="space-y-4">
          <div>
            <CardTitle className="text-base">新密码</CardTitle>
            <CardDescription>提交后将用于之后登录。</CardDescription>
          </div>

          <div>
            <label
              htmlFor="recovery-password"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              新密码
            </label>
            <input
              id="recovery-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="recovery-confirm"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              确认新密码
            </label>
            <input
              id="recovery-confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />
          </div>

          {formError ? (
            <p
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200"
              role="alert"
            >
              {formError}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={phase === "submitting"}
          >
            {phase === "submitting" ? "保存中…" : "保存新密码"}
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        <Link href="/login" className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
          返回登录
        </Link>
      </p>
    </div>
  );
}
