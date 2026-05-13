"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Badge } from "@/components/ui/Badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { useAuthEntryHrefs } from "@/lib/auth/use-auth-entry-hrefs";
import type { ArticleRow } from "@/lib/supabase/articles";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatSupabaseOrUnknownError } from "@/lib/supabase/errors";

const PAGE_SIZE = 10;

type ArticleListItem = Pick<
  ArticleRow,
  "id" | "title" | "created_at" | "user_level_at_analysis" | "source_name" | "url"
>;

type PaginationItem = number | "ellipsis";

function parsePage(raw: string | null): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function pageHref(page: number): string {
  return page <= 1 ? "/articles" : `/articles?page=${page}`;
}

function formatArticleTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-Hans", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function paginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage]);
  if (currentPage <= 4) {
    [2, 3, 4, 5].forEach((p) => pages.add(p));
  } else if (currentPage >= totalPages - 3) {
    [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) =>
      pages.add(p),
    );
  } else {
    [currentPage - 1, currentPage + 1].forEach((p) => pages.add(p));
  }

  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const items: PaginationItem[] = [];

  sorted.forEach((page, index) => {
    const prev = sorted[index - 1];
    if (prev && page - prev > 1) {
      items.push("ellipsis");
    }
    items.push(page);
  });

  return items;
}

function ArticlesPageContent() {
  const { loginHref } = useAuthEntryHrefs();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPage = parsePage(searchParams.get("page"));
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [deletingArticleId, setDeletingArticleId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageItems = useMemo(
    () => paginationItems(currentPage, totalPages),
    [currentPage, totalPages],
  );

  const refreshSession = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    setSession(s);
    return s;
  }, []);

  const loadArticles = useCallback(async (userId: string, page: number) => {
    setLoading(true);
    setListError(null);
    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const supabase = getSupabaseBrowserClient();
      const { data, error, count } = await supabase
        .from("articles")
        .select("id,title,created_at,user_level_at_analysis,source_name,url", {
          count: "exact",
        })
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        throw error;
      }

      setArticles((data ?? []) as ArticleListItem[]);
      setTotalCount(count ?? 0);
    } catch (e) {
      setListError(formatSupabaseOrUnknownError(e));
      setArticles([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
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
          articles.find((a) => a.id === articleId)?.title?.trim() || "（无标题）";
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

        setDeleteNotice(`已删除：${deletedTitle}`);
        void loadArticles(session.user.id, currentPage);
      } catch (e: unknown) {
        setDeleteError(formatSupabaseOrUnknownError(e));
      } finally {
        setDeletingArticleId(null);
      }
    },
    [articles, currentPage, deletingArticleId, loadArticles, session?.user?.id],
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
    if (!session?.user?.id) {
      setArticles([]);
      setTotalCount(0);
      setListError(null);
      setLoading(false);
      return;
    }
    void loadArticles(session.user.id, currentPage);
  }, [currentPage, loadArticles, session]);

  useEffect(() => {
    if (!loading && totalCount > 0 && currentPage > totalPages) {
      router.replace(pageHref(totalPages));
    }
  }, [currentPage, loading, router, totalCount, totalPages]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-500">
            <Link href="/dashboard" className="text-emerald-700 hover:underline dark:text-emerald-400">
              仪表盘
            </Link>
            <span className="mx-1 text-zinc-400">/</span>
            文章库
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            文章库
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            查看所有保存过的文章，按保存时间倒序分页显示。
          </p>
        </div>
        <Link
          href="/import"
          className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
        >
          导入新文章
        </Link>
      </div>

      {session !== undefined && !session?.user ? (
        <Card className="space-y-3">
          <CardTitle className="text-base">需要登录</CardTitle>
          <CardDescription>登录后可查看自己的完整文章库。</CardDescription>
          <Link
            href={loginHref}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
          >
            去登录
          </Link>
        </Card>
      ) : null}

      {session?.user ? (
        <Card className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">全部文章</CardTitle>
              <CardDescription>
                {loading ? "加载中…" : `共 ${totalCount} 篇，每页 ${PAGE_SIZE} 篇。`}
              </CardDescription>
            </div>
            <Badge tone="muted">
              第 {Math.min(currentPage, totalPages)} / {totalPages} 页
            </Badge>
          </div>

          {listError ? (
            <div
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
              role="alert"
            >
              <p className="font-medium">加载文章库失败</p>
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

          {loading ? <p className="text-sm text-zinc-500">加载中…</p> : null}

          {!loading && !listError && totalCount === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              暂无保存的文章。前往{" "}
              <Link href="/import" className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                导入
              </Link>{" "}
              保存第一篇。
            </p>
          ) : null}

          {!loading && !listError && articles.length > 0 ? (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {articles.map((a) => (
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
                        {formatArticleTime(a.created_at)}
                        {a.user_level_at_analysis ? ` · ${a.user_level_at_analysis}` : ""}
                        {a.source_name ? ` · ${a.source_name}` : ""}
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
              ))}
            </ul>
          ) : null}

          {!loading && !listError && totalPages > 1 ? (
            <nav
              className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800"
              aria-label="文章库分页"
            >
              {currentPage > 1 ? (
                <Link
                  href={pageHref(currentPage - 1)}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  上一页
                </Link>
              ) : (
                <span className="rounded-lg border border-zinc-200 px-3 py-1.5 text-zinc-400 dark:border-zinc-800">
                  上一页
                </span>
              )}

              {pageItems.map((item, index) =>
                item === "ellipsis" ? (
                  <span key={`ellipsis-${index}`} className="px-1 text-zinc-400">
                    …
                  </span>
                ) : item === currentPage ? (
                  <span
                    key={item}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white"
                    aria-current="page"
                  >
                    {item}
                  </span>
                ) : (
                  <Link
                    key={item}
                    href={pageHref(item)}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {item}
                  </Link>
                ),
              )}

              {currentPage < totalPages ? (
                <Link
                  href={pageHref(currentPage + 1)}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  下一页
                </Link>
              ) : (
                <span className="rounded-lg border border-zinc-200 px-3 py-1.5 text-zinc-400 dark:border-zinc-800">
                  下一页
                </span>
              )}
            </nav>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

export default function ArticlesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <p className="text-sm text-zinc-500">加载中…</p>
        </div>
      }
    >
      <ArticlesPageContent />
    </Suspense>
  );
}
