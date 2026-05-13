import Link from "next/link";
import type { ReactNode } from "react";
import { AuthRecoveryHashBanner } from "@/components/AuthRecoveryHashBanner";
import { AuthNav } from "@/components/AuthNav";

const nav = [
  { href: "/", label: "首页" },
  { href: "/dashboard", label: "仪表盘" },
  { href: "/articles", label: "文章库" },
  { href: "/import", label: "导入" },
  { href: "/articles/mock", label: "演示课文" },
  { href: "/vocabulary", label: "词库" },
  { href: "/grammar", label: "语法" },
  { href: "/settings", label: "设置" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            German Reading Coach
          </Link>
          <nav
            className="-mx-1 flex flex-wrap items-center gap-1 overflow-x-auto pb-1 text-sm sm:pb-0"
            aria-label="主导航"
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-lg px-2 py-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                {item.label}
              </Link>
            ))}
            <span
              className="mx-1 hidden h-4 w-px shrink-0 bg-zinc-200 sm:inline dark:bg-zinc-700"
              aria-hidden
            />
            <AuthNav />
          </nav>
        </div>
      </header>
      <AuthRecoveryHashBanner />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6">
        {children}
      </main>
      <footer className="border-t border-zinc-200 py-4 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
        German Reading Coach · 从真实德语文章中积累词汇与语法
      </footer>
    </div>
  );
}
