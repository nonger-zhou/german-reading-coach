"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import {
  deleteClipInboxItem,
  listClipInbox,
  type ClipInboxRow,
} from "@/lib/clip/clipData";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatSupabaseOrUnknownError } from "@/lib/supabase/errors";

const COLLAPSED_COUNT = 3;

function hostOf(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * 手机收件箱：iPhone 分享时没能提取完整的文章（只保留标题、链接、已提取部分），不进文章列表。
 * 用户可「放进编辑区」补全后保存（保存成功后自动移出收件箱）、打开原文重新分享，或删除。
 * 没有条目、或数据库未执行 013 时整块不显示。
 */
export function ClipInbox({
  userId,
  onLoadIntoEditor,
}: {
  userId: string;
  onLoadIntoEditor: (row: ClipInboxRow) => void;
}) {
  const [rows, setRows] = useState<ClipInboxRow[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await listClipInbox(getSupabaseBrowserClient());
    if (res.missingTable) {
      setRows([]);
      return;
    }
    if (res.error) {
      setError(formatSupabaseOrUnknownError(res.error));
      return;
    }
    setError(null);
    setRows(res.rows);
  }, []);

  useEffect(() => {
    void load();
  }, [load, userId]);

  async function onDelete(row: ClipInboxRow) {
    setBusyId(row.id);
    try {
      await deleteClipInboxItem(getSupabaseBrowserClient(), row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e) {
      setError(formatSupabaseOrUnknownError(e));
    } finally {
      setBusyId(null);
    }
  }

  if (!rows.length && !error) return null;

  const visible = expanded ? rows : rows.slice(0, COLLAPSED_COUNT);

  return (
    <Card className="border-amber-200 dark:border-amber-900/60">
      <CardTitle className="text-base">
        手机收件箱 <span className="text-sm font-normal text-zinc-500">（{rows.length}）</span>
      </CardTitle>
      <CardDescription>
        iPhone 分享时没能拿到完整正文的文章先放在这里，还没有存进文章列表。可以补全后保存，或在 Safari 登录该网站后重新分享（存全后会自动移出）。
      </CardDescription>
      {error ? (
        <p className="mt-2 text-xs text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="mt-3 space-y-3">
        {visible.map((row) => {
          const host = row.source_name || hostOf(row.url);
          const hasText = (row.extracted_text ?? "").trim().length > 0;
          return (
            <li
              key={row.id}
              className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="warning">{row.status === "failed" ? "提取失败" : "可能不完整"}</Badge>
                <span className="text-xs text-zinc-500">
                  {[host, formatTime(row.created_at), row.via === "server" ? "按网址抓取" : "Safari 页面提取"]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {row.title || row.url || "（无标题）"}
              </p>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {row.reasons.map((r) => r.message).join("") || "正文可能不完整。"}
                {hasText ? `已提取 ${row.word_count} 词。` : "没有提取到正文。"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  className="px-3 py-1.5 text-xs"
                  onClick={() => onLoadIntoEditor(row)}
                >
                  {hasText ? "放进编辑区补全" : "放进编辑区"}
                </Button>
                {row.url ? (
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                  >
                    打开原文
                  </a>
                ) : null}
                <Button
                  variant="ghost"
                  className="px-3 py-1.5 text-xs"
                  disabled={busyId === row.id}
                  onClick={() => void onDelete(row)}
                >
                  删除
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {rows.length > COLLAPSED_COUNT ? (
        <button
          type="button"
          className="mt-2 text-xs text-emerald-700 hover:underline dark:text-emerald-400"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "收起" : `显示全部 ${rows.length} 条`}
        </button>
      ) : null}
    </Card>
  );
}
