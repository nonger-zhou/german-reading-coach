"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import {
  ensureUserProfile,
  type UserProfileRow,
} from "@/lib/supabase/auth";
import { useAuthEntryHrefs } from "@/lib/auth/use-auth-entry-hrefs";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatSupabaseOrUnknownError } from "@/lib/supabase/errors";

function AccountPageContent() {
  const router = useRouter();
  const { loginHref, signupHref } = useAuthEntryHrefs();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfileRow | null>(null);
  const [profileCreated, setProfileCreated] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const loadAccount = useCallback(async () => {
    setLoadError(null);
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    setSession(s);
    if (!s?.user) {
      setUser(null);
      setProfile(null);
      setProfileCreated(null);
      return;
    }
    setUser(s.user);
    try {
      const { profile: row, created } = await ensureUserProfile(s.user);
      setProfile(row);
      setProfileCreated(created);
    } catch (e) {
      setProfile(null);
      setProfileCreated(null);
      setLoadError(formatSupabaseOrUnknownError(e));
    }
  }, []);

  useEffect(() => {
    void loadAccount();
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadAccount();
    });
    return () => subscription.unsubscribe();
  }, [loadAccount]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  if (session === undefined) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <p className="text-sm text-zinc-500">加载中…</p>
      </div>
    );
  }

  if (!session || !user) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          账户
        </h1>
        <Card className="space-y-3">
          <CardTitle className="text-base">未登录</CardTitle>
          <CardDescription>
            请先登录以查看账户信息与个人 profile。
          </CardDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href={loginHref}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
            >
              去登录
            </Link>
          </div>
        </Card>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          还没有账户？{" "}
          <Link href={signupHref} className="text-emerald-700 hover:underline dark:text-emerald-400">
            注册
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          账户
        </h1>
        <Button
          type="button"
          variant="secondary"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? "退出中…" : "退出登录"}
        </Button>
      </div>

      <Card className="space-y-3">
        <CardTitle className="text-base">当前会话</CardTitle>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="font-medium text-zinc-500">邮箱</dt>
            <dd className="text-zinc-900 dark:text-zinc-100">{user.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-500">用户 ID</dt>
            <dd className="break-all font-mono text-xs text-zinc-900 dark:text-zinc-100">
              {user.id}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-500">会话状态</dt>
            <dd className="text-emerald-700 dark:text-emerald-400">已登录</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-500">访问令牌过期时间</dt>
            <dd className="text-zinc-800 dark:text-zinc-200">
              {session.expires_at
                ? new Date(session.expires_at * 1000).toLocaleString("zh-Hans")
                : "—"}
            </dd>
          </div>
        </dl>
      </Card>

      {loadError ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          <p className="font-medium">加载 profile 失败</p>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-sans text-xs">
            {loadError}
          </pre>
          <p className="mt-2 text-xs opacity-90">
            若提示权限/RLS 错误，可在 Supabase SQL Editor 执行{" "}
            <code className="rounded bg-red-100/80 px-1 dark:bg-red-900/50">
              supabase/fixes/001_profiles_rls_fix.sql
            </code>
            后重试。
          </p>
        </div>
      ) : null}

      {profile ? (
        <Card className="space-y-3">
          <CardTitle className="text-base">个人资料（profiles）</CardTitle>
          {profileCreated ? (
            <p className="text-sm font-medium text-sky-800 dark:text-sky-200">
              profile 已创建
            </p>
          ) : (
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              profile 已读取
            </p>
          )}
          {profileCreated ? (
            <p className="text-xs text-sky-700 dark:text-sky-300">
              已写入默认值（水平 B1、解释语言 zh 等）；数据来自 upsert + 再次查询。
            </p>
          ) : (
            <p className="text-xs text-zinc-500">
              该行在首次登录前已存在，仅执行 select。
            </p>
          )}
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">self_selected_level</dt>
              <dd>{profile.self_selected_level ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">estimated_reading_level</dt>
              <dd>{profile.estimated_reading_level ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">explanation_language</dt>
              <dd>{profile.explanation_language ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">explanation_intensity</dt>
              <dd>{profile.explanation_intensity ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">auto_play_pronunciation_on_click</dt>
              <dd>{profile.auto_play_pronunciation_on_click ? "true" : "false"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">email（profile）</dt>
              <dd>{profile.email ?? "—"}</dd>
            </div>
          </dl>
        </Card>
      ) : null}
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl space-y-4">
          <p className="text-sm text-zinc-500">加载中…</p>
        </div>
      }
    >
      <AccountPageContent />
    </Suspense>
  );
}
