"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useAuthEntryHrefs } from "@/lib/auth/use-auth-entry-hrefs";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const linkClass =
  "shrink-0 rounded-lg px-2 py-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

const avatarLinkClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300";

function AccountAvatarIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function AuthNavInner() {
  const router = useRouter();
  const { loginHref, signupHref } = useAuthEntryHrefs();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (session === undefined) {
    return (
      <span className="shrink-0 px-2 py-1.5 text-xs text-zinc-400" aria-hidden>
        …
      </span>
    );
  }

  if (!session) {
    return (
      <>
        <Link href={loginHref} className={linkClass}>
          登录
        </Link>
        <Link href={signupHref} className={linkClass}>
          注册
        </Link>
        <Link href="/account" className={linkClass}>
          账户
        </Link>
      </>
    );
  }

  return (
    <>
      <Link
        href="/account"
        className={avatarLinkClass}
        title={session.user.email ? `账户：${session.user.email}` : "账户"}
        aria-label={session.user.email ? `账户：${session.user.email}` : "账户"}
      >
        <AccountAvatarIcon />
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        className={`${linkClass} border-0 bg-transparent font-sans text-sm`}
      >
        退出
      </button>
    </>
  );
}

export function AuthNav() {
  return (
    <Suspense
      fallback={
        <span className="shrink-0 px-2 py-1.5 text-xs text-zinc-400" aria-hidden>
          …
        </span>
      }
    >
      <AuthNavInner />
    </Suspense>
  );
}
