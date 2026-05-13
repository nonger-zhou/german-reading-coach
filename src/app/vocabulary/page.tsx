"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Badge } from "@/components/ui/Badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import type { CefrLevel, MasteryStatus } from "@/lib/types";
import { useAuthEntryHrefs } from "@/lib/auth/use-auth-entry-hrefs";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatSupabaseOrUnknownError } from "@/lib/supabase/errors";
import { updateVocabularyItemMastery } from "@/lib/supabase/vocabulary";
import { normalizeDeepNoteMarkdown } from "@/lib/text/normalizeDeepNoteMarkdown";

type VocabularyItemRow = {
  id: string;
  lemma: string | null;
  display_word: string | null;
  normalized_key: string;
  part_of_speech: string | null;
  zh_meaning: string | null;
  simple_de_explanation: string | null;
  mastery_status: MasteryStatus | null;
  source: string | null;
  level_estimate: string | null;
  user_deep_note?: string | null;
  user_deep_note_updated_at?: string | null;
  encounter_count: number | null;
  created_at: string | null;
  updated_at: string | null;
  last_seen_at: string | null;
};

type VocabularySenseRow = {
  vocabulary_item_id: string;
  zh_meaning: string | null;
  simple_de_explanation: string | null;
  created_at: string | null;
};

type VocabularyOccurrenceRow = {
  id: string;
  vocabulary_item_id: string;
  article_id: string;
  surface_form: string | null;
  created_at: string | null;
};

type ArticleTitleRow = {
  id: string;
  title: string | null;
};

type UiStatus = "learning" | "mastered" | "ignored";
type TimeTab = "all" | "today" | "yesterday" | "recent3" | "week";

/** PRD §12.5：今日词汇记录中的标签 */
type TodayEncounterTag = "new" | "repeat";

type VocabularyListItem = {
  id: string;
  displayWord: string;
  lemma: string;
  normalizedKey: string;
  originalForm: string;
  partOfSpeech: string;
  zhMeaning: string;
  deExplanation: string;
  levelEstimate: string;
  status: UiStatus;
  source: string;
  occurrenceCount: number;
  sourceArticles: Array<{ id: string; title: string; occurrenceId: string | null }>;
  userDeepNote: string | null;
  learnedAt: string | null;
  learnedAtLabel: string;
  updatedAtLabel: string;
  /** PRD §12.5：是否落入「今日词汇记录」集合（本地自然日 + occurrence / 主词条创建） */
  inTodayTab: boolean;
  /** 与「今日词汇记录」标签；非今日 Tab 下仍可保留供切换 Tab 时使用 */
  todayTag: TodayEncounterTag | null;
};

const LEVEL_FILTERS: Array<"all" | CefrLevel> = [
  "all",
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
];

function uiStatusFromMastery(s: MasteryStatus | null): UiStatus {
  if (s === "mastered") return "mastered";
  if (s === "ignored") return "ignored";
  return "learning";
}

function sourceLabel(s: string | null): string {
  if (s === "ai") return "AI";
  if (s === "ai_mock") return "AI Mock";
  if (s === "manual") return "手动";
  return s?.trim() ? s : "未知";
}

function posLabelZh(raw: string | null | undefined): string {
  const k = (raw ?? "").trim().toLowerCase();
  const map: Record<string, string> = {
    noun: "名词",
    verb: "动词",
    adjective: "形容词",
    adverb: "副词",
    preposition: "介词",
    conjunction: "连词",
    pronoun: "代词",
    number: "数词",
    numeral: "数词",
    phrase: "短语",
    collocation: "搭配",
    fixed_expression: "固定表达",
    separable_verb: "可分动词",
    compound_noun: "复合名词",
    verb_phrase: "动词短语",
    prepositional_phrase: "介词短语",
  };
  if (!k || k === "unknown" || k === "missing" || k === "—") return "词汇";
  return map[k] ?? raw?.trim() ?? "词汇";
}

function toLocaleTimeLabel(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("zh-Hans", { dateStyle: "medium", timeStyle: "short" });
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayDiffFromToday(v: string | null): number | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const today = startOfDay(new Date());
  const target = startOfDay(d);
  return Math.floor((today.getTime() - target.getTime()) / 86400000);
}

/** 用户本地自然日是否与该 ISO 时间同一天（PRD §12.5「今日」） */
function isSameLocalCalendarDay(iso: string | null, ref: Date = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

/**
 * PRD §12.5：NEW = 主词条当日首次创建且当日仅单一文章来源（或尚无当日 occurrence 细分）；
 * REPEAT = 当日有新 occurrence，且（主词条非今日创建 | 或今日已有≥2 个不同文章来源）。
 */
function computeTodayEncounterTag(
  itemCreatedAt: string | null,
  occurrences: Array<{ article_id: string; created_at: string | null }>,
): { inTodayTab: boolean; todayTag: TodayEncounterTag | null } {
  const now = new Date();
  const occToday = occurrences.filter((o) => isSameLocalCalendarDay(o.created_at, now));
  const itemCreatedToday = isSameLocalCalendarDay(itemCreatedAt, now);
  const distinctArticlesToday = new Set(occToday.map((o) => o.article_id)).size;

  const inTodayTab = itemCreatedToday || occToday.length > 0;
  if (!inTodayTab) {
    return { inTodayTab: false, todayTag: null };
  }

  if (itemCreatedToday && distinctArticlesToday <= 1) {
    return { inTodayTab: true, todayTag: "new" };
  }
  if (occToday.length > 0 && (!itemCreatedToday || distinctArticlesToday >= 2)) {
    return { inTodayTab: true, todayTag: "repeat" };
  }
  if (itemCreatedToday && occToday.length === 0) {
    return { inTodayTab: true, todayTag: "new" };
  }
  return { inTodayTab: true, todayTag: "repeat" };
}

function startOfCurrentWeek(): Date {
  const now = new Date();
  const today = startOfDay(now);
  const weekday = today.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const start = new Date(today);
  start.setDate(today.getDate() + mondayOffset);
  return start;
}

function isMissingDeepNoteColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; message?: unknown };
  const message = typeof e.message === "string" ? e.message : "";
  return (
    e.code === "42703" ||
    message.includes("user_deep_note") ||
    message.includes("user_deep_note_updated_at")
  );
}

function VocabularyPageContent() {
  const { loginHref } = useAuthEntryHrefs();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [items, setItems] = useState<VocabularyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | UiStatus>("all");
  const [levelFilter, setLevelFilter] = useState<"all" | CefrLevel>("all");
  const [timeTab, setTimeTab] = useState<TimeTab>("all");
  const [statusSavingItemId, setStatusSavingItemId] = useState<string | null>(null);
  const [statusActionError, setStatusActionError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    const {
      data: { session: s },
    } = await sb.auth.getSession();
    setSession(s);
    return s;
  }, []);

  useEffect(() => {
    void refreshSession();
    const sb = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange(() => {
      void refreshSession();
    });
    return () => subscription.unsubscribe();
  }, [refreshSession]);

  useEffect(() => {
    if (session === undefined) return;
    if (!session?.user?.id) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const sb = getSupabaseBrowserClient();
        const itemSelectWithDeepNote =
          "id,lemma,display_word,normalized_key,part_of_speech,zh_meaning,simple_de_explanation,mastery_status,source,level_estimate,user_deep_note,user_deep_note_updated_at,encounter_count,created_at,updated_at,last_seen_at";
        const itemSelectBase =
          "id,lemma,display_word,normalized_key,part_of_speech,zh_meaning,simple_de_explanation,mastery_status,source,level_estimate,encounter_count,created_at,updated_at,last_seen_at";

        const initialItemsResult = await sb
          .from("vocabulary_items")
          .select(itemSelectWithDeepNote)
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });
        let itemRows: unknown[] | null = initialItemsResult.data;
        let itemErr: unknown = initialItemsResult.error;
        if (itemErr && isMissingDeepNoteColumn(itemErr)) {
          const fallback = await sb
            .from("vocabulary_items")
            .select(itemSelectBase)
            .eq("user_id", session.user.id)
            .order("created_at", { ascending: false });
          itemRows = fallback.data;
          itemErr = fallback.error;
        }
        if (itemErr) throw itemErr;
        const rows = (itemRows ?? []) as VocabularyItemRow[];
        if (!rows.length) {
          if (!cancelled) setItems([]);
          return;
        }

        const itemIds = rows.map((r) => r.id);
        const { data: senseRows, error: senseErr } = await sb
          .from("vocabulary_senses")
          .select("vocabulary_item_id,zh_meaning,simple_de_explanation,created_at")
          .eq("user_id", session.user.id)
          .in("vocabulary_item_id", itemIds)
          .order("created_at", { ascending: true });
        if (senseErr) throw senseErr;

        const { data: occurrenceRows, error: occErr } = await sb
          .from("vocabulary_occurrences")
          .select("id,vocabulary_item_id,article_id,surface_form,created_at")
          .eq("user_id", session.user.id)
          .in("vocabulary_item_id", itemIds);
        if (occErr) throw occErr;

        const occs = (occurrenceRows ?? []) as VocabularyOccurrenceRow[];
        const articleIds = [...new Set(occs.map((o) => o.article_id))];
        let articleTitleRows: ArticleTitleRow[] = [];
        if (articleIds.length > 0) {
          const { data: arts, error: artErr } = await sb
            .from("articles")
            .select("id,title")
            .eq("user_id", session.user.id)
            .in("id", articleIds);
          if (artErr) throw artErr;
          articleTitleRows = (arts ?? []) as ArticleTitleRow[];
        }

        const firstSenseByItem = new Map<string, VocabularySenseRow>();
        for (const s of (senseRows ?? []) as VocabularySenseRow[]) {
          if (!firstSenseByItem.has(s.vocabulary_item_id)) {
            firstSenseByItem.set(s.vocabulary_item_id, s);
          }
        }

        const occByItem = new Map<string, VocabularyOccurrenceRow[]>();
        for (const o of occs) {
          const list = occByItem.get(o.vocabulary_item_id) ?? [];
          list.push(o);
          occByItem.set(o.vocabulary_item_id, list);
        }

        const articleTitleById = new Map<string, string>();
        for (const a of articleTitleRows) {
          articleTitleById.set(a.id, a.title?.trim() || "（无标题）");
        }

        const normalized: VocabularyListItem[] = rows.map((r) => {
          const sense = firstSenseByItem.get(r.id);
          const occList = occByItem.get(r.id) ?? [];
          const articleRefIds = [...new Set(occList.map((o) => o.article_id))];
          const { inTodayTab, todayTag } = computeTodayEncounterTag(
            r.created_at,
            occList.map((o) => ({
              article_id: o.article_id,
              created_at: o.created_at,
            })),
          );
          return {
            id: r.id,
            displayWord: r.display_word?.trim() || r.lemma?.trim() || r.normalized_key,
            lemma: r.lemma?.trim() || r.display_word?.trim() || r.normalized_key,
            normalizedKey: r.normalized_key,
            originalForm:
              occList.find((o) => o.surface_form?.trim())?.surface_form?.trim() ||
              r.display_word?.trim() ||
              "",
            partOfSpeech: posLabelZh(r.part_of_speech),
            zhMeaning:
              r.zh_meaning?.trim() ||
              sense?.zh_meaning?.trim() ||
              "待 AI 补充",
            deExplanation:
              r.simple_de_explanation?.trim() ||
              sense?.simple_de_explanation?.trim() ||
              "Wird später ergänzt.",
            levelEstimate: r.level_estimate?.trim() || "—",
            status: uiStatusFromMastery(r.mastery_status),
            source: sourceLabel(r.source),
            occurrenceCount: Math.max(occList.length, r.encounter_count ?? 0),
            userDeepNote: normalizeDeepNoteMarkdown(r.user_deep_note ?? "") || null,
            sourceArticles: articleRefIds.slice(0, 4).map((id) => {
              const occurrenceId =
                occList.find((o) => o.article_id === id)?.id ?? null;
              return {
                id,
                title: articleTitleById.get(id) ?? "（无标题）",
                occurrenceId,
              };
            }),
            learnedAt: r.created_at,
            learnedAtLabel: toLocaleTimeLabel(r.created_at),
            updatedAtLabel: toLocaleTimeLabel(r.last_seen_at ?? r.updated_at),
            inTodayTab,
            todayTag,
          };
        });

        if (!cancelled) setItems(normalized);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(formatSupabaseOrUnknownError(e));
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, session]);

  const filteredItems = useMemo(() => {
    const weekStart = startOfCurrentWeek();
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const diff = dayDiffFromToday(it.learnedAt);
      if (timeTab === "all") {
        // keep all items
      } else if (timeTab === "today" && !it.inTodayTab) return false;
      if (timeTab === "yesterday" && diff !== 1) return false;
      if (timeTab === "recent3" && (diff === null || diff < 0 || diff > 2))
        return false;
      if (timeTab === "week") {
        if (!it.learnedAt) return false;
        const d = new Date(it.learnedAt);
        if (Number.isNaN(d.getTime()) || startOfDay(d) < weekStart) return false;
      }
      if (statusFilter !== "all" && it.status !== statusFilter) return false;
      if (levelFilter !== "all" && it.levelEstimate !== levelFilter) return false;
      if (!q) return true;
      return (
        it.displayWord.toLowerCase().includes(q) ||
        it.lemma.toLowerCase().includes(q) ||
        it.normalizedKey.toLowerCase().includes(q) ||
        it.zhMeaning.toLowerCase().includes(q) ||
        it.deExplanation.toLowerCase().includes(q) ||
        (it.userDeepNote?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, levelFilter, query, statusFilter, timeTab]);

  const timeTabCounts = useMemo(() => {
    let all = 0;
    let today = 0;
    let todayNew = 0;
    let todayRepeat = 0;
    let yesterday = 0;
    let recent3 = 0;
    let week = 0;
    const weekStart = startOfCurrentWeek();
    for (const it of items) {
      all += 1;
      const diff = dayDiffFromToday(it.learnedAt);
      if (it.inTodayTab) {
        today += 1;
        if (it.todayTag === "new") todayNew += 1;
        if (it.todayTag === "repeat") todayRepeat += 1;
      }
      if (diff === 1) yesterday += 1;
      if (diff !== null && diff >= 0 && diff <= 2) recent3 += 1;
      if (it.learnedAt) {
        const d = new Date(it.learnedAt);
        if (!Number.isNaN(d.getTime()) && startOfDay(d) >= weekStart) week += 1;
      }
    }
    return { all, today, todayNew, todayRepeat, yesterday, recent3, week };
  }, [items]);

  const weeklyReviewStats = useMemo(() => {
    const weekStart = startOfCurrentWeek();
    let weekTotal = 0;
    let learning = 0;
    let mastered = 0;
    let ignored = 0;
    for (const it of items) {
      if (!it.learnedAt) continue;
      const d = new Date(it.learnedAt);
      if (Number.isNaN(d.getTime()) || startOfDay(d) < weekStart) continue;
      weekTotal += 1;
      if (it.status === "learning") learning += 1;
      if (it.status === "mastered") mastered += 1;
      if (it.status === "ignored") ignored += 1;
    }
    return { weekTotal, learning, mastered, ignored };
  }, [items]);

  async function setVocabularyStatus(itemId: string, status: MasteryStatus) {
    if (!session?.user?.id) return;
    setStatusActionError(null);
    setStatusSavingItemId(itemId);
    try {
      const sb = getSupabaseBrowserClient();
      const { error: updateError } = await updateVocabularyItemMastery(
        sb,
        session.user.id,
        itemId,
        status,
      );
      if (updateError) {
        setStatusActionError(updateError);
        return;
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                status: uiStatusFromMastery(status),
                updatedAtLabel: toLocaleTimeLabel(new Date().toISOString()),
              }
            : item,
        ),
      );
    } finally {
      setStatusSavingItemId(null);
    }
  }

  if (session === undefined || loading) {
    return <p className="text-sm text-zinc-500">加载词库中…</p>;
  }

  if (!session?.user) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">总词库</h1>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">请先登录后查看您的全局词库。</p>
        <Link href={loginHref} className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">
          去登录 →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">总词库</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          汇总当前账号在所有文章中保存的词汇，可调整学习状态。后续可扩展复习、批量状态管理与编辑。
        </p>
      </div>

      <Card className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => {
              setTimeTab("week");
              setStatusFilter("all");
            }}
            className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 text-left transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/40 dark:hover:bg-zinc-800/70"
          >
            <p className="text-xs text-zinc-500">本周新增</p>
            <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {weeklyReviewStats.weekTotal}
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              setTimeTab("week");
              setStatusFilter("learning");
            }}
            className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 text-left transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/40 dark:hover:bg-zinc-800/70"
          >
            <p className="text-xs text-zinc-500">学习中</p>
            <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {weeklyReviewStats.learning}
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              setTimeTab("week");
              setStatusFilter("mastered");
            }}
            className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 text-left transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/40 dark:hover:bg-zinc-800/70"
          >
            <p className="text-xs text-zinc-500">已掌握</p>
            <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {weeklyReviewStats.mastered}
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              setTimeTab("week");
              setStatusFilter("ignored");
            }}
            className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 text-left transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/40 dark:hover:bg-zinc-800/70"
          >
            <p className="text-xs text-zinc-500">暂忽略</p>
            <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {weeklyReviewStats.ignored}
            </p>
          </button>
        </div>
        <div className="inline-flex rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
          {[
            { id: "all", label: `全部单词（${timeTabCounts.all}）` },
            {
              id: "today",
              label: `今日词汇记录（${timeTabCounts.today}）`,
            },
            { id: "yesterday", label: `昨日单词（${timeTabCounts.yesterday}）` },
            { id: "recent3", label: `近三日单词（${timeTabCounts.recent3}）` },
            { id: "week", label: `本周单词（${timeTabCounts.week}）` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTimeTab(tab.id as TimeTab)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                timeTab === tab.id
                  ? "bg-emerald-600 text-white"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {timeTab === "today" ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            新增生词 {timeTabCounts.todayNew} 个 · 再次遇到 {timeTabCounts.todayRepeat}{" "}
            个（本地日历日 + occurrence / 主词条创建时间）
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索词条 / lemma / 解释"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | UiStatus)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="all">全部状态</option>
            <option value="learning">学习中</option>
            <option value="mastered">已掌握</option>
            <option value="ignored">暂忽略</option>
          </select>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as "all" | CefrLevel)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {LEVEL_FILTERS.map((lv) => (
              <option key={lv} value={lv}>
                {lv === "all" ? "全部等级" : lv}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
          <p className="font-medium">读取词库失败</p>
          <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-xs">{error}</pre>
        </div>
      ) : null}

      {statusActionError ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          <p className="font-medium">词汇状态保存失败</p>
          <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-xs">
            {statusActionError}
          </pre>
        </div>
      ) : null}

      {!error && filteredItems.length === 0 ? (
        <Card>
          <CardTitle className="text-base">当前时间分组暂无单词。</CardTitle>
          <CardDescription className="mt-1">
            可切换到其他时间分组，或继续阅读并保存新词汇。
          </CardDescription>
        </Card>
      ) : null}

      <div className="space-y-3">
        {filteredItems.map((v) => (
          <Card key={v.id} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{v.lemma || v.displayWord}</CardTitle>
              <Badge tone="muted">{v.partOfSpeech}</Badge>
              <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="sr-only">状态</span>
                <select
                  value={v.status}
                  disabled={statusSavingItemId === v.id}
                  onChange={(e) => {
                    const value = e.currentTarget.value as UiStatus;
                    const nextStatus: MasteryStatus =
                      value === "learning" ? "new" : value;
                    void setVocabularyStatus(v.id, nextStatus);
                  }}
                  className="h-7 rounded-md border border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-800 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <option value="learning">学习中</option>
                  <option value="mastered">已掌握</option>
                  <option value="ignored">暂忽略</option>
                </select>
              </label>
              {statusSavingItemId === v.id ? (
                <span className="text-xs text-zinc-500">保存中…</span>
              ) : null}
              {timeTab === "today" && v.todayTag === "new" ? (
                <Badge tone="success">新增</Badge>
              ) : null}
              {timeTab === "today" && v.todayTag === "repeat" ? (
                <Badge tone="warning">再遇</Badge>
              ) : null}
              <Badge tone="default">{v.source}</Badge>
              {v.levelEstimate !== "—" ? <Badge tone="warning">{v.levelEstimate}</Badge> : null}
            </div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              <span className="text-xs text-zinc-500">词典形式 · </span>
              {v.lemma || v.displayWord}
            </p>
            {v.originalForm && v.originalForm !== (v.lemma || v.displayWord) ? (
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                <span className="text-xs text-zinc-500">原文形式 · </span>
                {v.originalForm}
              </p>
            ) : null}
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{v.zhMeaning}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{v.deExplanation}</p>
            {v.userDeepNote ? (
              <details className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
                <summary className="cursor-pointer text-xs font-medium text-amber-900 dark:text-amber-200">
                  我的深度笔记
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                  {normalizeDeepNoteMarkdown(v.userDeepNote)}
                </p>
              </details>
            ) : null}
            <p className="text-xs text-zinc-500">
              学习时间：{v.learnedAtLabel} · 出现次数：{v.occurrenceCount} · 最近更新：{v.updatedAtLabel}
            </p>
            {v.sourceArticles.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-zinc-500">来源文章：</span>
                {v.sourceArticles.map((a) => (
                  <Link
                    key={a.id}
                    href={{
                      pathname: `/articles/${a.id}`,
                      query: {
                        focus: "vocab",
                        vocabItemId: v.id,
                        ...(a.occurrenceId ? { occurrenceId: a.occurrenceId } : {}),
                      },
                    }}
                    className="rounded-md bg-zinc-100 px-2 py-1 text-zinc-700 hover:underline dark:bg-zinc-800 dark:text-zinc-200"
                  >
                    {a.title}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                来源文章：{v.occurrenceCount > 0 ? "原文已被用户删除" : "—"}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function VocabularyPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">加载词库中…</p>}>
      <VocabularyPageContent />
    </Suspense>
  );
}
