"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { PronunciationButton } from "@/components/PronunciationButton";
import { useAuthEntryHrefs } from "@/lib/auth/use-auth-entry-hrefs";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useLearningLanguage } from "@/lib/language/useLearningLanguage";
import { formatSupabaseOrUnknownError } from "@/lib/supabase/errors";
import { selectInChunks } from "@/lib/supabase/inChunks";
import { updateVocabularyItemMastery } from "@/lib/supabase/vocabulary";
import { vocabularyHeadwordDe } from "@/lib/vocabulary/grammaticalGender";
import {
  applyReviewAnswer,
  buildReviewQueue,
  countReviewBuckets,
  DEFAULT_SESSION_SIZE,
  loadReviewState,
  pruneReviewState,
  removeFromReview,
  saveReviewState,
  type ReviewState,
} from "@/lib/review/reviewQueue";

type ReviewItem = {
  id: string;
  lemma: string | null;
  display_word: string | null;
  zh_meaning: string | null;
  simple_de_explanation: string | null;
  gender: string | null;
  part_of_speech: string | null;
  last_seen_at: string | null;
};

type OccurrenceRow = {
  vocabulary_item_id: string;
  sentence: string | null;
  surface_form: string | null;
  article_id: string;
  created_at: string | null;
};

const LEARNING_STATUSES = ["new", "learning", "familiar"] as const;
const PAGE = 1000;

/** 例句里把本词标出来（按原文形式不区分大小写匹配第一处） */
function highlightSentence(sentence: string, surface: string | null) {
  const s = (surface ?? "").trim();
  if (!s) return <>{sentence}</>;
  const idx = sentence.toLocaleLowerCase("de-DE").indexOf(s.toLocaleLowerCase("de-DE"));
  if (idx < 0) return <>{sentence}</>;
  return (
    <>
      {sentence.slice(0, idx)}
      <mark className="rounded bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-500/30">
        {sentence.slice(idx, idx + s.length)}
      </mark>
      {sentence.slice(idx + s.length)}
    </>
  );
}

function ReviewPageContent() {
  const { loginHref } = useAuthEntryHrefs();
  /** 只复习当前学习语言的词；排期按语言分开存 */
  const { language, ready: languageReady } = useLearningLanguage();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [occByItem, setOccByItem] = useState<Map<string, OccurrenceRow>>(new Map());
  const [reviewState, setReviewState] = useState<ReviewState>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [queue, setQueue] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tally, setTally] = useState({ good: 0, again: 0, mastered: 0 });

  const refreshSession = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    const {
      data: { session: s },
    } = await sb.auth.getSession();
    setSession(s);
  }, []);

  useEffect(() => {
    void refreshSession();
    const sb = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange(() => void refreshSession());
    return () => subscription.unsubscribe();
  }, [refreshSession]);

  useEffect(() => {
    if (session === undefined || !languageReady) return;
    const userId = session?.user?.id;
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setQueue(null);
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const sb = getSupabaseBrowserClient();
        const rows: ReviewItem[] = [];
        for (let from = 0; ; from += PAGE) {
          const { data, error: e } = await sb
            .from("vocabulary_items")
            .select(
              "id,lemma,display_word,zh_meaning,simple_de_explanation,gender,part_of_speech,last_seen_at",
            )
            .eq("user_id", userId)
            .eq("language", language)
            .in("mastery_status", [...LEARNING_STATUSES])
            .order("id", { ascending: true })
            .range(from, from + PAGE - 1);
          if (e) throw e;
          const batch = (data ?? []) as ReviewItem[];
          rows.push(...batch);
          if (batch.length < PAGE) break;
        }
        if (cancelled) return;
        const learningIds = new Set(rows.map((r) => r.id));
        const state = pruneReviewState(loadReviewState(userId, language), learningIds);
        saveReviewState(userId, state, language);
        setItems(rows);
        setReviewState(state);
      } catch (e) {
        if (!cancelled) setError(formatSupabaseOrUnknownError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, language, languageReady]);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const candidates = useMemo(
    () => items.map((i) => ({ id: i.id, lastSeenAt: i.last_seen_at })),
    [items],
  );
  const buckets = useMemo(
    () => countReviewBuckets(candidates, reviewState, new Date()),
    [candidates, reviewState],
  );

  async function startSession() {
    const userId = session?.user?.id;
    if (!userId) return;
    const ids = buildReviewQueue(candidates, reviewState, new Date(), DEFAULT_SESSION_SIZE);
    setTally({ good: 0, again: 0, mastered: 0 });
    setIndex(0);
    setRevealed(false);
    setQueue(ids);
    if (!ids.length) return;
    try {
      const sb = getSupabaseBrowserClient();
      const occs = await selectInChunks<OccurrenceRow>(ids, (chunk) =>
        sb
          .from("vocabulary_occurrences")
          .select("vocabulary_item_id,sentence,surface_form,article_id,created_at")
          .eq("user_id", userId)
          .in("vocabulary_item_id", chunk),
      );
      const latest = new Map<string, OccurrenceRow>();
      for (const o of occs) {
        if (!o.sentence) continue;
        const prev = latest.get(o.vocabulary_item_id);
        if (!prev || String(o.created_at) > String(prev.created_at)) {
          latest.set(o.vocabulary_item_id, o);
        }
      }
      setOccByItem(latest);
    } catch {
      /* 例句只是辅助，读取失败不影响复习 */
    }
  }

  function persist(next: ReviewState) {
    const userId = session?.user?.id;
    if (userId) saveReviewState(userId, next, language);
    setReviewState(next);
  }

  function advance() {
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  function answer(kind: "again" | "good") {
    if (!queue) return;
    const id = queue[index];
    persist(applyReviewAnswer(reviewState, id, kind, new Date()));
    setTally((t) => ({ ...t, [kind]: t[kind] + 1 }));
    advance();
  }

  async function markMastered() {
    const userId = session?.user?.id;
    if (!queue || !userId) return;
    const id = queue[index];
    setSaving(true);
    setError(null);
    const { error: e } = await updateVocabularyItemMastery(
      getSupabaseBrowserClient(),
      userId,
      id,
      "mastered",
    );
    setSaving(false);
    if (e) {
      setError(`标记已掌握失败：${e}`);
      return;
    }
    persist(removeFromReview(reviewState, id));
    setItems((prev) => prev.filter((i) => i.id !== id));
    setTally((t) => ({ ...t, mastered: t.mastered + 1 }));
    advance();
  }

  if (session === undefined || loading) {
    return <p className="text-sm text-zinc-500">加载复习词汇中…</p>;
  }

  if (!session?.user) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">复习</h1>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">请先登录后复习您的词汇。</p>
        <Link
          href={loginHref}
          className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          去登录 →
        </Link>
      </div>
    );
  }

  const inSession = queue !== null && index < queue.length;
  const finished = queue !== null && index >= queue.length;
  const current = inSession ? itemById.get(queue[index]) : undefined;
  const occ = current ? occByItem.get(current.id) : undefined;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">复习</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          复习总词库里「学习中」的词：先看德语和例句回想意思，再翻面核对。「已掌握」会写入总词库，以后不再推荐。
        </p>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30">
          <CardDescription className="text-red-800 dark:text-red-200">{error}</CardDescription>
        </Card>
      ) : null}

      {!inSession && !finished ? (
        <Card className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {buckets.due}
              </p>
              <p className="text-xs text-zinc-500">今天到期</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {buckets.fresh}
              </p>
              <p className="text-xs text-zinc-500">还没复习过</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {buckets.later}
              </p>
              <p className="text-xs text-zinc-500">以后再复习</p>
            </div>
          </div>
          {buckets.due + buckets.fresh > 0 ? (
            <Button className="w-full" onClick={() => void startSession()}>
              开始复习（每组最多 {DEFAULT_SESSION_SIZE} 个）
            </Button>
          ) : (
            <CardDescription>
              {items.length === 0
                ? "总词库里还没有「学习中」的词。去读文章、保存词汇后再来。"
                : "今天没有需要复习的词了，明天再来。"}
            </CardDescription>
          )}
        </Card>
      ) : null}

      {inSession && current ? (
        <Card className="space-y-5">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span className="tabular-nums">
              {index + 1} / {queue!.length}
            </span>
            <button
              type="button"
              onClick={() => setQueue(null)}
              className="hover:underline"
            >
              结束本组
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-2xl">
              {vocabularyHeadwordDe(current.display_word, current.lemma, current.gender)}
            </CardTitle>
            <PronunciationButton
              text={vocabularyHeadwordDe(current.display_word, current.lemma, current.gender)}
              size="sm"
            />
          </div>

          {occ?.sentence ? (
            <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {highlightSentence(occ.sentence, occ.surface_form)}
            </p>
          ) : null}

          {revealed ? (
            <div className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <p className="text-base text-zinc-900 dark:text-zinc-100">
                {current.zh_meaning || "（暂无中文释义）"}
              </p>
              {current.simple_de_explanation ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {current.simple_de_explanation}
                </p>
              ) : null}
              {occ?.article_id ? (
                <Link
                  href={{
                    pathname: `/articles/${occ.article_id}`,
                    query: { focus: "vocab", vocabItemId: current.id },
                  }}
                  className="inline-block text-xs text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  查看原文 →
                </Link>
              ) : null}
            </div>
          ) : null}

          {revealed ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <Button variant="secondary" onClick={() => answer("again")} disabled={saving}>
                还不熟（明天再来）
              </Button>
              <Button onClick={() => answer("good")} disabled={saving}>
                记住了
              </Button>
              <Button variant="ghost" onClick={() => void markMastered()} disabled={saving}>
                {saving ? "保存中…" : "已掌握，不再推荐"}
              </Button>
            </div>
          ) : (
            <Button className="w-full" onClick={() => setRevealed(true)}>
              显示释义
            </Button>
          )}
        </Card>
      ) : null}

      {inSession && !current ? (
        <Card>
          <CardDescription>这个词已不在学习中，跳过。</CardDescription>
          <Button className="mt-3" onClick={advance}>
            下一个
          </Button>
        </Card>
      ) : null}

      {finished ? (
        <Card className="space-y-4">
          <CardTitle>本组完成</CardTitle>
          <CardDescription>
            记住了 {tally.good} 个 · 还不熟 {tally.again} 个 · 标为已掌握 {tally.mastered} 个。
            「还不熟」的词明天会再出现；「记住了」的间隔会逐步拉长（1 → 3 → 7 → 14 → 30 天）。
          </CardDescription>
          <div className="flex gap-2">
            {buckets.due + buckets.fresh > 0 ? (
              <Button onClick={() => void startSession()}>再来一组</Button>
            ) : null}
            <Button variant="secondary" onClick={() => setQueue(null)}>
              返回
            </Button>
          </div>
        </Card>
      ) : null}

      <p className="text-xs text-zinc-500">
        复习排期保存在当前浏览器；换设备会重新开始排期，但「已掌握」写入总词库，所有设备一致。
      </p>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">加载复习词汇中…</p>}>
      <ReviewPageContent />
    </Suspense>
  );
}
