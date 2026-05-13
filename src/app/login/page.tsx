"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { useAuthEntryHrefs } from "@/lib/auth/use-auth-entry-hrefs";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100";

function LoginForm() {
  const router = useRouter();
  const { signupHref, postAuthRedirect } = useAuthEntryHrefs();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetInfo, setResetInfo] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setResetError(null);
    setResetInfo(null);
    const em = (resetEmail || email).trim();
    if (!em) {
      setResetError("请填写邮箱");
      return;
    }
    setResetLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
        em,
        { redirectTo: `${origin}/auth/recovery` },
      );
      if (resetErr) {
        setResetError(resetErr.message);
        return;
      }
      setResetInfo(
        "若该邮箱已注册，你将收到重置邮件。请打开邮件中的链接，在本站「设置新密码」页完成修改。链接有时效，请尽快只点击一次。",
      );
    } finally {
      setResetLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signError) {
        setError(signError.message);
        return;
      }
      router.push(postAuthRedirect);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          登录
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          使用注册时的邮箱与密码登录你的账户。
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <CardTitle className="text-base">邮箱登录</CardTitle>
            <CardDescription>
              登录后可访问已保存的文章、词库与学习记录。
            </CardDescription>
          </div>

          <div>
            <label htmlFor="login-email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              邮箱
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="login-password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              密码
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          {error ? (
            <p
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? "登录中…" : "登录"}
          </Button>
        </form>
      </Card>

      <Card>
        <div className="space-y-3">
          <button
            type="button"
            className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            onClick={() => {
              setResetOpen((o) => !o);
              setResetError(null);
              setResetInfo(null);
              if (!resetEmail && email) setResetEmail(email);
            }}
          >
            {resetOpen ? "收起「忘记密码」" : "忘记密码？"}
          </button>
          {resetOpen ? (
            <form onSubmit={(e) => void handlePasswordReset(e)} className="space-y-3">
              <CardDescription>
                向你的注册邮箱发送重置链接；请在邮件中点击链接，跳转到本站后设置新密码。
              </CardDescription>
              <div>
                <label
                  htmlFor="reset-email"
                  className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  邮箱
                </label>
                <input
                  id="reset-email"
                  name="resetEmail"
                  type="email"
                  autoComplete="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder={email ? "可留空，将使用上方登录邮箱" : ""}
                  className={inputClass}
                />
              </div>
              {resetError ? (
                <p
                  className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200"
                  role="alert"
                >
                  {resetError}
                </p>
              ) : null}
              {resetInfo ? (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                  {resetInfo}
                </p>
              ) : null}
              <Button
                type="submit"
                variant="secondary"
                className="w-full"
                disabled={resetLoading}
              >
                {resetLoading ? "发送中…" : "发送重置邮件"}
              </Button>
            </form>
          ) : null}
        </div>
      </Card>

      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        还没有账户？{" "}
        <Link href={signupHref} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
          注册
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md">
          <p className="text-sm text-zinc-500">加载中…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
