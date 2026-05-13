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

function SignupForm() {
  const router = useRouter();
  const { loginHref, postAuthRedirect } = useAuthEntryHrefs();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: signError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signError) {
        setError(signError.message);
        return;
      }

      if (data.session) {
        router.push(postAuthRedirect);
        router.refresh();
        return;
      }

      setInfo(
        "注册成功。当前项目若开启了「邮箱确认」，请前往邮箱点击确认链接后再到登录页登录。若未开启确认，可直接前往登录页尝试登录。",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          注册
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          使用邮箱与密码创建你的 German Reading Coach 账户。
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <CardTitle className="text-base">新用户注册</CardTitle>
            <CardDescription>
              注册后可使用导入文章、阅读学习与词库等全部功能。
            </CardDescription>
          </div>

          <div>
            <label htmlFor="signup-email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              邮箱
            </label>
            <input
              id="signup-email"
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
            <label htmlFor="signup-password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              密码
            </label>
            <input
              id="signup-password"
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
              htmlFor="signup-confirm"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              确认密码
            </label>
            <input
              id="signup-confirm"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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

          {info ? (
            <p
              className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-100"
              role="status"
            >
              {info}
            </p>
          ) : null}

          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? "注册中…" : "注册"}
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        已有账户？{" "}
        <Link href={loginHref} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
          登录
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md">
          <p className="text-sm text-zinc-500">加载中…</p>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
