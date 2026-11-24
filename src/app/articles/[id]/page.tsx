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
  analysisSaveSucceeded,
  analysisSaveUserMessage,
} from "@/lib/articleAnalysis/analysisSaveOutcome";
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
  dedupeGrammarItemsBySurfaceKey,
  expandGrammarItemsWithRepeatedSurface,
  finalizeArticleGrammarItems,
  finalizeArticleVocabularyItems,
  sanitizeArticlePlainForMatching,
} from "@/lib/articleReadingModel";
import type { CefrLevel } from "@/lib/types";
import type { ArticleRow } from "@/lib/supabase/articles";
import { fetchArticleManualGrammar } from "@/lib/supabase/grammar";
import {
  fetchArticleManualVocabulary,
  persistManualVocabularyItem,
} from "@/lib/supabase/vocabulary";
import {
  isValidArticleId,
  normalizeReadingQuestionsFromDb,
} from "@/lib/supabase/articles";
import { loginPageHref } from "@/lib/auth/post-auth-redirect";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatSupabaseOrUnknownError } from "@/lib/supabase/errors";
import { FullArticleTranslationExternal } from "@/components/FullArticleTranslationExternal";
import { normalizeLearningLanguage } from "@/lib/language/learningLanguage";

const IS_DEV = process.env.NODE_ENV === "development";

const CONFIRM_AI_REGENERATE_ZH =
  "这会再次调用 AI，并可能产生费用。确定重新生成吗？";

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

function asArticleAnalysisResult(value: unknown): ArticleAnalysisResult | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  if (!Array.isArray(o.vocabulary) || !Array.isArray(o.reading_questions)) {
    return null;
  }
  return {
    vocabulary: o.vocabulary as ArticleAnalysisResult["vocabulary"],
    grammar: Array.isArray(o.grammar)
      ? (o.grammar as ArticleAnalysisResult["grammar"])
      : [],
    summary_zh: typeof o.summary_zh === "string" ? o.summary_zh : "",
    summary_de_simple:
      typeof o.summary_de_simple === "string" ? o.summary_de_simple : "",
    reading_questions: o.reading_questions.filter(
      (q): q is string => typeof q === "string",
    ),
  };
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
  /**
   * 只在分析刚写入新词、或开发用 Mock 换了一批侧栏数据时递增，用来重挂阅读器。
   * 切回标签页 / bfcache 的后台刷新不递增：阅读器靠 props 更新列表，避免清掉当前选中的词。
   */
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

  /** 分析成功后自动写入。pendingAnalysis 只在写入失败时留下，供「重试保存」，不在页面上展开。 */
  const [realAiRunning, setRealAiRunning] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] =
    useState<ArticleAnalysisResult | null>(null);
  const [realAiWarning, setRealAiWarning] = useState<string | null>(null);
  const [realAiError, setRealAiError] = useState<string | null>(null);
  const analysisAlertRef = useRef<HTMLDivElement>(null);
  /** 换文章时递增，丢掉还在飞的分析 / 写入结果，避免写到另一篇的界面上 */
  const opTicket = useRef(0);
  const saveLock = useRef(false);
  const analysisLock = useRef(false);
  const [realAiSaving, setRealAiSaving] = useState(false);
  const [realAiSaveError, setRealAiSaveError] = useState<string | null>(null);
  const [realAiSaveErrorDetail, setRealAiSaveErrorDetail] = useState<
    string | null
  >(null);
  const [realAiSaveInfo, setRealAiSaveInfo] = useState<string | null>(null);

  useEffect(() => {
    opTicket.current += 1;
    saveLock.current = false;
    analysisLock.current = false;
    setMockStaging(null);
    setAiAnalysisExtras(null);
    setMockRunning(false);
    setPendingAnalysis(null);
    setRealAiError(null);
    setRealAiWarning(null);
    setRealAiSaveError(null);
    setRealAiSaveErrorDetail(null);
    setRealAiSaveInfo(null);
    setRealAiRunning(false);
    setRealAiSaving(false);
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
            "id,user_id,title,url,source_name,original_text,summary_zh,summary_de_simple,reading_questions,user_level_at_analysis,detected_article_level,topic,language,created_at,updated_at",
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

  /** 阅读/高亮/手动标记仅用正文；标题单独在 CardTitle 展示，避免偏移错位导致语法无法高亮 */
  const articlePlain = useMemo(
    () => sanitizeArticlePlainForMatching(article?.original_text ?? ""),
    [article?.original_text],
  );

  const { chunkIntervals } = useMemo(
    () => buildPlainTextArticleLayout(articlePlain),
    [articlePlain],
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
    const expandedExtra = dedupeGrammarItemsBySurfaceKey(
      finalizeArticleGrammarItems(
        expandGrammarItemsWithRepeatedSurface(extra, articlePlain),
        articlePlain,
      ),
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

  /** 阅读问题 Tab：已写入文章的结果 > 开发用 Mock。分析过程中的结果不在这里预览。 */
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
  }, [article, aiAnalysisExtras]);

  const articleId = article?.id ?? null;

  const loadAsideLearningData = useCallback(
    async (opts: {
      resetBeforeFetch: boolean;
      allowClearOnError: boolean;
      /** 分析刚写入新词时才重挂阅读器。后台刷新不要传。 */
      bumpSnapshot?: boolean;
    }) => {
      if (!session?.user?.id || !articleId) return;
      const seq = ++asideFetchSeq.current;
      if (opts.resetBeforeFetch) {
        setAsideData(null);
        setAsideLoadError(null);
      }
      try {
        const supabase = getSupabaseBrowserClient();
        const [v, g] = await Promise.all([
          fetchArticleManualVocabulary(supabase, articleId),
          fetchArticleManualGrammar(supabase, articleId),
        ]);
        if (seq !== asideFetchSeq.current) return;
        setAsideData({
          vocabulary: finalizeArticleVocabularyItems(v, articlePlain),
          grammar: dedupeGrammarItemsBySurfaceKey(
            finalizeArticleGrammarItems(
              expandGrammarItemsWithRepeatedSurface(g, articlePlain),
              articlePlain,
            ),
          ),
        });
        setAsideLoadError(null);
        if (opts.bumpSnapshot) {
          setAsideSnapshotVersion((n) => n + 1);
        }
      } catch (e) {
        if (seq !== asideFetchSeq.current) return;
        setAsideLoadError(formatSupabaseOrUnknownError(e));
        if (opts.allowClearOnError) {
          setAsideData({ vocabulary: [], grammar: [] });
        }
      }
    },
    [articleId, articlePlain, session?.user?.id],
  );

  useEffect(() => {
    if (!session?.user?.id || !articleId) {
      setAsideData(null);
      setAsideLoadError(null);
      return;
    }
    void loadAsideLearningData({
      resetBeforeFetch: true,
      allowClearOnError: true,
    });
  }, [session?.user?.id, articleId, articlePlain, loadAsideLearningData]);

  /** 重新进入标签页、从 bfcache 恢复或窗口聚焦时后台刷新本篇词汇/语法（失败仅提示，不清空已有 UI） */
  useEffect(() => {
    if (!session?.user?.id || !articleId) return;

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
  }, [articleId, session?.user?.id, loadAsideLearningData]);

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

  const saveAnalysisResult = useCallback(
    async (analysis: ArticleAnalysisResult) => {
      if (!session?.user?.id || !article?.id) {
        setPendingAnalysis(analysis);
        setRealAiSaveError(
          "登录已过期，这次结果还在。重新登录后点「重试保存」，不会再次调用 AI。",
        );
        return;
      }
      if (saveLock.current) return;
      saveLock.current = true;
      const ticket = opTicket.current;
      const userId = session.user.id;
      const savedArticleId = article.id;
      const language = normalizeLearningLanguage(article.language);
      setRealAiSaving(true);
      setRealAiSaveError(null);
      setRealAiSaveErrorDetail(null);
      setRealAiSaveInfo(null);

      let unmatchedNote: string | null = null;
      let fv: ReturnType<typeof finalizeArticleVocabularyItems> = [];
      let vocabSaved = 0;
      let firstDetail: string | null = null;
      let questionsSaved = false;
      const stillHere = () => opTicket.current === ticket;

      try {
        const unmatched = listRealAiEntriesWithoutTextMatch(
          analysis,
          articlePlain,
        );
        unmatchedNote = unmatched.vocabulary.length
          ? `下列词在原文里对不上，已写入右侧列表，但正文里暂时没有高亮：${unmatched.vocabulary.join("、")}`
          : null;

        const { vocabulary: v0 } = convertAnalysisResultToArticleItems(
          analysis,
          articlePlain,
          { itemSource: "ai" },
        );
        fv = finalizeArticleVocabularyItems(v0, articlePlain);

        const sb = getSupabaseBrowserClient();
        /**
         * 只写入这次推荐的词。不删除以前写入、这次没再推荐的词。
         * 不传 reactivateIfMastered：已掌握 / 暂忽略保持原样。
         */
        for (const item of fv) {
          const { error } = await persistManualVocabularyItem(sb, {
            userId,
            articleId: savedArticleId,
            articlePlain,
            language,
            item,
          });
          if (error) {
            firstDetail =
              firstDetail ?? `词汇「${item.display_word}」：${error}`;
          } else {
            vocabSaved += 1;
          }
        }

        if (vocabSaved > 0 && stillHere()) {
          await loadAsideLearningData({
            resetBeforeFetch: false,
            allowClearOnError: false,
            bumpSnapshot: true,
          });
        }

        const { error: artUpdErr } = await sb
          .from("articles")
          .update({
            reading_questions: analysis.reading_questions,
          })
          .eq("id", savedArticleId)
          .eq("user_id", userId);

        if (artUpdErr) {
          firstDetail =
            firstDetail ??
            `阅读问题：${formatSupabaseOrUnknownError(artUpdErr)}`;
        } else {
          questionsSaved = true;
          if (stillHere()) {
            setArticle((prev) =>
              prev && prev.id === savedArticleId
                ? {
                    ...prev,
                    reading_questions: analysis.reading_questions,
                  }
                : prev,
            );
          }
        }

        if (!stillHere()) return;

        const tally = {
          vocabAttempted: fv.length,
          vocabSaved,
          questionsSaved,
        };
        const message = analysisSaveUserMessage(tally);
        if (analysisSaveSucceeded(tally)) {
          setPendingAnalysis(null);
          setRealAiSaveError(null);
          setRealAiSaveErrorDetail(null);
          setRealAiSaveInfo(
            [message, unmatchedNote].filter(Boolean).join("\n"),
          );
        } else {
          setPendingAnalysis(analysis);
          setRealAiSaveError(message);
          setRealAiSaveErrorDetail(firstDetail);
          setRealAiSaveInfo(unmatchedNote);
        }
      } catch (e: unknown) {
        if (!stillHere()) return;
        setPendingAnalysis(analysis);
        setRealAiSaveError(
          analysisSaveUserMessage({
            vocabAttempted: fv.length,
            vocabSaved,
            questionsSaved,
          }),
        );
        setRealAiSaveErrorDetail(
          firstDetail ?? formatSupabaseOrUnknownError(e),
        );
        setRealAiSaveInfo(unmatchedNote);
      } finally {
        if (stillHere()) {
          saveLock.current = false;
          setRealAiSaving(false);
        }
      }
    },
    [article, articlePlain, loadAsideLearningData, session],
  );

  const runRealAiAnalysis = useCallback(async () => {
    if (!session?.user?.id || !article?.id) return;
    if (analysisLock.current || saveLock.current) return;
    const token = session.access_token?.trim();
    if (!token) {
      setRealAiError("登录已过期，请重新登录后再分析。");
      return;
    }
    analysisLock.current = true;
    const ticket = opTicket.current;
    const stillHere = () => opTicket.current === ticket;
    setRealAiRunning(true);
    setRealAiError(null);
    setRealAiWarning(null);
    setRealAiSaveInfo(null);
    try {
      const level = articleAnalysisLevel(article.user_level_at_analysis);
      const res = await fetch("/api/analyze-article", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          articleId: article.id,
          title: article.title ?? "",
          originalText: article.original_text ?? "",
          userLevel: level,
          language: normalizeLearningLanguage(article.language),
        }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!stillHere()) return;
      if (!data || typeof data !== "object") {
        setRealAiError("无法解析服务器响应");
        return;
      }
      const o = data as Record<string, unknown>;
      if (o.ok === true && o.analysis && typeof o.analysis === "object") {
        const analysis = asArticleAnalysisResult(o.analysis);
        if (!analysis) {
          setRealAiError("分析结果不完整，没有写入。");
          return;
        }
        setPendingAnalysis(analysis);
        setRealAiWarning(
          typeof o.warning === "string" && o.warning.trim()
            ? o.warning.trim()
            : null,
        );
        setRealAiRunning(false);
        await saveAnalysisResult(analysis);
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
      if (stillHere()) setRealAiError(formatSupabaseOrUnknownError(e));
    } finally {
      if (stillHere()) {
        analysisLock.current = false;
        setRealAiRunning(false);
      }
    }
  }, [article, saveAnalysisResult, session]);

  const handlePrimaryRealAiClick = useCallback(() => {
    if (realAiRunning || realAiSaving) return;
    if (
      hasSavedArticleAiBaseline &&
      typeof window !== "undefined" &&
      !window.confirm(CONFIRM_AI_REGENERATE_ZH)
    ) {
      return;
    }
    void runRealAiAnalysis();
  }, [
    hasSavedArticleAiBaseline,
    realAiRunning,
    realAiSaving,
    runRealAiAnalysis,
  ]);

  const handleRetrySave = useCallback(() => {
    if (!pendingAnalysis || realAiRunning || realAiSaving) return;
    void saveAnalysisResult(pendingAnalysis);
  }, [pendingAnalysis, realAiRunning, realAiSaving, saveAnalysisResult]);

  useEffect(() => {
    if (!realAiError && !realAiSaveError) return;
    analysisAlertRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [realAiError, realAiSaveError]);

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
        分析完成并写入后，阅读问题会显示在这里。
      </p>
    );

  const createdLabel = article?.created_at
    ? new Date(article.created_at).toLocaleString("zh-Hans", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

  const aiStatusLabel = useMemo(() => {
    if (realAiSaving) return "正在写入词汇与阅读问题…";
    if (realAiRunning && hasSavedArticleAiBaseline) return "重新分析中…";
    if (realAiRunning) return "分析中…";
    if (realAiError) return "分析失败";
    if (realAiSaveError) return "写入未完成";
    if (hasPersistedAiArticleFields || realAiSaveInfo) return "已写入本篇";
    return "尚未分析";
  }, [
    hasPersistedAiArticleFields,
    hasSavedArticleAiBaseline,
    realAiError,
    realAiRunning,
    realAiSaveError,
    realAiSaveInfo,
    realAiSaving,
  ]);

  const primaryRealAiButtonLabel = realAiSaving
    ? "写入中…"
    : realAiRunning
      ? hasSavedArticleAiBaseline
        ? "重新分析中…"
        : "分析中…"
      : hasSavedArticleAiBaseline
        ? "重新分析"
        : "AI 分析本文";

  const analysisProgressHint = realAiSaving
    ? "正在把词汇和阅读问题写入本篇，请稍候。"
    : realAiRunning
      ? "正在调用 AI。完成后会自动写入本篇词汇与阅读问题。"
      : null;

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
        {article.source_name ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            来源：{article.source_name}
          </p>
        ) : null}
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer select-none font-medium text-zinc-600 marker:hidden dark:text-zinc-400 [&::-webkit-details-marker]:hidden">
            文章信息
          </summary>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
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
            {normalizeLearningLanguage(article.language) === "en" ? (
              <div>
                <dt className="text-zinc-500">语言</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">英语</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-zinc-500">阅读水平</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {article.user_level_at_analysis ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">保存时间</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">{createdLabel}</dd>
            </div>
          </dl>
        </details>
      </div>

      {asideLoadError ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
          role="alert"
        >
          <p className="font-medium">本篇词汇与语法加载失败</p>
          <p className="mt-1 text-xs opacity-90">请刷新页面后重试。</p>
          {IS_DEV ? (
            <p className="mt-1 text-xs opacity-75">{asideLoadError}</p>
          ) : null}
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
          questionsPanel={questionsPanel}
          selectionLabels={{
            addVocab: "添加为词汇",
            addGrammar: "添加为语法",
          }}
          persistArticleId={article.id}
          persistUserId={session.user.id}
          persistLanguage={normalizeLearningLanguage(article.language)}
          onPersistError={(msg) => setPersistMessage(msg)}
          enrichUserLevel={articleAnalysisLevel(article.user_level_at_analysis)}
          initialFocus={initialReaderFocus}
          readingHelpExtra={
            <>
              <p>
                阅读水平 {analysisLevel}：点「AI 分析本文」后，分析完成即自动写入本篇词汇与阅读问题。语法请拖选后标记。不想要的词在右侧列表删除。
              </p>
              <p>
                AI 只推你多半不认识的词：词库里「学习中」的必推，「已掌握 / 暂忽略」不推，其余按词频与水平判断；没推但不会的词，拖选「添加为词汇」即可。
                <Link href="/help#recommend" className="ml-1 text-emerald-700 hover:underline dark:text-emerald-400">
                  完整说明 →
                </Link>
              </p>
              {hasSavedArticleAiBaseline ? (
                <p className="text-amber-800 dark:text-amber-200/90">
                  「重新分析」会再次调用 AI，确认后执行。
                </p>
              ) : null}
            </>
          }
          analysisToolbar={
            <div className="space-y-3">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                <p
                  className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
                  aria-live="polite"
                  aria-busy={realAiRunning || realAiSaving}
                >
                  {aiStatusLabel}
                </p>
                {analysisProgressHint ? (
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {analysisProgressHint}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    disabled={realAiRunning || realAiSaving}
                    onClick={handlePrimaryRealAiClick}
                  >
                    {primaryRealAiButtonLabel}
                  </Button>
                  {pendingAnalysis && realAiSaveError && !realAiRunning ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={realAiRunning || realAiSaving}
                      onClick={handleRetrySave}
                    >
                      重试保存
                    </Button>
                  ) : null}
                </div>
                <div className="mt-2 w-full">
                  <FullArticleTranslationExternal
                    articlePlain={articlePlain}
                    title={article?.title ?? undefined}
                    disabled={!articlePlain.trim()}
                    language={normalizeLearningLanguage(article?.language)}
                  />
                </div>
                {IS_DEV ? (
                  <details className="mt-3 rounded-md border border-dashed border-zinc-300 bg-white/60 p-2 dark:border-zinc-600 dark:bg-zinc-950/40">
                    <summary className="cursor-pointer select-none text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      开发工具
                    </summary>
                    <div className="mt-2 space-y-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        不调用 OpenAI，仅用于开发测试 UI。Mock 结果仅存于本页内存，不会写入云端，也不会覆盖已保存的阅读问题。
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

              {realAiError ||
              (realAiSaveError && !realAiRunning) ||
              realAiSaveInfo ||
              realAiWarning ? (
                <div ref={analysisAlertRef} className="scroll-mt-24 space-y-2">
                  {realAiError ? (
                    <div
                      className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-950 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
                      role="alert"
                    >
                      <p className="font-medium">分析失败</p>
                      <p className="mt-1">
                        没有写入新内容。已有的词和阅读问题还在。
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-xs opacity-90">
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
                  {realAiSaveError && !realAiRunning ? (
                    <div
                      className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-950 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
                      role="alert"
                    >
                      <p className="font-medium">写入未完成</p>
                      <p className="mt-1 whitespace-pre-wrap">{realAiSaveError}</p>
                      {realAiSaveErrorDetail ? (
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer">详情</summary>
                          <p className="mt-1 whitespace-pre-wrap break-words opacity-90">
                            {realAiSaveErrorDetail}
                          </p>
                        </details>
                      ) : null}
                    </div>
                  ) : null}
                  {realAiSaveInfo ? (
                    <p
                      className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300"
                      role="status"
                    >
                      {realAiSaveInfo}
                    </p>
                  ) : null}
                  {realAiWarning ? (
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      {realAiWarning}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          }
        />
      )}
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
