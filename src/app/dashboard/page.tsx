"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuthEntryHrefs } from "@/lib/auth/use-auth-entry-hrefs";
import type { ArticleRow } from "@/lib/supabase/articles";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatSupabaseOrUnknownError } from "@/lib/supabase/errors";

type ArticleListItem = Pick<
  ArticleRow,
  "id" | "title" | "created_at" | "user_level_at_analysis"
>;

type DashboardStats = {
  weekArticleCount: number;
  learningVocabularyCount: number;
  grammarItemCount: number;
};

function startOfLocalWeekIso(now = new Date()): string {
  const d = new Date(now);
  const day = d.getDay();
  const daysSinceMonday = (day + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysSinceMonday);
  return d.toISOString();
}

function DashboardPageContent() {
  const { loginHref } = useAuthEntryHrefs();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [articles, setArticles] = useState<ArticleListItem[] | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [deletingArticleId, setDeletingArticleId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    setSession(s);
    return s;
  }, []);

  const loadArticles = useCallback(async (userId: string) => {
    setListLoading(true);
    setListError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("articles")
        .select("id,title,created_at,user_level_at_analysis")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        throw error;
      }
      setArticles((data ?? []) as ArticleListItem[]);
    } catch (e) {
      setListError(formatSupabaseOrUnknownError(e));
      setArticles(null);
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadStats = useCallback(async (userId: string) => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const weekStartIso = startOfLocalWeekIso();
      const [articleCountResult, vocabCountResult, grammarCountResult] =
        await Promise.all([
          supabase
            .from("articles")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("created_at", weekStartIso),
          supabase
            .from("vocabulary_items")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .in("mastery_status", ["new", "learning", "familiar"]),
          supabase
            .from("grammar_items")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId),
        ]);

      if (articleCountResult.error) throw articleCountResult.error;
      if (vocabCountResult.error) throw vocabCountResult.error;
      if (grammarCountResult.error) throw grammarCountResult.error;

      setStats({
        weekArticleCount: articleCountResult.count ?? 0,
        learningVocabularyCount: vocabCountResult.count ?? 0,
        grammarItemCount: grammarCountResult.count ?? 0,
      });
    } catch (e) {
      setStatsError(formatSupabaseOrUnknownError(e));
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const handleDeleteArticle = useCallback(
    async (articleId: string) => {
      if (!session?.user?.id || deletingArticleId) return;
      const ok =
        typeof window !== "undefined" &&
        window.confirm(
          "确定删除这篇文章吗？这会删除文章正文、摘要、阅读问题，以及本文中的高亮和出现位置。已经保存到词库/语法库的长期学习记录不会自动删除。",
        );
      if (!ok) return;

      setDeletingArticleId(articleId);
      setDeleteError(null);
      setDeleteNotice(null);
      try {
        const deletedTitle =
          articles?.find((a) => a.id === articleId)?.title?.trim() || "（无标题）";
        const sb = getSupabaseBrowserClient();
        const { error: vocabOccErr } = await sb
          .from("vocabulary_occurrences")
          .delete()
          .eq("article_id", articleId)
          .eq("user_id", session.user.id);
        if (vocabOccErr) {
          throw new Error(
            `删除词汇出现记录失败：${formatSupabaseOrUnknownError(vocabOccErr)}`,
          );
        }

        const { error: grammarOccErr } = await sb
          .from("grammar_occurrences")
          .delete()
          .eq("article_id", articleId)
          .eq("user_id", session.user.id);
        if (grammarOccErr) {
          throw new Error(
            `删除语法出现记录失败：${formatSupabaseOrUnknownError(grammarOccErr)}`,
          );
        }

        const { error: articleErr } = await sb
          .from("articles")
          .delete()
          .eq("id", articleId)
          .eq("user_id", session.user.id);
        if (articleErr) {
          throw new Error(
            `删除文章失败：${formatSupabaseOrUnknownError(articleErr)}`,
          );
        }

        setArticles((prev) => (prev ? prev.filter((a) => a.id !== articleId) : prev));
        setDeleteNotice(`已删除：${deletedTitle}`);
        void loadStats(session.user.id);
      } catch (e: unknown) {
        setDeleteError(formatSupabaseOrUnknownError(e));
      } finally {
        setDeletingArticleId(null);
      }
    },
    [articles, deletingArticleId, loadStats, session?.user?.id],
  );

  useEffect(() => {
    void refreshSession();
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, [refreshSession]);

  useEffect(() => {
    if (session === undefined) {
      return;
    }
    if (!session?.user) {
      setArticles(null);
      setStats(null);
      setListError(null);
      setStatsError(null);
      return;
    }
    void loadArticles(session.user.id);
    void loadStats(session.user.id);
  }, [session, loadArticles, loadStats]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          仪表盘
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          查看最近保存的文章和学习记录。
        </p>
      </div>

      {session !== undefined && !session?.user ? (
        <Card className="space-y-3">
          <CardTitle className="text-base">需要登录</CardTitle>
          <CardDescription>
            登录后可在此查看最近保存的文章列表。
          </CardDescription>
          <Link
            href={loginHref}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
          >
            去登录
          </Link>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-zinc-500">本周保存</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {statsLoading ? "…" : stats ? `${stats.weekArticleCount} 篇` : "—"}
          </p>
          <Badge tone="muted" className="mt-2">
            本周
          </Badge>
        </Card>
        <Card>
          <p className="text-xs text-zinc-500">学习中词汇</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {statsLoading ? "…" : (stats?.learningVocabularyCount ?? "—")}
          </p>
          <Badge tone="warning" className="mt-2">
            学习中
          </Badge>
        </Card>
        <Card>
          <p className="text-xs text-zinc-500">语法点</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {statsLoading ? "…" : (stats?.grammarItemCount ?? "—")}
          </p>
          <Badge tone="success" className="mt-2">
            已记录
          </Badge>
        </Card>
      </div>

      {statsError ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
          role="status"
        >
          统计暂时无法读取，最近文章列表仍可继续使用。
        </div>
      ) : null}

      {session?.user ? (
        <Card className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">最近保存的文章</CardTitle>
              <CardDescription>最多显示 10 条，按保存时间倒序。</CardDescription>
            </div>
            <Link
              href="/articles"
              className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            >
              查看全部文章 →
            </Link>
          </div>

          {listLoading ? (
            <p className="text-sm text-zinc-500">加载中…</p>
          ) : null}

          {listError ? (
            <div
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
              role="alert"
            >
              <p className="font-medium">加载文章列表失败</p>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-sans text-xs">
                {listError}
              </pre>
            </div>
          ) : null}

          {deleteError ? (
            <div
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
              role="alert"
            >
              <p className="font-medium">删除失败</p>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-sans text-xs">
                {deleteError}
              </pre>
            </div>
          ) : null}

          {deleteNotice ? (
            <div
              className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100"
              role="status"
            >
              <p>{deleteNotice}</p>
            </div>
          ) : null}

          {!listLoading && !listError && articles && articles.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              暂无保存的文章。前往{" "}
              <Link href="/import" className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                导入
              </Link>{" "}
              保存第一篇。
            </p>
          ) : null}

          {!listLoading && articles && articles.length > 0 ? (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {articles.map((a) => {
                const t = new Date(a.created_at).toLocaleString("zh-Hans", {
                  dateStyle: "medium",
                  timeStyle: "short",
                });
                return (
                  <li key={a.id}>
                    <div className="flex flex-col gap-2 py-3 text-sm transition hover:bg-zinc-50/80 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-zinc-900/50">
                      <Link
                        href={`/articles/${a.id}`}
                        className="flex min-w-0 flex-1 flex-col gap-1"
                      >
                        <span className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                          {a.title ?? "（无标题）"}
                        </span>
                        <span className="shrink-0 text-zinc-500">
                          {t}
                          {a.user_level_at_analysis
                            ? ` · ${a.user_level_at_analysis}`
                            : ""}
                        </span>
                      </Link>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-md border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-200 dark:hover:bg-red-950/30"
                        disabled={Boolean(deletingArticleId)}
                        onClick={() => void handleDeleteArticle(a.id)}
                      >
                        {deletingArticleId === a.id ? "删除中…" : "删除"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <CardTitle className="text-base">演示阅读（Mock）</CardTitle>
        <CardDescription>体验分栏、高亮与词库/语法面板（不读写数据库）。</CardDescription>
        <Link
          href="/articles/mock"
          className="mt-3 inline-flex text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          前往演示课文 →
        </Link>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <p className="text-sm text-zinc-500">加载中…</p>
        </div>
      }
    >
      <DashboardPageContent />
    </Suspense>
  );
}
