"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { InteractiveArticleReader } from "@/components/InteractiveArticleReader";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { mockAnalyzeArticle } from "@/lib/articleAnalysis/mockAnalyzeArticle";
import {
  convertAnalysisResultToArticleItems,
  listRealAiEntriesWithoutTextMatch,
} from "@/lib/articleAnalysis/convertAnalysisToArticleItems";
import type { ArticleAnalysisResult } from "@/lib/articleAnalysis/types";
import type {
  ArticleGrammarItem,
  ArticleVocabItem,
} from "@/lib/articleReadingTypes";
import {
  buildPlainTextArticleLayout,
  expandGrammarItemsWithRepeatedSurface,
  finalizeArticleVocabularyItems,
} from "@/lib/articleReadingModel";
import type { CefrLevel, MasteryStatus } from "@/lib/types";
import type { ArticleRow } from "@/lib/supabase/articles";
import {
  fetchArticleManualGrammar,
  persistManualGrammarItem,
} from "@/lib/supabase/grammar";
import {
  fetchArticleManualVocabulary,
  persistManualVocabularyItem,
} from "@/lib/supabase/vocabulary";
import {
  isValidArticleId,
  normalizeReadingQuestionsFromDb,
} from "@/lib/supabase/articles";
import {
  displayGrammaticalGenderLabelZh,
  shouldShowGrammaticalGenderSubtitle,
  vocabularyHeadwordDe,
} from "@/lib/vocabulary/grammaticalGender";
import { loginPageHref } from "@/lib/auth/post-auth-redirect";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatSupabaseOrUnknownError } from "@/lib/supabase/errors";

const IS_DEV = process.env.NODE_ENV === "development";

const CONFIRM_AI_REGENERATE_ZH =
  "这会再次调用 AI，并可能产生费用。确定重新生成吗？";

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

function articleAnalysisLevel(raw: string | null | undefined): CefrLevel {
  const u = (raw ?? "B1").trim().toUpperCase();
  if (
    u === "A1" ||
    u === "A2" ||
    u === "B1" ||
    u === "B2" ||
    u === "C1" ||
    u === "C2"
  ) {
    return u;
  }
  return "B1";
}

function aiCandidateStatusLabel(status: MasteryStatus): string {
  if (status === "mastered") return "已掌握";
  if (status === "ignored") return "暂忽略";
  return "学习中";
}

function normalizeAiCandidateKey(value: string): string {
  return value.trim().toLocaleLowerCase("de-DE").replace(/\s+/g, " ");
}

function aiVocabularyCandidateKey(item: {
  normalized_key?: string | null;
  surface_form?: string | null;
  display_word?: string | null;
}): string {
  return normalizeAiCandidateKey(
    item.normalized_key || item.surface_form || item.display_word || "",
  );
}

function aiGrammarCandidateKey(item: {
  grammar_key?: string | null;
  selected_text?: string | null;
  normalized_key?: string | null;
}): string {
  return normalizeAiCandidateKey(
    item.grammar_key || item.normalized_key || item.selected_text || "",
  );
}

function ArticleDetailPageContent() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const loginHref = loginPageHref(
    pathname,
    searchParams.toString(),
    searchParams.get("next"),
  );
  const rawId = typeof params.id === "string" ? params.id : "";
  const id = rawId.trim();

  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [article, setArticle] = useState<ArticleRow | null>(null);
  const [loadState, setLoadState] = useState<
    "idle" | "loading" | "not_found" | "error"
  >("idle");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [asideData, setAsideData] = useState<{
    vocabulary: ArticleVocabItem[];
    grammar: ArticleGrammarItem[];
  } | null>(null);
  const [asideLoadError, setAsideLoadError] = useState<string | null>(null);
  /** 每次成功从 Supabase 合并本篇词汇/语法后递增，用于强制阅读器 remount 以同步 props（内部 state 仅用 initial 一次） */
  const [asideSnapshotVersion, setAsideSnapshotVersion] = useState(0);
  const asideFetchSeq = useRef(0);
  const [persistMessage, setPersistMessage] = useState<string | null>(null);
  const [deleteRunning, setDeleteRunning] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /** Phase 3.5：Mock 仅开发调试，仅存本地 state，不写 Supabase、不覆盖真实 AI */
  const [mockStaging, setMockStaging] = useState<{
    vocabulary: ArticleVocabItem[];
    grammar: ArticleGrammarItem[];
  } | null>(null);
  const [mockRunning, setMockRunning] = useState(false);
  const [aiAnalysisExtras, setAiAnalysisExtras] = useState<{
    summary_zh: string;
    summary_de_simple: string;
    reading_questions: string[];
  } | null>(null);

  /** Phase 3.1：真实 OpenAI 仅预览，不入库、不覆盖 Mock */
  const [realAiRunning, setRealAiRunning] = useState(false);
  const [realAiPreview, setRealAiPreview] = useState<ArticleAnalysisResult | null>(
    null,
  );
  const [realAiWarning, setRealAiWarning] = useState<string | null>(null);
  const [realAiError, setRealAiError] = useState<string | null>(null);
  const realAiPreviewRef = useRef<HTMLDivElement>(null);
  const [realAiSaving, setRealAiSaving] = useState(false);
  const [realAiSavedToLibrary, setRealAiSavedToLibrary] = useState(false);
  const [realAiSaveError, setRealAiSaveError] = useState<string | null>(null);
  const [realAiSaveInfo, setRealAiSaveInfo] = useState<string | null>(null);
  const [realAiRemovedVocabularyIndexes, setRealAiRemovedVocabularyIndexes] =
    useState<Set<number>>(() => new Set());
  const [realAiRemovedGrammarIndexes, setRealAiRemovedGrammarIndexes] = useState<
    Set<number>
  >(() => new Set());
  const [realAiVocabularyStatusByIndex, setRealAiVocabularyStatusByIndex] =
    useState<Record<number, MasteryStatus>>({});
  const [realAiGrammarStatusByIndex, setRealAiGrammarStatusByIndex] = useState<
    Record<number, MasteryStatus>
  >({});

  useEffect(() => {
    setMockStaging(null);
    setAiAnalysisExtras(null);
    setMockRunning(false);
    setRealAiPreview(null);
    setRealAiSavedToLibrary(false);
    setRealAiError(null);
    setRealAiWarning(null);
    setRealAiSaveError(null);
    setRealAiSaveInfo(null);
    setRealAiRunning(false);
    setRealAiRemovedVocabularyIndexes(new Set());
    setRealAiRemovedGrammarIndexes(new Set());
    setRealAiVocabularyStatusByIndex({});
    setRealAiGrammarStatusByIndex({});
  }, [id]);

  const refreshSession = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    setSession(s);
    return s;
  }, []);

  useEffect(() => {
    void refreshSession();
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshSession();
    });
    return () => subscription.unsubscribe();
  }, [refreshSession]);

  useEffect(() => {
    if (session === undefined) {
      return;
    }
    if (!session?.user) {
      setLoadState("idle");
      setArticle(null);
      return;
    }

    if (!id || !isValidArticleId(id)) {
      setLoadState("not_found");
      setArticle(null);
      return;
    }

    let cancelled = false;
    setLoadState("loading");
    setLoadError(null);

    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("articles")
          .select(
            "id,user_id,title,url,source_name,original_text,summary_zh,summary_de_simple,reading_questions,user_level_at_analysis,detected_article_level,topic,created_at,updated_at",
          )
          .eq("id", id)
          .maybeSingle();

        if (cancelled) {
          return;
        }

        if (error) {
          throw error;
        }

        if (!data) {
          setArticle(null);
          setLoadState("not_found");
          return;
        }

        setArticle(data as ArticleRow);
        setLoadState("idle");
      } catch (e) {
        if (cancelled) {
          return;
        }
        setLoadError(formatSupabaseOrUnknownError(e));
        setArticle(null);
        setLoadState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, id]);

  const articleTextForLayout = useMemo(() => {
    const title = article?.title?.trim();
    const body = article?.original_text ?? "";
    if (title) return `${title}\n\n${body}`;
    return body;
  }, [article?.title, article?.original_text]);

  const { articlePlain, chunkIntervals } = useMemo(
    () => buildPlainTextArticleLayout(articleTextForLayout),
    [articleTextForLayout],
  );

  const analysisLevel = useMemo(
    () => articleAnalysisLevel(article?.user_level_at_analysis),
    [article?.user_level_at_analysis],
  );

  const initialReaderFocus = useMemo(() => {
    const focus = searchParams.get("focus");
    const occurrenceId = searchParams.get("occurrenceId")?.trim() || undefined;
    if (focus === "vocab") {
      const itemId = searchParams.get("vocabItemId")?.trim() || undefined;
      if (!itemId && !occurrenceId) return undefined;
      return { kind: "vocab" as const, itemId, occurrenceId };
    }
    if (focus === "grammar") {
      const itemId = searchParams.get("grammarItemId")?.trim() || undefined;
      if (!itemId && !occurrenceId) return undefined;
      return { kind: "grammar" as const, itemId, occurrenceId };
    }
    return undefined;
  }, [searchParams]);

  const mergedVocabulary = useMemo(() => {
    const base = asideData?.vocabulary ?? [];
    const extra = mockStaging?.vocabulary ?? [];
    if (!extra.length) return base;
    const finalizedExtra = finalizeArticleVocabularyItems(extra, articlePlain);
    return [...base, ...finalizedExtra];
  }, [asideData, mockStaging, articlePlain]);

  const mergedGrammar = useMemo(() => {
    const base = asideData?.grammar ?? [];
    const extra = mockStaging?.grammar ?? [];
    if (!extra.length) return base;
    const expandedExtra = expandGrammarItemsWithRepeatedSurface(
      extra,
      articlePlain,
    );
    return [...base, ...expandedExtra];
  }, [asideData, mockStaging, articlePlain]);

  const hasPersistedAiArticleFields = useMemo(() => {
    if (!article) return false;
    const qsDb = normalizeReadingQuestionsFromDb(article.reading_questions);
    return (
      Boolean((article.summary_zh?.trim() ?? "").length) ||
      Boolean((article.summary_de_simple?.trim() ?? "").length) ||
      qsDb.length > 0
    );
  }, [article]);

  /** 已有任意保存的整文级 AI 结果时，主按钮视为「重新分析」，须确认后再调 API（Phase 3.14） */
  const hasSavedArticleAiBaseline = useMemo(() => {
    if (hasPersistedAiArticleFields) return true;
    if (asideData === null) return false;
    return (
      asideData.vocabulary.length > 0 || asideData.grammar.length > 0
    );
  }, [asideData, hasPersistedAiArticleFields]);

  const showRealAiSavedStatus =
    realAiSavedToLibrary || hasPersistedAiArticleFields;

  /** 摘要 / 阅读问题 Tab：已保存 AI 结果 > 当前预览 > Mock */
  const summaryAndQuestionsForTabs = useMemo(() => {
    if (!article) return null;
    const qsDb = normalizeReadingQuestionsFromDb(article.reading_questions);
    const hasSaved =
      Boolean((article.summary_zh?.trim() ?? "").length) ||
      Boolean((article.summary_de_simple?.trim() ?? "").length) ||
      qsDb.length > 0;
    if (hasSaved) {
      return {
        summaryZh: article.summary_zh?.trim() ?? "",
        summaryDe: article.summary_de_simple?.trim() ?? "",
        questions: qsDb,
        footerNote: null as string | null,
      };
    }
    if (realAiPreview) {
      return {
        summaryZh: realAiPreview.summary_zh,
        summaryDe: realAiPreview.summary_de_simple,
        questions: [...realAiPreview.reading_questions],
        footerNote: null as string | null,
      };
    }
    if (aiAnalysisExtras) {
      return {
        summaryZh: aiAnalysisExtras.summary_zh,
        summaryDe: aiAnalysisExtras.summary_de_simple,
        questions: [...aiAnalysisExtras.reading_questions],
        footerNote:
          "Phase 3.0：以上为本地 Mock，未调用 OpenAI API。" as string | null,
      };
    }
    return null;
  }, [article, realAiPreview, aiAnalysisExtras]);

  const loadAsideLearningData = useCallback(
    async (opts: { resetBeforeFetch: boolean; allowClearOnError: boolean }) => {
      if (!session?.user?.id || !article?.id) return;
      const seq = ++asideFetchSeq.current;
      if (opts.resetBeforeFetch) {
        setAsideData(null);
        setAsideLoadError(null);
      }
      try {
        const supabase = getSupabaseBrowserClient();
        const [v, g] = await Promise.all([
          fetchArticleManualVocabulary(supabase, article.id),
          fetchArticleManualGrammar(supabase, article.id),
        ]);
        if (seq !== asideFetchSeq.current) return;
        setAsideData({
          vocabulary: finalizeArticleVocabularyItems(v, articlePlain),
          grammar: expandGrammarItemsWithRepeatedSurface(g, articlePlain),
        });
        setAsideLoadError(null);
        setAsideSnapshotVersion((n) => n + 1);
      } catch (e) {
        if (seq !== asideFetchSeq.current) return;
        setAsideLoadError(formatSupabaseOrUnknownError(e));
        if (opts.allowClearOnError) {
          setAsideData({ vocabulary: [], grammar: [] });
        }
      }
    },
    [article, articlePlain, session?.user?.id],
  );

  useEffect(() => {
    if (!session?.user?.id || !article?.id) {
      setAsideData(null);
      setAsideLoadError(null);
      return;
    }
    void loadAsideLearningData({
      resetBeforeFetch: true,
      allowClearOnError: true,
    });
  }, [session?.user?.id, article?.id, articlePlain, loadAsideLearningData]);

  /** 重新进入标签页、从 bfcache 恢复或窗口聚焦时后台刷新本篇词汇/语法（失败仅提示，不清空已有 UI） */
  useEffect(() => {
    if (!session?.user?.id || !article?.id) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void loadAsideLearningData({
          resetBeforeFetch: false,
          allowClearOnError: false,
        });
      }, 200);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") scheduleReload();
    };

    const onPageShow = (ev: PageTransitionEvent) => {
      if (ev.persisted) scheduleReload();
    };

    window.addEventListener("focus", scheduleReload);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      window.removeEventListener("focus", scheduleReload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [article?.id, session?.user?.id, loadAsideLearningData]);

  const handleMockAnalyze = useCallback(async () => {
    if (!IS_DEV || !session?.user?.id || !article?.id || mockRunning) return;
    setMockRunning(true);
    try {
      const level = articleAnalysisLevel(article.user_level_at_analysis);
      const result = mockAnalyzeArticle({
        title: article.title ?? "",
        originalText: article.original_text ?? "",
        userLevel: level,
      });
      setAiAnalysisExtras({
        summary_zh: result.summary_zh,
        summary_de_simple: result.summary_de_simple,
        reading_questions: result.reading_questions,
      });
      const { vocabulary: v0, grammar: g0 } =
        convertAnalysisResultToArticleItems(result, articlePlain);
      const fv = finalizeArticleVocabularyItems(v0, articlePlain);
      const fg = expandGrammarItemsWithRepeatedSurface(g0, articlePlain);
      setMockStaging({ vocabulary: fv, grammar: fg });
      setAsideSnapshotVersion((n) => n + 1);
    } finally {
      setMockRunning(false);
    }
  }, [article, articlePlain, mockRunning, session?.user?.id]);

  const runRealAiAnalysis = useCallback(async () => {
    if (!session?.user?.id || !article?.id || realAiRunning) return;
    setRealAiRunning(true);
    setRealAiError(null);
    setRealAiWarning(null);
    try {
      const level = articleAnalysisLevel(article.user_level_at_analysis);
      const res = await fetch("/api/analyze-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: article.id,
          title: article.title ?? "",
          originalText: article.original_text ?? "",
          userLevel: level,
        }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!data || typeof data !== "object") {
        setRealAiError("无法解析服务器响应");
        return;
      }
      const o = data as Record<string, unknown>;
      if (o.ok === true && o.analysis && typeof o.analysis === "object") {
        setRealAiPreview(o.analysis as ArticleAnalysisResult);
        setRealAiSavedToLibrary(false);
        setRealAiSaveError(null);
        setRealAiSaveInfo(null);
        setRealAiRemovedVocabularyIndexes(new Set());
        setRealAiRemovedGrammarIndexes(new Set());
        setRealAiVocabularyStatusByIndex({});
        setRealAiGrammarStatusByIndex({});
        setRealAiWarning(
          typeof o.warning === "string" && o.warning.trim()
            ? o.warning.trim()
            : null,
        );
        return;
      }
      if (o.ok === false) {
        if (o.error && typeof o.error === "object") {
          const err = o.error as Record<string, unknown>;
          const raw = err.message;
          const msg =
            typeof raw === "string"
              ? raw
              : raw != null
                ? formatSupabaseOrUnknownError(raw)
                : `请求失败（HTTP ${res.status}）`;
          setRealAiError(msg);
          return;
        }
        if (typeof o.error === "string" && o.error.trim()) {
          setRealAiError(o.error.trim());
          return;
        }
      }
      setRealAiError(`请求失败（HTTP ${res.status}）`);
    } catch (e: unknown) {
      setRealAiError(formatSupabaseOrUnknownError(e));
    } finally {
      setRealAiRunning(false);
    }
  }, [article, realAiRunning, session?.user?.id]);

  const handlePrimaryRealAiClick = useCallback(() => {
    if (realAiPreview) {
      realAiPreviewRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
      return;
    }
    if (
      hasSavedArticleAiBaseline &&
      typeof window !== "undefined" &&
      !window.confirm(CONFIRM_AI_REGENERATE_ZH)
    ) {
      return;
    }
    void runRealAiAnalysis();
  }, [hasSavedArticleAiBaseline, realAiPreview, runRealAiAnalysis]);

  const handleRealAiReanalyze = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(CONFIRM_AI_REGENERATE_ZH)
    ) {
      return;
    }
    void runRealAiAnalysis();
  }, [runRealAiAnalysis]);

  const editableRealAiVocabulary = useMemo(() => {
    if (!realAiPreview) return [];
    return realAiPreview.vocabulary
      .map((item, index) => ({
        item,
        index,
        status: realAiVocabularyStatusByIndex[index] ?? "new" as MasteryStatus,
      }))
      .filter(({ index }) => !realAiRemovedVocabularyIndexes.has(index));
  }, [
    realAiPreview,
    realAiRemovedVocabularyIndexes,
    realAiVocabularyStatusByIndex,
  ]);

  const editableRealAiGrammar = useMemo(() => {
    if (!realAiPreview) return [];
    return realAiPreview.grammar
      .map((item, index) => ({
        item,
        index,
        status: realAiGrammarStatusByIndex[index] ?? "new" as MasteryStatus,
      }))
      .filter(({ index }) => !realAiRemovedGrammarIndexes.has(index));
  }, [realAiGrammarStatusByIndex, realAiPreview, realAiRemovedGrammarIndexes]);

  const filteredRealAiPreview = useMemo<ArticleAnalysisResult | null>(() => {
    if (!realAiPreview) return null;
    return {
      ...realAiPreview,
      vocabulary: editableRealAiVocabulary.map(({ item }) => item),
      grammar: editableRealAiGrammar.map(({ item }) => item),
    };
  }, [editableRealAiGrammar, editableRealAiVocabulary, realAiPreview]);

  const handleRemoveRealAiVocabularyCandidate = useCallback((index: number) => {
    setRealAiRemovedVocabularyIndexes((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  const handleRemoveRealAiGrammarCandidate = useCallback((index: number) => {
    setRealAiRemovedGrammarIndexes((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  const handleRealAiVocabularyStatusChange = useCallback(
    (index: number, status: MasteryStatus) => {
      setRealAiVocabularyStatusByIndex((prev) => ({ ...prev, [index]: status }));
    },
    [],
  );

  const handleRealAiGrammarStatusChange = useCallback(
    (index: number, status: MasteryStatus) => {
      setRealAiGrammarStatusByIndex((prev) => ({ ...prev, [index]: status }));
    },
    [],
  );

  const handleSaveRealAiPreview = useCallback(async () => {
    if (
      !session?.user?.id ||
      !article?.id ||
      !realAiPreview ||
      !filteredRealAiPreview ||
      realAiSaving
    ) {
      return;
    }
    setRealAiSaving(true);
    setRealAiSaveError(null);
    setRealAiSaveInfo(null);
    const unmatched = listRealAiEntriesWithoutTextMatch(
      filteredRealAiPreview,
      articlePlain,
    );
    const skipParts: string[] = [];
    if (unmatched.vocabulary.length) {
      skipParts.push(
        `词汇未在原文中找到，已跳过：${unmatched.vocabulary.join("、")}`,
      );
    }
    if (unmatched.grammar.length) {
      skipParts.push(
        `语法片段未在原文中找到，已跳过：${unmatched.grammar.join("、")}`,
      );
    }
    const skipMessage = skipParts.length ? skipParts.join("\n") : null;

    const vocabStatusByKey = new Map(
      editableRealAiVocabulary.map(({ item, status }) => [
        aiVocabularyCandidateKey(item),
        status,
      ]),
    );
    const grammarStatusByKey = new Map(
      editableRealAiGrammar.map(({ item, status }) => [
        aiGrammarCandidateKey(item),
        status,
      ]),
    );

    const { vocabulary: v0, grammar: g0 } =
      convertAnalysisResultToArticleItems(filteredRealAiPreview, articlePlain, {
        itemSource: "ai",
      });
    const fv = finalizeArticleVocabularyItems(v0, articlePlain).map((item) => ({
      ...item,
      mastery_status:
        vocabStatusByKey.get(aiVocabularyCandidateKey(item)) ??
        item.mastery_status,
    }));
    const fg = expandGrammarItemsWithRepeatedSurface(g0, articlePlain).map(
      (item) => ({
        ...item,
        mastery_status:
          grammarStatusByKey.get(aiGrammarCandidateKey(item)) ??
          item.mastery_status,
      }),
    );

    let firstError: string | null = null;
    try {
      const sb = getSupabaseBrowserClient();
      /** 每次保存都同步当前预览中的词汇/语法（含重新分析后）；勿仅在首次保存时写入，否则 lemma 等无法随再次保存修复 */
      if (fv.length > 0 || fg.length > 0) {
        for (const item of fv) {
          const { error } = await persistManualVocabularyItem(sb, {
            userId: session.user.id,
            articleId: article.id,
            articlePlain,
            item,
          });
          if (error) {
            firstError = firstError ?? `词汇「${item.display_word}」：${error}`;
          }
        }
        for (const item of fg) {
          const { error } = await persistManualGrammarItem(sb, {
            userId: session.user.id,
            articleId: article.id,
            articlePlain,
            item,
          });
          if (error) {
            firstError = firstError ?? `语法「${item.name_zh}」：${error}`;
          }
        }

        if (firstError) {
          setRealAiSaveError(firstError);
          return;
        }

        await loadAsideLearningData({
          resetBeforeFetch: false,
          allowClearOnError: false,
        });
        setAsideSnapshotVersion((n) => n + 1);
        if (skipMessage) {
          setRealAiSaveInfo(skipMessage);
        }
      } else if (!realAiSavedToLibrary) {
        await loadAsideLearningData({
          resetBeforeFetch: false,
          allowClearOnError: false,
        });
        setAsideSnapshotVersion((n) => n + 1);
        if (skipMessage) {
          setRealAiSaveInfo(skipMessage);
        }
      }

      setRealAiSavedToLibrary(true);

      const { error: artUpdErr } = await sb
        .from("articles")
        .update({
          summary_zh: realAiPreview.summary_zh,
          summary_de_simple: realAiPreview.summary_de_simple,
          reading_questions: realAiPreview.reading_questions,
        })
        .eq("id", article.id)
        .eq("user_id", session.user.id);

      if (artUpdErr) {
        setRealAiSaveError(
          `保存摘要与阅读问题失败：${formatSupabaseOrUnknownError(artUpdErr)}`,
        );
        return;
      }

      setArticle((prev) =>
        prev
          ? {
              ...prev,
              summary_zh: realAiPreview.summary_zh,
              summary_de_simple: realAiPreview.summary_de_simple,
              reading_questions: realAiPreview.reading_questions,
            }
          : prev,
      );
    } catch (e: unknown) {
      setRealAiSaveError(formatSupabaseOrUnknownError(e));
    } finally {
      setRealAiSaving(false);
    }
  }, [
    article,
    articlePlain,
    editableRealAiGrammar,
    editableRealAiVocabulary,
    filteredRealAiPreview,
    loadAsideLearningData,
    realAiPreview,
    realAiSavedToLibrary,
    realAiSaving,
    session,
  ]);

  const handleDeleteArticle = useCallback(async () => {
    if (!session?.user?.id || !article?.id || deleteRunning) return;
    const ok =
      typeof window !== "undefined" &&
      window.confirm(
        "确定删除这篇文章吗？这会删除文章正文、摘要、阅读问题，以及本文中的高亮和出现位置。已经保存到词库/语法库的长期学习记录不会自动删除。",
      );
    if (!ok) return;

    setDeleteRunning(true);
    setDeleteError(null);
    try {
      const sb = getSupabaseBrowserClient();

      const { error: vocabOccErr } = await sb
        .from("vocabulary_occurrences")
        .delete()
        .eq("article_id", article.id)
        .eq("user_id", session.user.id);
      if (vocabOccErr) {
        throw new Error(
          `删除词汇出现记录失败：${formatSupabaseOrUnknownError(vocabOccErr)}`,
        );
      }

      const { error: grammarOccErr } = await sb
        .from("grammar_occurrences")
        .delete()
        .eq("article_id", article.id)
        .eq("user_id", session.user.id);
      if (grammarOccErr) {
        throw new Error(
          `删除语法出现记录失败：${formatSupabaseOrUnknownError(grammarOccErr)}`,
        );
      }

      const { error: articleErr } = await sb
        .from("articles")
        .delete()
        .eq("id", article.id)
        .eq("user_id", session.user.id);
      if (articleErr) {
        throw new Error(
          `删除文章失败：${formatSupabaseOrUnknownError(articleErr)}`,
        );
      }

      router.push("/dashboard");
    } catch (e: unknown) {
      setDeleteError(formatSupabaseOrUnknownError(e));
    } finally {
      setDeleteRunning(false);
    }
  }, [article, deleteRunning, router, session]);

  const summaryPanel =
    summaryAndQuestionsForTabs &&
    (summaryAndQuestionsForTabs.summaryZh ||
      summaryAndQuestionsForTabs.summaryDe) ? (
      <div className="space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {summaryAndQuestionsForTabs.summaryZh ? (
          <p>{summaryAndQuestionsForTabs.summaryZh}</p>
        ) : null}
        {summaryAndQuestionsForTabs.summaryDe ? (
          <p className="text-zinc-600 dark:text-zinc-400">
            {summaryAndQuestionsForTabs.summaryDe}
          </p>
        ) : null}
        {summaryAndQuestionsForTabs.footerNote ? (
          <p className="text-xs text-zinc-500">
            {summaryAndQuestionsForTabs.footerNote}
          </p>
        ) : null}
      </div>
    ) : (
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        暂无摘要：可在上方运行真实 AI 分析并保存。
        {IS_DEV ? "（开发环境可在「开发工具」中使用 Mock 预览 UI，不会写入云端。）" : ""}
      </p>
    );

  const questionsPanel =
    summaryAndQuestionsForTabs &&
    summaryAndQuestionsForTabs.questions.length > 0 ? (
      <ol className="list-inside list-decimal space-y-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {summaryAndQuestionsForTabs.questions.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ol>
    ) : (
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        暂无阅读问题：可在上方运行真实 AI 分析并保存。
        {IS_DEV ? "（开发环境可在「开发工具」中使用 Mock 预览 UI，不会写入云端。）" : ""}
      </p>
    );

  const createdLabel = article?.created_at
    ? new Date(article.created_at).toLocaleString("zh-Hans", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

  const aiStatusLabel = useMemo(() => {
    if (realAiSaving) return "保存中…";
    if (realAiError) return "OpenAI API 错误";
    if (realAiRunning && realAiPreview) return "重新分析中…";
    if (realAiRunning) return "分析中…";
    if (realAiPreview) return "已生成 AI 预览，尚未保存";
    if (showRealAiSavedStatus) return "AI 分析结果已保存";
    return "尚未分析";
  }, [
    realAiError,
    realAiPreview,
    realAiRunning,
    realAiSaving,
    showRealAiSavedStatus,
  ]);

  const primaryRealAiButtonLabel =
    realAiRunning && !realAiPreview
      ? "分析中…"
      : realAiPreview
        ? "查看 AI 预览"
        : hasSavedArticleAiBaseline
          ? "重新分析本文（会再次调用 AI）"
          : "AI 分析本文";

  if (session === undefined) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-500">加载中…</p>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          阅读文章
        </h1>
        <Card className="space-y-3">
          <CardTitle className="text-base">需要登录</CardTitle>
          <CardDescription>
            仅登录用户可查看已保存的文章。
          </CardDescription>
          <Link
            href={loginHref}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
          >
            去登录
          </Link>
        </Card>
      </div>
    );
  }

  if (loadState === "loading") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-500">加载文章…</p>
      </div>
    );
  }

  if (loadState === "error" && loadError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          阅读文章
        </h1>
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          <p className="font-medium">加载失败</p>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-sans text-xs">
            {loadError}
          </pre>
        </div>
      </div>
    );
  }

  if (loadState === "not_found" || !article) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          阅读文章
        </h1>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          文章不存在或无权访问。
        </p>
        <Link
          href="/import"
          className="inline-flex text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          返回导入 →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div>
        <p className="text-xs font-medium text-zinc-500">
          <Link href="/dashboard" className="text-emerald-700 hover:underline dark:text-emerald-400">
            仪表盘
          </Link>
          <span className="mx-1 text-zinc-400">/</span>
          阅读
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {article.title ?? "（无标题）"}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            返回仪表盘
          </Link>
          <Button
            type="button"
            variant="secondary"
            className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-200 dark:hover:bg-red-950/30"
            onClick={() => void handleDeleteArticle()}
            disabled={deleteRunning}
          >
            {deleteRunning ? "删除中…" : "删除文章"}
          </Button>
        </div>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {article.source_name ? (
            <div>
              <dt className="text-zinc-500">来源</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">{article.source_name}</dd>
            </div>
          ) : null}
          {article.url ? (
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">链接</dt>
              <dd>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  {article.url}
                </a>
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-zinc-500">分析时水平</dt>
            <dd className="text-zinc-900 dark:text-zinc-100">
              {article.user_level_at_analysis ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">保存时间</dt>
            <dd className="text-zinc-900 dark:text-zinc-100">{createdLabel}</dd>
          </div>
        </dl>
      </div>

      {asideLoadError ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
          role="alert"
        >
          <p className="font-medium">本篇词汇/语法未能从云端加载</p>
          <p className="mt-1 text-xs opacity-90">{asideLoadError}</p>
        </div>
      ) : null}

      {persistMessage ? (
        <div
          className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          <p>{persistMessage}</p>
          <button
            type="button"
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100 dark:text-red-200 dark:hover:bg-red-900/40"
            onClick={() => setPersistMessage(null)}
          >
            关闭
          </button>
        </div>
      ) : null}

      {deleteError ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          <p className="font-medium">删除失败</p>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-sans text-xs">
            {deleteError}
          </pre>
        </div>
      ) : null}

      {asideData === null ? (
        <p className="text-sm text-zinc-500">加载本篇词汇与语法…</p>
      ) : (
        <InteractiveArticleReader
          key={`${article.id}-${asideSnapshotVersion}`}
          articlePlain={articlePlain}
          chunkIntervals={chunkIntervals}
          metaTitle={article.title ?? "（无标题）"}
          initialVocabularyItems={mergedVocabulary}
          initialGrammarItems={mergedGrammar}
          summaryPanel={summaryPanel}
          questionsPanel={questionsPanel}
          legendMode="full"
          selectionLabels={{
            addVocab: "添加为词汇",
            addGrammar: "添加为语法",
          }}
          persistArticleId={article.id}
          persistUserId={session.user.id}
          onPersistError={(msg) => setPersistMessage(msg)}
          enrichUserLevel={articleAnalysisLevel(article.user_level_at_analysis)}
          initialFocus={initialReaderFocus}
          analysisToolbar={
            <div className="space-y-3">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                <p
                  className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
                  aria-live="polite"
                >
                  {aiStatusLabel}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    disabled={realAiRunning}
                    onClick={handlePrimaryRealAiClick}
                  >
                    {primaryRealAiButtonLabel}
                  </Button>
                  {realAiPreview ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={realAiRunning}
                      onClick={() => void handleRealAiReanalyze()}
                    >
                      {realAiRunning
                        ? "重新分析中…"
                        : "重新分析（会再次调用 OpenAI）"}
                    </Button>
                  ) : null}
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">
                    当前分析水平：{analysisLevel}
                  </span>
                </div>
                <p className="mt-2 text-xs text-amber-800 dark:text-amber-200/90">
                  「重新分析本文（会再次调用 AI）」会再次请求 OpenAI 并产生 API 成本；请先确认弹窗提示。
                </p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  首次「AI 分析本文」生成预览，不会自动覆盖已保存内容；保存后才会写入词库/语法库与摘要/阅读问题。刷新或重进本文只读库内数据，不会自动重新分析。
                </p>
                {IS_DEV ? (
                  <details className="mt-3 rounded-md border border-dashed border-zinc-300 bg-white/60 p-2 dark:border-zinc-600 dark:bg-zinc-950/40">
                    <summary className="cursor-pointer select-none text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      开发工具
                    </summary>
                    <div className="mt-2 space-y-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        不调用 OpenAI，仅用于开发测试 UI。Mock 结果仅存于本页内存，不会写入云端，也不会覆盖真实
                        AI 预览或已保存的摘要/阅读问题。
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={mockRunning}
                        onClick={() => void handleMockAnalyze()}
                      >
                        {mockRunning ? "Mock 分析中…" : "Mock 分析（开发用）"}
                      </Button>
                    </div>
                  </details>
                ) : null}
              </div>

              {realAiError ? (
                <div
                  className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
                  role="status"
                >
                  <p className="font-medium">真实 AI 预览失败</p>
                  <p className="mt-1 whitespace-pre-wrap break-words">
                    {realAiError}
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-xs underline"
                    onClick={() => setRealAiError(null)}
                  >
                    关闭
                  </button>
                </div>
              ) : null}

              {realAiPreview ? (
                <div
                  ref={realAiPreviewRef}
                  className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/25"
                >
                  <p className="font-medium text-emerald-900 dark:text-emerald-100">
                    {realAiSavedToLibrary
                      ? "AI 分析结果已保存（预览区）"
                      : "AI 预览（尚未保存）"}
                  </p>
                  <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                    {realAiSavedToLibrary
                      ? "词汇与语法已写入本篇学习数据。再次点击「保存…」会用当前预览中的候选同步词库/语法库（含词典形 lemma 更新），并更新摘要与阅读问题。"
                      : "结果尚未保存到词库/语法库。重新分析会再次调用 OpenAI 并产生 API 成本。"}
                  </p>
                  {!realAiSavedToLibrary ? (
                    <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                      保存后，AI 词汇与语法将进入右侧学习面板并在原文中高亮；中文/德语摘要与阅读问题将写入本文章。
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      disabled={realAiSaving || !session?.user?.id}
                      onClick={() => void handleSaveRealAiPreview()}
                    >
                      {realAiSaving
                        ? "保存中…"
                        : realAiSavedToLibrary
                          ? "保存预览并更新摘要"
                          : "保存 AI 结果到词库/语法库"}
                    </Button>
                  </div>
                  {realAiSaveError ? (
                    <div
                      className="mt-3 rounded-md border border-red-200 bg-red-50/90 p-2 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
                      role="alert"
                    >
                      <p className="font-medium">保存失败</p>
                      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words font-sans">
                        {realAiSaveError}
                      </pre>
                      <button
                        type="button"
                        className="mt-2 text-xs underline"
                        onClick={() => setRealAiSaveError(null)}
                      >
                        关闭
                      </button>
                    </div>
                  ) : null}
                  {realAiSaveInfo ? (
                    <p className="mt-3 text-xs text-amber-800 dark:text-amber-200 whitespace-pre-wrap">
                      {realAiSaveInfo}
                    </p>
                  ) : null}
                  {realAiWarning ? (
                    <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                      {realAiWarning}
                    </p>
                  ) : null}

                  <div className="mt-4 space-y-4 text-zinc-800 dark:text-zinc-200">
                    <section>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        词汇（{editableRealAiVocabulary.length}
                        {editableRealAiVocabulary.length !==
                        realAiPreview.vocabulary.length
                          ? ` / ${realAiPreview.vocabulary.length}`
                          : ""}
                        ）
                      </h3>
                      {!realAiSavedToLibrary ? (
                        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                          保存前可删除不想要的候选，或先标为已掌握 / 暂忽略；最后一键保存。
                        </p>
                      ) : null}
                      <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-xs">
                        {editableRealAiVocabulary.map(({ item: v, index, status }) => (
                          <li
                            key={`${v.normalized_key}-${index}`}
                            className="rounded border border-zinc-200/80 bg-white/80 p-2 dark:border-zinc-700 dark:bg-zinc-900/50"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p>
                                <span className="font-medium">
                                  {vocabularyHeadwordDe(
                                    v.surface_form,
                                    v.lemma,
                                    v.grammatical_gender,
                                  )}
                                </span>
                                <span className="text-zinc-500">
                                  {" "}
                                  · {posLabelZh(v.part_of_speech)} · {v.level_estimate}
                                </span>
                              </p>
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-950/70 dark:text-amber-100">
                                AI 候选 · {aiCandidateStatusLabel(status)}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                              词典形（lemma，将写入词库）：
                              <span className="ml-1 font-medium text-zinc-700 dark:text-zinc-200">
                                {v.lemma.trim() || "—"}
                              </span>
                            </p>
                            {shouldShowGrammaticalGenderSubtitle(
                              v.part_of_speech,
                              v.lemma,
                              v.grammatical_gender,
                              v.surface_form,
                            ) ? (
                              <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                                名词性：
                                <span className="ml-1 font-medium text-zinc-700 dark:text-zinc-200">
                                  {displayGrammaticalGenderLabelZh(
                                    v.lemma,
                                    v.grammatical_gender,
                                  )}
                                </span>
                              </p>
                            ) : null}
                            <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                              {v.zh_meaning}
                            </p>
                            <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">
                              {v.simple_de_explanation}
                            </p>
                            {!realAiSavedToLibrary ? (
                              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-zinc-200/70 pt-2 dark:border-zinc-700/70">
                                <label className="text-xs text-zinc-600 dark:text-zinc-400">
                                  状态{" "}
                                  <select
                                    value={status}
                                    onChange={(e) =>
                                      handleRealAiVocabularyStatusChange(
                                        index,
                                        e.currentTarget.value as MasteryStatus,
                                      )
                                    }
                                    className="h-7 rounded-md border border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-800 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                                  >
                                    <option value="new">学习中</option>
                                    <option value="mastered">已掌握</option>
                                    <option value="ignored">暂忽略</option>
                                  </select>
                                </label>
                                <button
                                  type="button"
                                  className="h-7 rounded-md border border-zinc-300 px-2 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                  onClick={() =>
                                    handleRemoveRealAiVocabularyCandidate(index)
                                  }
                                >
                                  删除候选
                                </button>
                              </div>
                            ) : null}
                          </li>
                        ))}
                        {editableRealAiVocabulary.length === 0 ? (
                          <li className="rounded border border-dashed border-zinc-300 p-2 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                            词汇候选已全部删除；仍可保存摘要与阅读问题。
                          </li>
                        ) : null}
                      </ul>
                    </section>

                    <section>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        语法（{editableRealAiGrammar.length}
                        {editableRealAiGrammar.length !== realAiPreview.grammar.length
                          ? ` / ${realAiPreview.grammar.length}`
                          : ""}
                        ）
                      </h3>
                      <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-xs">
                        {editableRealAiGrammar.map(({ item: g, index, status }) => (
                          <li
                            key={`${g.grammar_key}-${index}`}
                            className="rounded border border-zinc-200/80 bg-white/80 p-2 dark:border-zinc-700 dark:bg-zinc-900/50"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p>
                                <span className="font-medium">
                                  「{g.selected_text}」
                                </span>
                                <span className="text-zinc-500">
                                  {" "}
                                  · {g.name_zh} · {g.level_estimate}
                                </span>
                              </p>
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-950/70 dark:text-amber-100">
                                AI 候选 · {aiCandidateStatusLabel(status)}
                              </span>
                            </div>
                            <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                              {g.explanation_zh}
                            </p>
                            {!realAiSavedToLibrary ? (
                              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-zinc-200/70 pt-2 dark:border-zinc-700/70">
                                <label className="text-xs text-zinc-600 dark:text-zinc-400">
                                  状态{" "}
                                  <select
                                    value={status}
                                    onChange={(e) =>
                                      handleRealAiGrammarStatusChange(
                                        index,
                                        e.currentTarget.value as MasteryStatus,
                                      )
                                    }
                                    className="h-7 rounded-md border border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-800 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                                  >
                                    <option value="new">学习中</option>
                                    <option value="mastered">已掌握</option>
                                    <option value="ignored">暂忽略</option>
                                  </select>
                                </label>
                                <button
                                  type="button"
                                  className="h-7 rounded-md border border-zinc-300 px-2 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                  onClick={() =>
                                    handleRemoveRealAiGrammarCandidate(index)
                                  }
                                >
                                  删除候选
                                </button>
                              </div>
                            ) : null}
                          </li>
                        ))}
                        {editableRealAiGrammar.length === 0 ? (
                          <li className="rounded border border-dashed border-zinc-300 p-2 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                            语法候选已全部删除；仍可保存摘要与阅读问题。
                          </li>
                        ) : null}
                      </ul>
                    </section>

                    <section>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        摘要
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed">
                        {realAiPreview.summary_zh}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {realAiPreview.summary_de_simple}
                      </p>
                    </section>

                    <section>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        阅读问题
                      </h3>
                      <ol className="mt-2 list-inside list-decimal space-y-1 text-xs">
                        {realAiPreview.reading_questions.map((q, j) => (
                          <li key={j}>{q}</li>
                        ))}
                      </ol>
                    </section>
                  </div>
                </div>
              ) : null}
            </div>
          }
        />
      )}

      <p className="text-xs text-zinc-500">
        完整演示（含课文嵌入词块）见{" "}
        <Link href="/articles/mock" className="text-emerald-700 hover:underline dark:text-emerald-400">
          演示课文
        </Link>
        。本篇手动添加与确认保存的真实 AI（source = ai）词汇/语法写入云端；摘要与阅读问题在保存后写入本文章。
        {IS_DEV
          ? " 开发环境下「开发工具」中的 Mock 分析仅本地预览，不入库。"
          : ""}
      </p>
    </div>
  );
}

export default function ArticleDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <p className="text-sm text-zinc-500">加载中…</p>
        </div>
      }
    >
      <ArticleDetailPageContent />
    </Suspense>
  );
}
