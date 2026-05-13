"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { PronunciationButton } from "@/components/PronunciationButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { speakGerman } from "@/lib/speech";
import type {
  ArticleGrammarItem,
  ArticleVocabItem,
  ArticleVocabSource,
  ChunkInterval,
  VocabSense,
} from "@/lib/articleReadingTypes";
import type { CefrLevel, MasteryStatus } from "@/lib/types";
import {
  alignVocabOccurrenceIdAfterFinalize,
  alignVocabOccurrenceIdAfterPersist,
  buildRunsFromReadingItems,
  expandGrammarItemsWithRepeatedSurface,
  finalizeArticleVocabularyItems,
  grammarUserStyle,
  mergeGrammarFromFormText,
  mergeGrammarOccurrence,
  mergeVocabFromFormText,
  mergeVocabOccurrence,
  occurrencePositionKey,
  overlappingAiVocabIdsForRange,
  resolveUserHighlightInPlain,
  vocabOccurrenceToRanges,
  vocabUserStyle,
} from "@/lib/articleReadingModel";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  deleteArticleGrammarItemOccurrences,
  persistManualGrammarItem,
  updateGrammarItemDeepNote,
  updateGrammarItemMastery,
} from "@/lib/supabase/grammar";
import {
  deleteArticleVocabularyItemOccurrences,
  persistManualVocabularyItem,
  updateVocabularyItemDeepNote,
  updateVocabularyItemMastery,
} from "@/lib/supabase/vocabulary";
import { formatSupabaseOrUnknownError } from "@/lib/supabase/errors";
import type { RunMeta } from "@/lib/articleReadingModel";
import {
  buildGrammarExternalDeepDivePrompt,
  buildVocabularyExternalDeepDivePrompt,
} from "@/lib/grammar/labelValidation";
import { normalizeDeepNoteMarkdown } from "@/lib/text/normalizeDeepNoteMarkdown";
import {
  displayGrammaticalGenderLabelZh,
  shouldShowGrammaticalGenderSubtitle,
  vocabularyHeadwordDe,
} from "@/lib/vocabulary/grammaticalGender";

/** 删除（remove）≠ 忽略（ignored）：删除用于误添加/重复；忽略保留记录、可恢复、表示不想继续学。 */
const DELETE_LEARNING_ITEM_CONFIRM_ZH =
  "确定从本文删除这个学习项吗？这不会表示你已掌握，只是移除误添加的项目。";

const HIGHLIGHT_TOUCH_GUARD_STYLE = {
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
  touchAction: "manipulation",
} as CSSProperties;

/** 语法片段需在手机端允许拖选子串加入词库；勿在 touch 上 preventDefault，否则系统选词不触发 */
const GRAMMAR_ARTICLE_HIGHLIGHT_STYLE = {
  WebkitTapHighlightColor: "transparent",
  touchAction: "auto",
  userSelect: "text",
  WebkitUserSelect: "text",
  WebkitTouchCallout: "default",
} as CSSProperties;

const GRAMMAR_EXTERNAL_DEEP_LINKS = {
  chatgpt: "https://chatgpt.com/",
  claude: "https://claude.ai/",
  gemini: "https://gemini.google.com/",
  deepseek: "https://chat.deepseek.com/",
} as const;

/** 单项 enrich / 全文重新分析前统一确认（Phase 3.14） */
const CONFIRM_AI_REGENERATE_ZH =
  "这会再次调用 AI，并可能产生费用。确定重新生成吗？";

const VOCAB_EXTERNAL_DEEP_LINKS = {
  chatgpt: "https://chatgpt.com/",
  claude: "https://claude.ai/",
  gemini: "https://gemini.google.com/",
  deepseek: "https://chat.deepseek.com/",
} as const;

/** 在指定滚动容器内滚动到元素（避免 scrollIntoView 误滚整页） */
function scrollElementIntoScrollContainer(
  container: HTMLElement,
  element: HTMLElement,
  options?: {
    paddingTop?: number;
    behavior?: ScrollBehavior;
    /** start：保留上边距；center：在容器视区内纵向居中 */
    align?: "start" | "center";
    /**
     * 视区内为元素底部留出空隙（px），避免被底部固定抽屉挡住。
     * 通过限制单次滚动量 D：D 需同时满足「顶边留白」与「底边不落入底部 reserve 区域」。
     */
    ensureGapBottom?: number;
  },
) {
  const behavior = options?.behavior ?? "smooth";
  const cRect = container.getBoundingClientRect();
  const tRect = element.getBoundingClientRect();
  const reserve = options?.ensureGapBottom ?? 0;
  let nextTop: number;
  if (options?.align === "center") {
    nextTop =
      container.scrollTop +
      (tRect.top - cRect.top) -
      (cRect.height / 2 - tRect.height / 2);
  } else {
    const pad = options?.paddingTop ?? 72;
    const DHigh = tRect.top - cRect.top - pad;
    let D = DHigh;
    if (reserve > 0) {
      const DLow = tRect.bottom - cRect.bottom + reserve;
      D = DLow > DHigh ? DLow : DHigh;
    }
    nextTop = container.scrollTop + D;
  }
  container.scrollTo({ top: Math.max(0, nextTop), behavior });
}

function extractWordTokens(text: string): string[] {
  const matches = text.match(/[A-Za-zÄÖÜäöüß]+(?:[-'][A-Za-zÄÖÜäöüß]+)*/g);
  if (!matches) return [];
  return matches.map((w) => w.toLocaleLowerCase("de-DE"));
}

function mergeVocabFromEnrichmentApi(
  item: ArticleVocabItem,
  data: {
    canonical_form: string;
    surface_form: string;
    zh_meaning: string;
    simple_de_explanation: string;
    part_of_speech: string;
    level_estimate: CefrLevel;
    reason_for_selection: string;
    example_sentence: string;
  },
): ArticleVocabItem {
  const pos =
    data.part_of_speech && data.part_of_speech.trim()
      ? data.part_of_speech.trim()
      : item.part_of_speech;
  const first = item.senses[0];
  const ex =
    data.example_sentence?.trim() ||
    first?.example_sentence ||
    undefined;
  const updatedFirst: VocabSense =
    first != null
      ? {
          ...first,
          zh_meaning: data.zh_meaning,
          simple_de_explanation: data.simple_de_explanation,
          example_sentence: ex,
        }
      : {
          id: `sense-ui-${item.dbItemId ?? item.id}`,
          dbSenseId: null,
          zh_meaning: data.zh_meaning,
          simple_de_explanation: data.simple_de_explanation,
          example_sentence: ex,
        };
  return {
    ...item,
    lemma:
      data.canonical_form && data.canonical_form.trim()
        ? data.canonical_form.trim()
        : item.lemma,
    display_word:
      data.surface_form && data.surface_form.trim()
        ? data.surface_form.trim()
        : item.display_word,
    zh_meaning: data.zh_meaning,
    simple_de_explanation: data.simple_de_explanation,
    part_of_speech: pos && pos !== "—" ? pos : item.part_of_speech,
    grammatical_gender: item.grammatical_gender ?? "na",
    level_estimate: data.level_estimate,
    reason_for_selection: data.reason_for_selection.trim() || null,
    needs_ai_enrichment: false,
    senses:
      item.senses.length > 0
        ? [updatedFirst, ...item.senses.slice(1)]
        : [updatedFirst],
  };
}

function mergeGrammarFromEnrichmentApi(
  item: ArticleGrammarItem,
  data: {
    name_de: string;
    name_zh: string;
    explanation_zh: string;
    explanation_de_simple: string;
    level_estimate: CefrLevel;
    reason_for_selection: string;
  },
): ArticleGrammarItem {
  return {
    ...item,
    name_de: data.name_de,
    name_zh: data.name_zh,
    explanation_zh: data.explanation_zh,
    explanation_de_simple: data.explanation_de_simple,
    level_estimate: data.level_estimate,
    reason_for_selection: data.reason_for_selection.trim() || null,
    needs_ai_enrichment: false,
  };
}

const AI_ENRICH_PENDING_ZH = "待 AI";

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

function isDeExplanationPlaceholder(s: string): boolean {
  const t = s.trim().toLowerCase();
  return (
    t.length === 0 ||
    t.includes("wird später ergänzt") ||
    t === "wird später ergänzt."
  );
}

/** 词汇中/德解释均已有效（Phase 3.14：已有内容则不再显示「补充 AI 解释」） */
function vocabExplanationsComplete(v: ArticleVocabItem): boolean {
  const zh = (v.zh_meaning ?? "").trim();
  const de = (v.simple_de_explanation ?? "").trim();
  const s0 = v.senses[0];
  const szh = (s0?.zh_meaning ?? "").trim();
  const sde = (s0?.simple_de_explanation ?? "").trim();
  if (!zh || !de || !szh || !sde) return false;
  if (zh.includes(AI_ENRICH_PENDING_ZH) || szh.includes(AI_ENRICH_PENDING_ZH)) {
    return false;
  }
  if (isDeExplanationPlaceholder(de) || isDeExplanationPlaceholder(sde)) {
    return false;
  }
  return true;
}

/** 仅当用户手动添加且仍缺解释时显示「补充 AI 解释」 */
function vocabNeedsAiEnrichEntry(v: ArticleVocabItem): boolean {
  if (v.source !== "user_added") return false;
  return !vocabExplanationsComplete(v);
}

function grammarExplanationsComplete(g: ArticleGrammarItem): boolean {
  const zh = (g.explanation_zh ?? "").trim();
  const de = (g.explanation_de_simple ?? "").trim();
  if (!zh || !de) return false;
  if (zh.includes(AI_ENRICH_PENDING_ZH)) return false;
  if (isDeExplanationPlaceholder(de)) return false;
  return true;
}

function grammarNeedsAiEnrichEntry(g: ArticleGrammarItem): boolean {
  if (g.source !== "user_added") return false;
  return !grammarExplanationsComplete(g);
}

function vocabBadge(source: ArticleVocabSource) {
  switch (source) {
    case "ai_detected":
      return <Badge tone="muted">系统词汇</Badge>;
    case "ai_mock":
    case "ai":
      return <Badge tone="muted">AI</Badge>;
    case "user_added":
      return <Badge tone="warning">用户</Badge>;
    case "ai_detected_then_user_confirmed":
      return <Badge tone="warning">用户确认</Badge>;
    default:
      return null;
  }
}

function grammarBadge(source: ArticleGrammarItem["source"]) {
  switch (source) {
    case "ai_detected":
      return <Badge tone="muted">系统语法</Badge>;
    case "ai_mock":
    case "ai":
      return <Badge tone="muted">AI</Badge>;
    case "user_added":
      return <Badge tone="warning">用户语法</Badge>;
    case "ai_detected_then_user_confirmed":
      return <Badge tone="warning">用户确认</Badge>;
    default:
      return null;
  }
}

function masterySelectControlValue(status: MasteryStatus): MasteryStatus {
  return status === "mastered" || status === "ignored" ? status : "new";
}

const readingMasterySelectClassName =
  "h-7 shrink-0 rounded-md border border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-800 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

/** 顶行可改学习状态；无障碍文案用 aria-label。 */
function ReadingMasteryStatusSelect({
  status,
  onStatusChange,
  className,
}: {
  status: MasteryStatus;
  onStatusChange: (status: MasteryStatus) => void;
  className?: string;
}) {
  const selectValue = masterySelectControlValue(status);
  return (
    <select
      value={selectValue}
      aria-label="学习状态"
      title="学习状态"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) =>
        onStatusChange(e.currentTarget.value as MasteryStatus)
      }
      className={
        className
          ? `${readingMasterySelectClassName} ${className}`
          : readingMasterySelectClassName
      }
    >
      <option value="new">学习中</option>
      <option value="mastered">已掌握</option>
      <option value="ignored">暂忽略</option>
    </select>
  );
}

/** 标题行右侧：状态下拉 + 删除；`shrink-0` + `flex-nowrap` 避免把操作挤换行，长标题在左侧 `min-w-0` 区域换行。 */
function ReadingMasteryTitleActions({
  status,
  onStatusChange,
  onDelete,
  deleteDisabled,
  className,
}: {
  status: MasteryStatus;
  onStatusChange: (status: MasteryStatus) => void;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={
        className
          ? `flex shrink-0 flex-nowrap items-center gap-1 ${className}`
          : "flex shrink-0 flex-nowrap items-center gap-1"
      }
    >
      <ReadingMasteryStatusSelect
        status={status}
        onStatusChange={onStatusChange}
      />
      {onDelete ? (
        <Button
          type="button"
          variant="ghost"
          className="h-7 shrink-0 px-2 text-xs text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={deleteDisabled}
        >
          删除
        </Button>
      ) : null}
    </div>
  );
}

export type InteractiveArticleReaderProps = {
  articlePlain: string;
  chunkIntervals: ChunkInterval[];
  metaTitle: string;
  initialVocabularyItems: ArticleVocabItem[];
  initialGrammarItems: ArticleGrammarItem[];
  summaryPanel: ReactNode;
  questionsPanel: ReactNode;
  /** full：Mock 四项图例；user_only：仅说明用户添加类高亮（真实文章无课文嵌入词时） */
  legendMode?: "full" | "user_only";
  selectionLabels?: {
    addVocab: string;
    addGrammar: string;
  };
  /** 登录用户保存手动词汇/语法到 Supabase（真实文章页） */
  persistArticleId?: string;
  persistUserId?: string;
  onPersistError?: (message: string) => void;
  /** 文章页顶栏：如「AI 分析本文」入口 */
  analysisToolbar?: ReactNode;
  /** 补充 AI 解释（手动词汇/语法）时使用的学习者水平 */
  enrichUserLevel?: CefrLevel;
  /** 从总词库/总语法来源链接进入文章时，自动定位到对应学习项和原文位置。 */
  initialFocus?: {
    kind: "vocab" | "grammar";
    itemId?: string;
    occurrenceId?: string;
  };
};

export function InteractiveArticleReader({
  articlePlain,
  chunkIntervals,
  metaTitle,
  initialVocabularyItems,
  initialGrammarItems,
  summaryPanel,
  questionsPanel,
  legendMode = "full",
  selectionLabels,
  persistArticleId,
  persistUserId,
  onPersistError,
  analysisToolbar,
  enrichUserLevel,
  initialFocus,
}: InteractiveArticleReaderProps) {
  const articleRef = useRef<HTMLElement | null>(null);
  /** 左侧正文卡片（overflow 容器），occurrence 定位在此内 scrollTo */
  const articleScrollRef = useRef<HTMLDivElement | null>(null);
  /** 右侧 Tabs 内容区滚动容器 */
  const sidePanelScrollRef = useRef<HTMLDivElement | null>(null);
  /** 移动端底部详情抽屉（含「本篇出现位置」），与侧栏分离的滚动容器 */
  const mobileSheetScrollRef = useRef<HTMLDivElement | null>(null);
  const selectionPopoverRef = useRef<HTMLDivElement | null>(null);
  const selectionTextSnapshotRef = useRef<string | null>(null);

  const addVocabLabel = selectionLabels?.addVocab ?? "加入词库";
  const addGrammarLabel = selectionLabels?.addGrammar ?? "标记语法";

  const persistEnabled = Boolean(persistArticleId && persistUserId);
  const enrichLevelEffective: CefrLevel = enrichUserLevel ?? "B1";

  const emitPersistError = useCallback(
    (message: string) => {
      onPersistError?.(message);
    },
    [onPersistError],
  );

  const [vocabularyItems, setVocabularyItems] = useState<ArticleVocabItem[]>(
    () => initialVocabularyItems,
  );

  const [grammarItems, setGrammarItems] = useState<ArticleGrammarItem[]>(
    () => initialGrammarItems,
  );

  const [textSelectionUi, setTextSelectionUi] = useState<{
    text: string;
    left: number;
    top: number;
  } | null>(null);

  const [vocabFormOpen, setVocabFormOpen] = useState(false);
  const [grammarFormOpen, setGrammarFormOpen] = useState(false);
  const [vocabFormValue, setVocabFormValue] = useState("");
  const [grammarFormValue, setGrammarFormValue] = useState("");

  const [vocabEnrichLoadingId, setVocabEnrichLoadingId] = useState<
    string | null
  >(null);
  const [grammarEnrichLoadingId, setGrammarEnrichLoadingId] = useState<
    string | null
  >(null);
  const [vocabEnrichError, setVocabEnrichError] = useState<string | null>(null);
  const [grammarEnrichError, setGrammarEnrichError] = useState<string | null>(
    null,
  );
  const [vocabEnrichErrorItemId, setVocabEnrichErrorItemId] = useState<
    string | null
  >(null);
  const [grammarEnrichErrorItemId, setGrammarEnrichErrorItemId] = useState<
    string | null
  >(null);
  const [grammarExternalPromptNotice, setGrammarExternalPromptNotice] =
    useState<string | null>(null);
  const [vocabExternalPromptNotice, setVocabExternalPromptNotice] =
    useState<string | null>(null);
  const [vocabDeepNoteDrafts, setVocabDeepNoteDrafts] = useState<
    Record<string, string>
  >({});
  const [grammarDeepNoteDrafts, setGrammarDeepNoteDrafts] = useState<
    Record<string, string>
  >({});
  const [vocabDeepNoteSavingId, setVocabDeepNoteSavingId] = useState<
    string | null
  >(null);
  const [grammarDeepNoteSavingId, setGrammarDeepNoteSavingId] = useState<
    string | null
  >(null);
  const [vocabDeepNoteError, setVocabDeepNoteError] = useState<string | null>(
    null,
  );
  const [grammarDeepNoteError, setGrammarDeepNoteError] = useState<
    string | null
  >(null);
  const [vocabDeepNoteNotice, setVocabDeepNoteNotice] = useState<string | null>(
    null,
  );
  const [grammarDeepNoteNotice, setGrammarDeepNoteNotice] = useState<
    string | null
  >(null);
  const [vocabDeletingId, setVocabDeletingId] = useState<string | null>(null);
  const [grammarDeletingId, setGrammarDeletingId] = useState<string | null>(null);
  const [showMasteredVocab, setShowMasteredVocab] = useState(false);
  const [showMasteredGrammar, setShowMasteredGrammar] = useState(false);
  const [showIgnoredVocab, setShowIgnoredVocab] = useState(false);
  const [showIgnoredGrammar, setShowIgnoredGrammar] = useState(false);

  const [tab, setTab] = useState<
    "vocab" | "grammar" | "summary" | "questions"
  >("vocab");
  /** 词汇侧栏/抽屉选中（与语法独立，避免 tab 切换串台） */
  const [vocabSelection, setVocabSelection] = useState<{
    itemId: string;
    occurrenceId?: string;
  } | null>(null);
  const [grammarSelection, setGrammarSelection] = useState<{
    itemId: string;
    occurrenceId?: string;
  } | null>(null);

  /** 列表项 DOM，用于 scrollIntoView */
  const vocabItemRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const grammarItemRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  /** 点击文中高亮或手动添加后，下一帧滚动右侧面板该项 */
  const pendingPanelScrollRef = useRef<{
    kind: "vocab" | "grammar";
    id: string;
  } | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 短暂强调（约 1.8s），与 selection 独立 */
  const [flashPulse, setFlashPulse] = useState<{
    kind: "vocab" | "grammar";
    id: string;
  } | null>(null);

  /** 右侧词汇/语法列表或详情卡片 hover（或移动端短时 peek）时，左侧该条目所有 occurrence 加强高亮 */
  const [hoveredListItemId, setHoveredListItemId] = useState<{
    kind: "vocab" | "grammar";
    id: string;
  } | null>(null);
  const [touchPeekItemId, setTouchPeekItemId] = useState<{
    kind: "vocab" | "grammar";
    id: string;
  } | null>(null);
  const touchPeekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAppliedInitialFocusRef = useRef<string | null>(null);

  /** 右侧点击某条 occurrence 后，左侧对应 span 短暂 flash */
  const [flashOccurrenceId, setFlashOccurrenceId] = useState<string | null>(
    null,
  );
  const flashOccurrenceTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const vocabById = useMemo(
    () => Object.fromEntries(vocabularyItems.map((v) => [v.id, v])),
    [vocabularyItems],
  );

  const grammarById = useMemo(
    () => Object.fromEntries(grammarItems.map((g) => [g.id, g])),
    [grammarItems],
  );

  const runs = useMemo(
    () => buildRunsFromReadingItems(articlePlain, vocabularyItems, grammarItems),
    [articlePlain, vocabularyItems, grammarItems],
  );

  const selectedVocabItem = useMemo(
    () =>
      vocabSelection ? vocabById[vocabSelection.itemId] : undefined,
    [vocabById, vocabSelection],
  );
  const selectedGrammarItem = useMemo(
    () =>
      grammarSelection ? grammarById[grammarSelection.itemId] : undefined,
    [grammarById, grammarSelection],
  );

  const vocabLearningItems = useMemo(
    () =>
      vocabularyItems.filter(
        (v) => v.mastery_status !== "mastered" && v.mastery_status !== "ignored",
      ),
    [vocabularyItems],
  );
  const vocabMasteredItems = useMemo(
    () => vocabularyItems.filter((v) => v.mastery_status === "mastered"),
    [vocabularyItems],
  );
  const vocabIgnoredItems = useMemo(
    () => vocabularyItems.filter((v) => v.mastery_status === "ignored"),
    [vocabularyItems],
  );
  const grammarLearningItems = useMemo(
    () =>
      grammarItems.filter(
        (g) => g.mastery_status !== "mastered" && g.mastery_status !== "ignored",
      ),
    [grammarItems],
  );
  const grammarMasteredItems = useMemo(
    () => grammarItems.filter((g) => g.mastery_status === "mastered"),
    [grammarItems],
  );
  const grammarIgnoredItems = useMemo(
    () => grammarItems.filter((g) => g.mastery_status === "ignored"),
    [grammarItems],
  );

  const vocabLearningWordStats = useMemo(() => {
    const articleTokens = extractWordTokens(articlePlain);
    const totalWordCount = articleTokens.length;
    const articleWordSet = new Set(articleTokens);

    const learningWordSet = new Set<string>();

    for (const item of vocabularyItems) {
      const candidates = [
        item.lemma,
        item.display_word,
        item.occurrences[0]?.surface_form,
      ].filter((v): v is string => Boolean(v && v.trim()));

      const isUnknownWord =
        item.mastery_status !== "mastered";
      if (!isUnknownWord) continue;

      for (const candidate of candidates) {
        for (const token of extractWordTokens(candidate)) {
          if (!articleWordSet.has(token)) continue;
          if (isUnknownWord) learningWordSet.add(token);
        }
      }
    }

    const unknownWordCount = learningWordSet.size;
    const unknownRatio =
      totalWordCount > 0 ? unknownWordCount / totalWordCount : 0;

    return {
      unknownWordCount,
      totalWordCount,
      unknownRatio,
    };
  }, [articlePlain, vocabularyItems]);

  const selectedVocabOccurrence = useMemo(() => {
    if (!selectedVocabItem || !vocabSelection) return undefined;
    if (vocabSelection.occurrenceId) {
      return selectedVocabItem.occurrences.find(
        (o) => o.id === vocabSelection.occurrenceId,
      );
    }
    return selectedVocabItem.occurrences[0];
  }, [selectedVocabItem, vocabSelection]);

  const selectedSense = useMemo(() => {
    if (!selectedVocabItem) return undefined;
    const sid = selectedVocabOccurrence?.sense_id;
    if (sid) {
      return (
        selectedVocabItem.senses.find((s) => s.id === sid) ??
        selectedVocabItem.senses.find((s) => s.dbSenseId === sid)
      );
    }
    return selectedVocabItem.senses[0];
  }, [selectedVocabItem, selectedVocabOccurrence]);

  const selectedGrammarOccurrence = useMemo(() => {
    if (!selectedGrammarItem || !grammarSelection) return undefined;
    if (grammarSelection.occurrenceId) {
      return selectedGrammarItem.occurrences.find(
        (o) => o.id === grammarSelection.occurrenceId,
      );
    }
    return selectedGrammarItem.occurrences[0];
  }, [selectedGrammarItem, grammarSelection]);

  const overlappingAiVocabForDetail = useMemo(() => {
    if (!selectedVocabItem) return [];
    if (!selectedVocabOccurrence?.start_offset || !selectedVocabOccurrence.end_offset)
      return [];
    if (!vocabUserStyle(selectedVocabItem)) return [];
    return overlappingAiVocabIdsForRange(
      selectedVocabOccurrence.start_offset,
      selectedVocabOccurrence.end_offset,
      chunkIntervals,
    ).filter(
      (id) =>
        id !== selectedVocabItem.id &&
        (vocabById[id]?.source === "ai_detected" ||
          vocabById[id]?.source === "ai_mock" ||
          vocabById[id]?.source === "ai"),
    );
  }, [selectedVocabOccurrence, selectedVocabItem, chunkIntervals, vocabById]);

  const overlappingUserVocabForAiDetail = useMemo(() => {
    if (!vocabSelection || !selectedVocabItem) return [];
    if (vocabUserStyle(selectedVocabItem)) return [];
    const occ =
      selectedVocabItem.occurrences.find(
        (o) => o.id === vocabSelection.occurrenceId,
      ) ?? selectedVocabItem.occurrences[0];
    if (occ?.start_offset === undefined || occ.end_offset === undefined)
      return [];
    return vocabularyItems
      .filter((v) => vocabUserStyle(v))
      .filter((v) =>
        v.occurrences.some((uo) => {
          for (const r of vocabOccurrenceToRanges(uo, articlePlain)) {
            if (r.start < occ.end_offset! && r.end > occ.start_offset!)
              return true;
          }
          return false;
        }),
      )
      .map((v) => v.id);
  }, [vocabSelection, selectedVocabItem, vocabularyItems, articlePlain]);

  const clearNativeSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
  }, []);

  const updateSelectionPopover = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      selectionTextSnapshotRef.current = null;
      setTextSelectionUi(null);
      return;
    }
    const text = sel.toString().trim();
    if (!text) {
      selectionTextSnapshotRef.current = null;
      setTextSelectionUi(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const root = articleRef.current;
    if (!root || !root.contains(range.commonAncestorContainer)) {
      selectionTextSnapshotRef.current = null;
      setTextSelectionUi(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      selectionTextSnapshotRef.current = null;
      setTextSelectionUi(null);
      return;
    }
    const left = Math.min(
      Math.max(rect.left + rect.width / 2, 16),
      window.innerWidth - 16,
    );
    const top = Math.min(rect.bottom + 8, window.innerHeight - 100);
    selectionTextSnapshotRef.current = text;
    setTextSelectionUi({ text, left, top });
  }, []);

  const handleArticlePointerUp = useCallback(() => {
    requestAnimationFrame(updateSelectionPopover);
  }, [updateSelectionPopover]);

  useEffect(() => {
    const onSelectionChange = () => {
      requestAnimationFrame(updateSelectionPopover);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, [updateSelectionPopover]);

  useEffect(() => {
    const onScroll = () => {
      selectionTextSnapshotRef.current = null;
      setTextSelectionUi(null);
    };
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, []);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (selectionPopoverRef.current?.contains(target)) return;
      if (articleRef.current?.contains(target)) return;
      selectionTextSnapshotRef.current = null;
      setTextSelectionUi(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current !== null) {
        clearTimeout(flashTimeoutRef.current);
      }
      if (touchPeekTimeoutRef.current !== null) {
        clearTimeout(touchPeekTimeoutRef.current);
      }
      if (flashOccurrenceTimeoutRef.current !== null) {
        clearTimeout(flashOccurrenceTimeoutRef.current);
      }
    };
  }, []);

  function runMetaListKind(m: RunMeta): "vocab" | "grammar" {
    return m.kind === "ai_vocab" || m.kind === "user_vocab"
      ? "vocab"
      : "grammar";
  }

  const listHighlightTarget = hoveredListItemId ?? touchPeekItemId;

  function triggerTouchPeek(kind: "vocab" | "grammar", id: string) {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(hover: none)").matches) return;
    setTouchPeekItemId({ kind, id });
    if (touchPeekTimeoutRef.current !== null) {
      clearTimeout(touchPeekTimeoutRef.current);
    }
    touchPeekTimeoutRef.current = setTimeout(() => {
      setTouchPeekItemId(null);
      touchPeekTimeoutRef.current = null;
    }, 2200);
  }

  /** 语法侧：同一 occurrenceId 在文中可能对应多处 `data-range-id`；词汇仍只传 occurrenceId。 */
  const scrollArticleToOccurrence = useCallback(
    (
      occurrenceId: string,
      disambiguateRange?: { start: number; end: number },
      articleScrollOptions?: { ensureGapBottom?: number },
    ) => {
    const articleRoot = articleRef.current;
    const scrollParent = articleScrollRef.current;
    if (!articleRoot) return;
    const safeId =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(occurrenceId)
        : occurrenceId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    let el: HTMLElement | null = null;
    if (
      disambiguateRange &&
      Number.isFinite(disambiguateRange.start) &&
      Number.isFinite(disambiguateRange.end)
    ) {
      const rk = `${disambiguateRange.start}-${disambiguateRange.end}`;
      el = articleRoot.querySelector<HTMLElement>(
        `[data-occurrence-id="${safeId}"][data-range-id="${rk}"]`,
      );
    }
    if (!el) {
      el = articleRoot.querySelector<HTMLElement>(
        `[data-occurrence-id="${safeId}"]`,
      );
    }
    if (!el) return;
    if (scrollParent && scrollParent.contains(el)) {
      scrollElementIntoScrollContainer(scrollParent, el, {
        paddingTop: 80,
        behavior: "smooth",
        ensureGapBottom: articleScrollOptions?.ensureGapBottom,
      });
    } else {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    setFlashOccurrenceId(occurrenceId);
    if (flashOccurrenceTimeoutRef.current !== null) {
      clearTimeout(flashOccurrenceTimeoutRef.current);
    }
    flashOccurrenceTimeoutRef.current = setTimeout(() => {
      setFlashOccurrenceId(null);
      flashOccurrenceTimeoutRef.current = null;
    }, 1400);
  },
  []);

  const triggerFlashPulse = useCallback(
    (kind: "vocab" | "grammar", id: string) => {
      setFlashPulse({ kind, id });
      if (flashTimeoutRef.current !== null) {
        clearTimeout(flashTimeoutRef.current);
      }
      flashTimeoutRef.current = setTimeout(() => {
        setFlashPulse(null);
        flashTimeoutRef.current = null;
      }, 1800);
    },
    [],
  );

  const selectVocabItem = useCallback(
    (itemId: string, occurrenceId?: string) => {
      setVocabSelection({ itemId, occurrenceId });
      setTab("vocab");
      pendingPanelScrollRef.current = { kind: "vocab", id: itemId };
      triggerFlashPulse("vocab", itemId);
    },
    [triggerFlashPulse],
  );

  const selectGrammarItem = useCallback(
    (itemId: string, occurrenceId?: string) => {
      setGrammarSelection({ itemId, occurrenceId });
      setTab("grammar");
      pendingPanelScrollRef.current = { kind: "grammar", id: itemId };
      triggerFlashPulse("grammar", itemId);
    },
    [triggerFlashPulse],
  );

  useEffect(() => {
    if (!initialFocus) return;
    const focusKey = `${initialFocus.kind}:${initialFocus.itemId ?? ""}:${
      initialFocus.occurrenceId ?? ""
    }`;
    if (lastAppliedInitialFocusRef.current === focusKey) return;

    if (initialFocus.kind === "vocab") {
      const target = vocabularyItems.find(
        (v) =>
          v.id === initialFocus.itemId ||
          v.dbItemId === initialFocus.itemId ||
          v.occurrences.some((o) => o.id === initialFocus.occurrenceId),
      );
      if (!target) return;
      const occurrence =
        target.occurrences.find((o) => o.id === initialFocus.occurrenceId) ??
        target.occurrences[0];
      selectVocabItem(target.id, occurrence?.id);
      if (occurrence) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollArticleToOccurrence(occurrence.id);
          });
        });
      }
      lastAppliedInitialFocusRef.current = focusKey;
      return;
    }

    const target = grammarItems.find(
      (g) =>
        g.id === initialFocus.itemId ||
        g.dbItemId === initialFocus.itemId ||
        g.occurrences.some((o) => o.id === initialFocus.occurrenceId),
    );
    if (!target) return;
    const occurrence =
      target.occurrences.find((o) => o.id === initialFocus.occurrenceId) ??
      target.occurrences[0];
    selectGrammarItem(target.id, occurrence?.id);
    if (occurrence) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollArticleToOccurrence(
            occurrence.id,
            occurrence.start_offset !== undefined &&
              occurrence.end_offset !== undefined
              ? {
                  start: occurrence.start_offset,
                  end: occurrence.end_offset,
                }
              : undefined,
          );
        });
      });
    }
    lastAppliedInitialFocusRef.current = focusKey;
  }, [
    grammarItems,
    initialFocus,
    scrollArticleToOccurrence,
    selectGrammarItem,
    selectVocabItem,
    vocabularyItems,
  ]);

  useEffect(() => {
    setVocabEnrichError(null);
    setVocabEnrichErrorItemId(null);
  }, [vocabSelection?.itemId]);

  useEffect(() => {
    setGrammarEnrichError(null);
    setGrammarEnrichErrorItemId(null);
  }, [grammarSelection?.itemId]);

  /** 窄屏打开语法详情抽屉时，把对应高亮滚到抽屉上方，避免蓝/紫条被挡；抽屉遮罩不拦截触摸，便于继续在课文里选词 */
  useEffect(() => {
    if (!grammarSelection) return;
    const narrow =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches;
    if (!narrow) return;
    const item = grammarById[grammarSelection.itemId];
    if (!item) return;
    const occ =
      item.occurrences.find((o) => o.id === grammarSelection.occurrenceId) ??
      item.occurrences[0];
    if (!occ) return;
    const range =
      occ.start_offset !== undefined && occ.end_offset !== undefined
        ? { start: occ.start_offset, end: occ.end_offset }
        : undefined;
    const reserve =
      typeof window !== "undefined"
        ? Math.min(Math.round(window.innerHeight * 0.48), 380)
        : 320;
    const tid = window.setTimeout(() => {
      scrollArticleToOccurrence(occ.id, range, {
        ensureGapBottom: reserve,
      });
    }, 100);
    return () => window.clearTimeout(tid);
  }, [grammarSelection, grammarById, scrollArticleToOccurrence]);

  /** 词汇详情抽屉同理：滚到抽屉上方留白 */
  useEffect(() => {
    if (!vocabSelection) return;
    const narrow =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches;
    if (!narrow) return;
    const item = vocabById[vocabSelection.itemId];
    if (!item) return;
    const occ =
      item.occurrences.find((o) => o.id === vocabSelection.occurrenceId) ??
      item.occurrences[0];
    if (!occ) return;
    const tid = window.setTimeout(() => {
      scrollArticleToOccurrence(occ.id, undefined, {
        ensureGapBottom:
          typeof window !== "undefined"
            ? Math.min(Math.round(window.innerHeight * 0.48), 380)
            : 320,
      });
    }, 100);
    return () => window.clearTimeout(tid);
  }, [vocabSelection, vocabById, scrollArticleToOccurrence]);

  useEffect(() => {
    setVocabDeepNoteError(null);
    setVocabDeepNoteNotice(null);
  }, [vocabSelection?.itemId]);

  useEffect(() => {
    setGrammarDeepNoteError(null);
    setGrammarDeepNoteNotice(null);
  }, [grammarSelection?.itemId]);

  function formatDeepNoteUpdatedAt(v: string | null | undefined): string {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("zh-Hans", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  async function readClipboardTextForDeepNote(): Promise<string | null> {
    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.readText !== "function"
    ) {
      return null;
    }
    const text = await navigator.clipboard.readText();
    return text.trim() ? text : null;
  }

  async function pasteVocabDeepNoteFromClipboard(itemId: string) {
    setVocabDeepNoteError(null);
    setVocabDeepNoteNotice(null);
    try {
      const text = await readClipboardTextForDeepNote();
      if (!text) {
        setVocabDeepNoteError("剪贴板为空，或当前浏览器不允许读取剪贴板。");
        return;
      }
      setVocabDeepNoteDrafts((prev) => ({
        ...prev,
        [itemId]: normalizeDeepNoteMarkdown(text),
      }));
      setVocabDeepNoteNotice("已从剪贴板读取并整理格式，请确认后保存。");
    } catch {
      setVocabDeepNoteError("读取剪贴板失败，请手动粘贴外部 AI 的回答。");
    }
  }

  async function pasteGrammarDeepNoteFromClipboard(itemId: string) {
    setGrammarDeepNoteError(null);
    setGrammarDeepNoteNotice(null);
    try {
      const text = await readClipboardTextForDeepNote();
      if (!text) {
        setGrammarDeepNoteError("剪贴板为空，或当前浏览器不允许读取剪贴板。");
        return;
      }
      setGrammarDeepNoteDrafts((prev) => ({
        ...prev,
        [itemId]: normalizeDeepNoteMarkdown(text),
      }));
      setGrammarDeepNoteNotice("已从剪贴板读取并整理格式，请确认后保存。");
    } catch {
      setGrammarDeepNoteError("读取剪贴板失败，请手动粘贴外部 AI 的回答。");
    }
  }

  async function saveVocabDeepNote(item: ArticleVocabItem, note: string) {
    if (!persistEnabled || !persistUserId || !item.dbItemId) {
      setVocabDeepNoteError("该词条尚未保存到云端，无法保存深度笔记。");
      return;
    }
    setVocabDeepNoteSavingId(item.id);
    setVocabDeepNoteError(null);
    setVocabDeepNoteNotice(null);
    try {
      const normalizedNote = normalizeDeepNoteMarkdown(note);
      const sb = getSupabaseBrowserClient();
      const { note: savedNote, updatedAt, error } =
        await updateVocabularyItemDeepNote(
          sb,
          persistUserId,
          item.dbItemId,
          normalizedNote,
        );
      if (error) {
        setVocabDeepNoteError(error);
        return;
      }
      setVocabularyItems((prev) =>
        prev.map((v) =>
          v.id === item.id
            ? {
                ...v,
                user_deep_note: savedNote,
                user_deep_note_updated_at: updatedAt,
              }
            : v,
        ),
      );
      setVocabDeepNoteDrafts((prev) => ({ ...prev, [item.id]: savedNote ?? "" }));
      setVocabDeepNoteNotice(savedNote ? "深度笔记已保存。" : "深度笔记已清空。");
    } catch (e: unknown) {
      setVocabDeepNoteError(formatSupabaseOrUnknownError(e));
    } finally {
      setVocabDeepNoteSavingId(null);
    }
  }

  async function saveGrammarDeepNote(item: ArticleGrammarItem, note: string) {
    if (!persistEnabled || !persistUserId || !item.dbItemId) {
      setGrammarDeepNoteError("该语法项尚未保存到云端，无法保存深度笔记。");
      return;
    }
    setGrammarDeepNoteSavingId(item.id);
    setGrammarDeepNoteError(null);
    setGrammarDeepNoteNotice(null);
    try {
      const normalizedNote = normalizeDeepNoteMarkdown(note);
      const sb = getSupabaseBrowserClient();
      const { note: savedNote, updatedAt, error } =
        await updateGrammarItemDeepNote(
          sb,
          persistUserId,
          item.dbItemId,
          normalizedNote,
        );
      if (error) {
        setGrammarDeepNoteError(error);
        return;
      }
      setGrammarItems((prev) =>
        prev.map((g) =>
          g.id === item.id
            ? {
                ...g,
                user_deep_note: savedNote,
                user_deep_note_updated_at: updatedAt,
              }
            : g,
        ),
      );
      setGrammarDeepNoteDrafts((prev) => ({
        ...prev,
        [item.id]: savedNote ?? "",
      }));
      setGrammarDeepNoteNotice(savedNote ? "深度笔记已保存。" : "深度笔记已清空。");
    } catch (e: unknown) {
      setGrammarDeepNoteError(formatSupabaseOrUnknownError(e));
    } finally {
      setGrammarDeepNoteSavingId(null);
    }
  }

  useEffect(() => {
    if (selectedVocabItem?.mastery_status === "mastered") {
      setShowMasteredVocab(true);
    } else if (selectedVocabItem?.mastery_status === "ignored") {
      setShowIgnoredVocab(true);
    }
  }, [selectedVocabItem?.id, selectedVocabItem?.mastery_status]);

  useEffect(() => {
    if (selectedGrammarItem?.mastery_status === "mastered") {
      setShowMasteredGrammar(true);
    } else if (selectedGrammarItem?.mastery_status === "ignored") {
      setShowIgnoredGrammar(true);
    }
  }, [selectedGrammarItem?.id, selectedGrammarItem?.mastery_status]);

  const handleEnrichVocabForItem = useCallback(
    async (itemId: string, opts?: { regenerate?: boolean }) => {
      if (!persistEnabled || !persistArticleId) return;
      const v = vocabularyItems.find((x) => x.id === itemId);
      if (!v?.dbItemId || v.source !== "user_added") {
        return;
      }
      const regenerate = opts?.regenerate === true;
      if (regenerate) {
        if (!vocabExplanationsComplete(v)) return;
        if (typeof window !== "undefined" && !window.confirm(CONFIRM_AI_REGENERATE_ZH)) {
          return;
        }
      } else if (!vocabNeedsAiEnrichEntry(v)) {
        return;
      }
      setVocabEnrichLoadingId(v.id);
      setVocabEnrichError(null);
      setVocabEnrichErrorItemId(null);
      try {
        const sb = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await sb.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          setVocabEnrichError("请先登录后再试。");
          setVocabEnrichErrorItemId(v.id);
          return;
        }
        const res = await fetch("/api/enrich-vocabulary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            articleId: persistArticleId,
            vocabularyItemId: v.dbItemId,
            userLevel: enrichLevelEffective,
          }),
        });
        const data: unknown = await res.json().catch(() => null);
        if (!data || typeof data !== "object") {
          setVocabEnrichError(`请求失败（${res.status}）`);
          setVocabEnrichErrorItemId(v.id);
          return;
        }
        const d = data as Record<string, unknown>;
        if (d.ok !== true) {
          const err =
            typeof d.error === "string"
              ? d.error
              : "补充失败，请稍后重试。";
          setVocabEnrichError(err);
          setVocabEnrichErrorItemId(v.id);
          return;
        }
        const lev = d.level_estimate;
        if (
          typeof lev !== "string" ||
          !["A1", "A2", "B1", "B2", "C1", "C2"].includes(lev)
        ) {
          setVocabEnrichError("返回数据异常（水平）。");
          setVocabEnrichErrorItemId(v.id);
          return;
        }
        setVocabularyItems((prev) =>
          prev.map((it) =>
            it.id === v.id
              ? mergeVocabFromEnrichmentApi(it, {
                  canonical_form: String(d.canonical_form ?? ""),
                  surface_form: String(d.surface_form ?? ""),
                  zh_meaning: String(d.zh_meaning ?? ""),
                  simple_de_explanation: String(d.simple_de_explanation ?? ""),
                  part_of_speech: String(d.part_of_speech ?? ""),
                  level_estimate: lev as CefrLevel,
                  reason_for_selection: String(d.reason_for_selection ?? ""),
                  example_sentence: String(d.example_sentence ?? ""),
                })
              : it,
          ),
        );
      } catch (e: unknown) {
        setVocabEnrichError(
          e instanceof Error ? e.message : "网络错误，请稍后重试。",
        );
        setVocabEnrichErrorItemId(itemId);
      } finally {
        setVocabEnrichLoadingId(null);
      }
    },
    [vocabularyItems, persistEnabled, persistArticleId, enrichLevelEffective],
  );

  const handleEnrichGrammarForItem = useCallback(
    async (itemId: string, opts?: { regenerate?: boolean }) => {
      if (!persistEnabled || !persistArticleId) return;
      const g = grammarItems.find((x) => x.id === itemId);
      if (!g?.dbItemId || g.source !== "user_added") {
        return;
      }
      const regenerate = opts?.regenerate === true;
      if (regenerate) {
        if (!grammarExplanationsComplete(g)) return;
        if (typeof window !== "undefined" && !window.confirm(CONFIRM_AI_REGENERATE_ZH)) {
          return;
        }
      } else if (!grammarNeedsAiEnrichEntry(g)) {
        return;
      }
      setGrammarEnrichLoadingId(g.id);
      setGrammarEnrichError(null);
      setGrammarEnrichErrorItemId(null);
      try {
        const sb = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await sb.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          setGrammarEnrichError("请先登录后再试。");
          setGrammarEnrichErrorItemId(g.id);
          return;
        }
        const res = await fetch("/api/enrich-grammar", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            articleId: persistArticleId,
            grammarItemId: g.dbItemId,
            userLevel: enrichLevelEffective,
          }),
        });
        const data: unknown = await res.json().catch(() => null);
        if (!data || typeof data !== "object") {
          setGrammarEnrichError(`请求失败（${res.status}）`);
          setGrammarEnrichErrorItemId(g.id);
          return;
        }
        const d = data as Record<string, unknown>;
        if (d.ok !== true) {
          const err =
            typeof d.error === "string"
              ? d.error
              : "补充失败，请稍后重试。";
          setGrammarEnrichError(err);
          setGrammarEnrichErrorItemId(g.id);
          return;
        }
        const lev = d.level_estimate;
        if (
          typeof lev !== "string" ||
          !["A1", "A2", "B1", "B2", "C1", "C2"].includes(lev)
        ) {
          setGrammarEnrichError("返回数据异常（水平）。");
          setGrammarEnrichErrorItemId(g.id);
          return;
        }
        setGrammarItems((prev) =>
          prev.map((it) =>
            it.id === g.id
              ? mergeGrammarFromEnrichmentApi(it, {
                  name_de: String(d.name_de ?? ""),
                  name_zh: String(d.name_zh ?? ""),
                  explanation_zh: String(d.explanation_zh ?? ""),
                  explanation_de_simple: String(d.explanation_de_simple ?? ""),
                  level_estimate: lev as CefrLevel,
                  reason_for_selection: String(d.reason_for_selection ?? ""),
                })
              : it,
          ),
        );
      } catch (e: unknown) {
        setGrammarEnrichError(
          e instanceof Error ? e.message : "网络错误，请稍后重试。",
        );
        setGrammarEnrichErrorItemId(itemId);
      } finally {
        setGrammarEnrichLoadingId(null);
      }
    },
    [grammarItems, persistEnabled, persistArticleId, enrichLevelEffective],
  );

  useEffect(() => {
    const pending = pendingPanelScrollRef.current;
    if (pending) {
      pendingPanelScrollRef.current = null;
    }

    const run = () => {
      const panel = sidePanelScrollRef.current;

      /** 仅在有 pending（文中/列表选中）时滚右侧面板 occurrence；右侧详情里点「本篇出现位置」不设 pending，避免与 scrollArticleToOccurrence 的 smooth 争抢导致左侧不滚 */
      if (pending) {
        const map =
          pending.kind === "vocab" ? vocabItemRefs : grammarItemRefs;
        const el = map.current.get(pending.id);
        if (el && panel) {
          scrollElementIntoScrollContainer(panel, el, {
            paddingTop: 24,
            behavior: "smooth",
            align: "center",
          });
        } else if (el) {
          el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        run();
        setTimeout(run, 0);
        setTimeout(run, 80);
      });
    });
  }, [tab, vocabularyItems, grammarItems, vocabSelection, grammarSelection]);

  const setVocabMastery = useCallback(
    (uiItemId: string, status: MasteryStatus) => {
      setVocabularyItems((items) => {
        const target = items.find((x) => x.id === uiItemId);
        const dbId = target?.dbItemId ?? null;

        if (persistEnabled && persistUserId) {
          if (!dbId) {
            queueMicrotask(() =>
              emitPersistError("该词条尚未保存到云端，无法同步状态。"),
            );
          } else {
            queueMicrotask(() => {
              void (async () => {
                const sb = getSupabaseBrowserClient();
                const { error } = await updateVocabularyItemMastery(
                  sb,
                  persistUserId,
                  dbId,
                  status,
                );
                if (error)
                  emitPersistError(`词汇状态保存失败：${error}`);
              })();
            });
          }
        }

        return items.map((x) =>
          x.id === uiItemId ? { ...x, mastery_status: status } : x,
        );
      });
    },
    [emitPersistError, persistEnabled, persistUserId],
  );

  const setGrammarMastery = useCallback(
    (uiItemId: string, status: MasteryStatus) => {
      setGrammarItems((items) => {
        const target = items.find((x) => x.id === uiItemId);
        const dbId = target?.dbItemId ?? null;

        if (persistEnabled && persistUserId) {
          if (!dbId) {
            queueMicrotask(() =>
              emitPersistError("该语法条目尚未保存到云端，无法同步状态。"),
            );
          } else {
            queueMicrotask(() => {
              void (async () => {
                const sb = getSupabaseBrowserClient();
                const { error } = await updateGrammarItemMastery(
                  sb,
                  persistUserId,
                  dbId,
                  status,
                );
                if (error)
                  emitPersistError(`语法状态保存失败：${error}`);
              })();
            });
          }
        }

        return items.map((x) =>
          x.id === uiItemId ? { ...x, mastery_status: status } : x,
        );
      });
    },
    [emitPersistError, persistEnabled, persistUserId],
  );

  const requestDeleteVocabItem = useCallback(
    (item: ArticleVocabItem) => {
      if (!window.confirm(DELETE_LEARNING_ITEM_CONFIRM_ZH)) return;
      void (async () => {
        const id = item.id;
        if (
          !persistEnabled ||
          !persistArticleId ||
          !persistUserId ||
          !item.dbItemId
        ) {
          setVocabularyItems((prev) => prev.filter((x) => x.id !== id));
          setVocabSelection((sel) => (sel?.itemId === id ? null : sel));
          return;
        }
        setVocabDeletingId(id);
        try {
          const sb = getSupabaseBrowserClient();
          const { error } = await deleteArticleVocabularyItemOccurrences(sb, {
            userId: persistUserId,
            articleId: persistArticleId,
            vocabularyItemId: item.dbItemId,
          });
          if (error) {
            emitPersistError(`删除词汇失败：${error}`);
            return;
          }
          setVocabularyItems((prev) => prev.filter((x) => x.id !== id));
          setVocabSelection((sel) => (sel?.itemId === id ? null : sel));
        } finally {
          setVocabDeletingId(null);
        }
      })();
    },
    [emitPersistError, persistArticleId, persistEnabled, persistUserId],
  );

  const requestDeleteGrammarItem = useCallback(
    (item: ArticleGrammarItem) => {
      if (!window.confirm(DELETE_LEARNING_ITEM_CONFIRM_ZH)) return;
      void (async () => {
        const id = item.id;
        if (
          !persistEnabled ||
          !persistArticleId ||
          !persistUserId ||
          !item.dbItemId
        ) {
          setGrammarItems((prev) => prev.filter((x) => x.id !== id));
          setGrammarSelection((sel) => (sel?.itemId === id ? null : sel));
          return;
        }
        setGrammarDeletingId(id);
        try {
          const sb = getSupabaseBrowserClient();
          const { error } = await deleteArticleGrammarItemOccurrences(sb, {
            userId: persistUserId,
            articleId: persistArticleId,
            grammarItemId: item.dbItemId,
          });
          if (error) {
            emitPersistError(`删除语法失败：${error}`);
            return;
          }
          setGrammarItems((prev) => prev.filter((x) => x.id !== id));
          setGrammarSelection((sel) => (sel?.itemId === id ? null : sel));
        } finally {
          setGrammarDeletingId(null);
        }
      })();
    },
    [emitPersistError, persistArticleId, persistEnabled, persistUserId],
  );

  useEffect(() => {
    setGrammarExternalPromptNotice(null);
  }, [selectedGrammarItem?.id]);

  useEffect(() => {
    setVocabExternalPromptNotice(null);
  }, [selectedVocabItem?.id]);

  const runGrammarExternalPrompt = useCallback(
    async (openUrl: string | null) => {
      if (!selectedGrammarItem || !grammarSelection) return;
      const occ = selectedGrammarOccurrence;
      const nameParts = [
        selectedGrammarItem.name_zh,
        selectedGrammarItem.name_de,
      ]
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter(Boolean);
      const grammarName = nameParts.join(" / ");
      const prompt = buildGrammarExternalDeepDivePrompt({
        userLevel: enrichLevelEffective,
        grammarName,
        selectedText: occ?.surface_form ?? "",
        occurrenceSentence: occ?.sentence ?? "",
        articleTitle: metaTitle,
        explanationZh: selectedGrammarItem.explanation_zh ?? "",
        explanationDeSimple: selectedGrammarItem.explanation_de_simple ?? "",
      });
      try {
        await navigator.clipboard.writeText(prompt);
        if (openUrl) {
          window.open(openUrl, "_blank", "noopener,noreferrer");
          setGrammarExternalPromptNotice(
            "Prompt 已复制，可直接 Ctrl+V 粘贴并发送。",
          );
        } else {
          setGrammarExternalPromptNotice(
            "Prompt 已复制，可直接 Ctrl+V 粘贴并发送。",
          );
        }
      } catch {
        setGrammarExternalPromptNotice("复制失败，请手动复制 Prompt。");
      }
    },
    [
      enrichLevelEffective,
      grammarSelection,
      metaTitle,
      selectedGrammarItem,
      selectedGrammarOccurrence,
    ],
  );

  const runVocabExternalPrompt = useCallback(
    async (openUrl: string | null) => {
      if (!selectedVocabItem || !vocabSelection) return;
      const occ = selectedVocabOccurrence;
      const displayTerm =
        selectedVocabItem.display_word?.trim() ||
        selectedVocabItem.lemma?.trim() ||
        "";
      const canonicalForm = selectedVocabItem.lemma?.trim() ?? "";
      const surfaceForm = occ?.surface_form?.trim() ?? "";
      const rawPos = (selectedVocabItem.part_of_speech ?? "").trim();
      const partOfSpeechOrItemType = rawPos
        ? `${posLabelZh(selectedVocabItem.part_of_speech)}（${rawPos}）`
        : "";
      const zhMeaning =
        selectedSense?.zh_meaning ?? selectedVocabItem.zh_meaning ?? "";
      const simpleDeExplanation =
        selectedSense?.simple_de_explanation ??
        selectedVocabItem.simple_de_explanation ??
        "";
      const lev = selectedVocabItem.level_estimate;
      const levelEstimate =
        lev != null && String(lev).trim() ? String(lev).trim() : "";
      const prompt = buildVocabularyExternalDeepDivePrompt({
        userLevel: enrichLevelEffective,
        displayTerm,
        canonicalForm,
        surfaceForm,
        partOfSpeechOrItemType,
        articleTitle: metaTitle,
        occurrenceSentence: occ?.sentence ?? "",
        zhMeaning,
        simpleDeExplanation,
        levelEstimate,
      });
      try {
        await navigator.clipboard.writeText(prompt);
        if (openUrl) {
          window.open(openUrl, "_blank", "noopener,noreferrer");
          setVocabExternalPromptNotice(
            "Prompt 已复制，可直接 Ctrl+V 粘贴并发送。",
          );
        } else {
          setVocabExternalPromptNotice(
            "Prompt 已复制，可直接 Ctrl+V 粘贴并发送。",
          );
        }
      } catch {
        setVocabExternalPromptNotice("复制失败，请手动复制 Prompt。");
      }
    },
    [
      enrichLevelEffective,
      metaTitle,
      selectedSense,
      selectedVocabItem,
      selectedVocabOccurrence,
      vocabSelection,
    ],
  );

  async function addVocabFromText(
    phraseTrimmed: string,
    domRange: Range | null,
  ) {
    const t = phraseTrimmed.trim();
    if (!t) return;
    const root = articleRef.current;
    const resolved = resolveUserHighlightInPlain(
      root,
      domRange,
      articlePlain,
      phraseTrimmed,
    );
    const surface = resolved?.surface ?? t;
    const { nextItems, itemId, occurrenceId } = mergeVocabOccurrence(
      vocabularyItems,
      articlePlain,
      surface,
      resolved,
    );
    const preItem = nextItems.find((v) => v.id === itemId);
    const preOcc = preItem?.occurrences.find((o) => o.id === occurrenceId);

    let merged = finalizeArticleVocabularyItems(nextItems, articlePlain);
    let selectItemId = itemId;
    let selectOccId = alignVocabOccurrenceIdAfterFinalize(
      itemId,
      nextItems,
      occurrenceId,
      merged,
    );

    const targetMerged = merged.find((v) => v.id === itemId);

    if (
      persistEnabled &&
      persistArticleId &&
      persistUserId &&
      targetMerged
    ) {
      const sb = getSupabaseBrowserClient();
      const { item: saved, error } = await persistManualVocabularyItem(sb, {
        userId: persistUserId,
        articleId: persistArticleId,
        articlePlain,
        item: targetMerged,
      });
      if (error) {
        emitPersistError(`词汇保存失败：${error}`);
      } else if (saved) {
        merged = merged.map((v) =>
          v.normalized_key === saved.normalized_key ? saved : v,
        );
        selectItemId = saved.id;
        selectOccId = alignVocabOccurrenceIdAfterPersist(
          preOcc,
          saved,
          selectOccId,
        );
      }
    }

    setVocabularyItems(merged);
    selectionTextSnapshotRef.current = null;
    setTextSelectionUi(null);
    clearNativeSelection();
    selectVocabItem(selectItemId, selectOccId);
  }

  async function addGrammarFromText(
    phraseTrimmed: string,
    domRange: Range | null,
  ) {
    const t = phraseTrimmed.trim();
    if (!t) return;
    const root = articleRef.current;
    const resolved = resolveUserHighlightInPlain(
      root,
      domRange,
      articlePlain,
      phraseTrimmed,
    );
    const surface = resolved?.surface ?? t;
    const { nextItems, itemId, occurrenceId } = resolved
      ? mergeGrammarOccurrence(
          grammarItems,
          articlePlain,
          surface,
          resolved,
        )
      : mergeGrammarFromFormText(grammarItems, articlePlain, surface);
    let merged = expandGrammarItemsWithRepeatedSurface(nextItems, articlePlain);
    let selectItemId = itemId;
    let selectOccId = occurrenceId;

    const targetMerged = merged.find((g) => g.id === itemId);
    const prevOccSnapshot = targetMerged?.occurrences.find(
      (o) => o.id === occurrenceId,
    );

    if (
      persistEnabled &&
      persistArticleId &&
      persistUserId &&
      targetMerged
    ) {
      const sb = getSupabaseBrowserClient();
      const { item: saved, error } = await persistManualGrammarItem(sb, {
        userId: persistUserId,
        articleId: persistArticleId,
        articlePlain,
        item: targetMerged,
      });
      if (error) {
        emitPersistError(`语法保存失败：${error}`);
      } else if (saved) {
        merged = merged.map((g) =>
          g.normalized_key === saved.normalized_key ? saved : g,
        );
        selectItemId = saved.id;
        selectOccId = prevOccSnapshot
          ? saved.occurrences.find(
              (o) =>
                occurrencePositionKey(o) ===
                occurrencePositionKey(prevOccSnapshot),
            )?.id ??
            saved.occurrences[0]?.id ??
            occurrenceId
          : occurrenceId;
      }
    }

    setGrammarItems(merged);
    selectionTextSnapshotRef.current = null;
    setTextSelectionUi(null);
    clearNativeSelection();
    selectGrammarItem(selectItemId, selectOccId);
  }

  function cloneDomRangeInArticle(): Range | null {
    const root = articleRef.current;
    const sel = window.getSelection();
    if (!root || !sel?.rangeCount) return null;
    const r = sel.getRangeAt(0);
    if (!root.contains(r.commonAncestorContainer)) return null;
    return r.cloneRange();
  }

  function onPopoverSpeak() {
    const phrase =
      textSelectionUi?.text ?? selectionTextSnapshotRef.current ?? "";
    if (!phrase) return;
    const ok = speakGerman(phrase, "de-DE");
    if (!ok && typeof window !== "undefined") {
      window.alert("当前浏览器暂不支持发音。");
    }
  }

  const showMobileSheet =
    (tab === "vocab" && Boolean(vocabSelection)) ||
    (tab === "grammar" && Boolean(grammarSelection));

  const vocabDetailOnly = (
    <div className="space-y-4">
      {selectedVocabItem ? (
        <Card
          className="border-emerald-200/80 dark:border-emerald-900/50"
          onMouseEnter={() =>
            setHoveredListItemId({ kind: "vocab", id: selectedVocabItem.id })
          }
          onMouseLeave={() => setHoveredListItemId(null)}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="min-w-0 break-words">
                  {vocabularyHeadwordDe(
                    selectedVocabItem.display_word,
                    selectedVocabItem.lemma,
                    selectedVocabItem.grammatical_gender,
                  )}
                </CardTitle>
                {vocabBadge(selectedVocabItem.source)}
                {vocabNeedsAiEnrichEntry(selectedVocabItem) ? (
                  <Badge tone="muted">待 AI 补全</Badge>
                ) : null}
              </div>
              <CardDescription>
                {posLabelZh(selectedVocabItem.part_of_speech)}
                {shouldShowGrammaticalGenderSubtitle(
                  selectedVocabItem.part_of_speech,
                  selectedVocabItem.lemma,
                  selectedVocabItem.grammatical_gender,
                  selectedVocabItem.display_word,
                ) ? (
                  <span className="text-zinc-500">
                    {" "}
                    · 名词性：
                    {displayGrammaticalGenderLabelZh(
                      selectedVocabItem.lemma,
                      selectedVocabItem.grammatical_gender,
                    )}
                  </span>
                ) : null}
                {selectedVocabItem.level_estimate ? (
                  <span className="text-zinc-500">
                    {" "}
                    · 估计 {String(selectedVocabItem.level_estimate)}
                  </span>
                ) : null}
              </CardDescription>
              {selectedVocabOccurrence?.surface_form ? (
                <p className="mt-1 text-xs text-zinc-500">
                  原文形式：{selectedVocabOccurrence.surface_form}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-nowrap items-start gap-2 pt-0.5">
              <ReadingMasteryTitleActions
                status={selectedVocabItem.mastery_status}
                onStatusChange={(status) =>
                  setVocabMastery(selectedVocabItem.id, status)
                }
                onDelete={() => requestDeleteVocabItem(selectedVocabItem)}
                deleteDisabled={vocabDeletingId === selectedVocabItem.id}
              />
              <PronunciationButton text={selectedVocabItem.display_word} />
            </div>
          </div>
          {persistEnabled &&
          selectedVocabItem.dbItemId &&
          vocabNeedsAiEnrichEntry(selectedVocabItem) ? (
            <div className="mt-2 flex flex-col gap-2">
              {vocabEnrichLoadingId === selectedVocabItem.id ? (
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  AI 解释生成中...
                </p>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  className="self-start text-sm"
                  onClick={() =>
                    void handleEnrichVocabForItem(selectedVocabItem.id)
                  }
                >
                  补充 AI 解释
                </Button>
              )}
              {vocabEnrichError &&
              vocabEnrichErrorItemId === selectedVocabItem.id ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {vocabEnrichError}
                </p>
              ) : null}
            </div>
          ) : null}
          <p className="mt-2 text-xs text-zinc-500">
            {selectedVocabItem.occurrences.length} 次
            {selectedVocabItem.senses.length > 1
              ? ` · ${selectedVocabItem.senses.length} 个含义`
              : null}
          </p>
          <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              本文含义：
            </span>
            {selectedSense?.zh_meaning ?? selectedVocabItem.zh_meaning}
          </p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {selectedSense?.simple_de_explanation ??
              selectedVocabItem.simple_de_explanation}
          </p>
          {selectedVocabItem.reason_for_selection ? (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-medium text-zinc-600 dark:text-zinc-300">
                入选说明：
              </span>
              {selectedVocabItem.reason_for_selection}
            </p>
          ) : null}
          {selectedVocabItem.senses.length > 1 ? (
            <div className="mt-3 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                多个含义
              </p>
              <ul className="mt-1 list-inside list-disc text-xs text-zinc-600 dark:text-zinc-400">
                {selectedVocabItem.senses.map((s) => (
                  <li key={s.id}>{s.zh_meaning}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-3 rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-2.5 dark:border-zinc-700/80 dark:bg-zinc-900/35">
            <p className="mb-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              外部深入解释
            </p>
            <p className="mb-2 rounded-md border border-emerald-200/70 bg-emerald-50/80 px-2 py-1.5 text-xs font-medium text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
              提示：点击后会自动复制深度学习 Prompt，可在外部页面直接 Ctrl+V 粘贴发送。
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="secondary"
                className="px-2 py-1 text-xs font-normal"
                onClick={() =>
                  void runVocabExternalPrompt(VOCAB_EXTERNAL_DEEP_LINKS.chatgpt)
                }
              >
                ChatGPT
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="px-2 py-1 text-xs font-normal"
                onClick={() =>
                  void runVocabExternalPrompt(VOCAB_EXTERNAL_DEEP_LINKS.claude)
                }
              >
                Claude
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="px-2 py-1 text-xs font-normal"
                onClick={() =>
                  void runVocabExternalPrompt(VOCAB_EXTERNAL_DEEP_LINKS.gemini)
                }
              >
                Gemini
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="px-2 py-1 text-xs font-normal"
                onClick={() =>
                  void runVocabExternalPrompt(VOCAB_EXTERNAL_DEEP_LINKS.deepseek)
                }
              >
                DeepSeek
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="px-2 py-1 text-xs font-normal"
                onClick={() => void runVocabExternalPrompt(null)}
              >
                仅复制 Prompt
              </Button>
            </div>
            {vocabExternalPromptNotice ? (
              <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                {vocabExternalPromptNotice}
              </p>
            ) : null}
          </div>
          {persistEnabled && selectedVocabItem.dbItemId ? (
            <details className="group mt-3 rounded-lg border border-amber-200/80 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
              <summary className="cursor-pointer list-none px-2.5 py-2 text-xs font-medium text-amber-900 marker:hidden dark:text-amber-200 [&::-webkit-details-marker]:hidden">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    我的深度笔记
                    <span className="ml-2 font-normal text-amber-800/80 dark:text-amber-200/75">
                      {selectedVocabItem.user_deep_note ? "已有笔记" : "可展开添加"}
                    </span>
                  </span>
                  <span className="text-[11px] font-normal text-amber-800/80 group-open:rotate-180 dark:text-amber-200/80">
                    ▼
                  </span>
                </span>
              </summary>
              <div className="border-t border-amber-200/70 px-2.5 pb-2.5 pt-2 dark:border-amber-900/50">
                {selectedVocabItem.user_deep_note_updated_at ? (
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80">
                    更新于{" "}
                    {formatDeepNoteUpdatedAt(
                      selectedVocabItem.user_deep_note_updated_at,
                    )}
                  </p>
                ) : null}
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                可粘贴外部 AI 的回答或自己的补充笔记；这里只保存文本，不调用本应用 AI。
              </p>
              <textarea
                value={
                  vocabDeepNoteDrafts[selectedVocabItem.id] ??
                  normalizeDeepNoteMarkdown(selectedVocabItem.user_deep_note ?? "")
                }
                onChange={(e) =>
                  setVocabDeepNoteDrafts((prev) => ({
                    ...prev,
                    [selectedVocabItem.id]: e.target.value,
                  }))
                }
                rows={5}
                placeholder="只粘贴外部 AI 的解释回答，不要粘贴原 Prompt…"
                className="mt-2 w-full resize-y rounded-md border border-amber-200 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none ring-amber-500/20 focus:ring-2 dark:border-amber-900/60 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                  onClick={() =>
                    void pasteVocabDeepNoteFromClipboard(selectedVocabItem.id)
                  }
                  disabled={vocabDeepNoteSavingId === selectedVocabItem.id}
                >
                  从剪贴板读取
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                  onClick={() =>
                    void saveVocabDeepNote(
                      selectedVocabItem,
                      vocabDeepNoteDrafts[selectedVocabItem.id] ??
                        normalizeDeepNoteMarkdown(
                          selectedVocabItem.user_deep_note ?? "",
                        ),
                    )
                  }
                  disabled={vocabDeepNoteSavingId === selectedVocabItem.id}
                >
                  {vocabDeepNoteSavingId === selectedVocabItem.id
                    ? "保存中…"
                    : "保存笔记"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() => void saveVocabDeepNote(selectedVocabItem, "")}
                  disabled={vocabDeepNoteSavingId === selectedVocabItem.id}
                >
                  清空笔记
                </Button>
              </div>
              {vocabDeepNoteNotice ? (
                <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  {vocabDeepNoteNotice}
                </p>
              ) : null}
              {vocabDeepNoteError ? (
                <p className="mt-2 text-xs font-medium text-red-700 dark:text-red-300">
                  {vocabDeepNoteError}
                </p>
              ) : null}
              </div>
            </details>
          ) : null}
          <div className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="font-medium">本篇出现位置：</span>
            <div className="mt-2 space-y-2.5">
              {selectedVocabItem.occurrences.map((o, occIndex) => (
                <div
                  key={o.id}
                  data-occurrence-key={o.id}
                  data-active-occurrence={
                    o.id === selectedVocabOccurrence?.id ? "true" : undefined
                  }
                  className="flex items-start gap-2 text-sm leading-relaxed"
                >
                  <span
                    className="flex w-[2rem] shrink-0 justify-end pt-0.5 text-right tabular-nums text-zinc-500"
                    aria-hidden
                  >
                    {occIndex + 1}.
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setVocabSelection({
                        itemId: selectedVocabItem.id,
                        occurrenceId: o.id,
                      });
                      scrollArticleToOccurrence(o.id);
                    }}
                    className={`min-w-0 flex-1 rounded-md px-2 py-1.5 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-800/80 ${
                      o.id === selectedVocabOccurrence?.id
                        ? "bg-emerald-50/90 font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                        : "text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {o.sentence}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      {selectedVocabItem &&
      vocabUserStyle(selectedVocabItem) &&
      overlappingAiVocabForDetail.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            系统也曾将以下词标为课文词汇（信息保留）：
          </p>
          {overlappingAiVocabForDetail.map((id) => {
            const v = vocabById[id];
            if (!v) return null;
            return (
              <Card
                key={id}
                className="border-emerald-100 dark:border-emerald-900/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      {vocabularyHeadwordDe(
                        v.display_word,
                        v.lemma,
                        v.grammatical_gender,
                      )}
                    </CardTitle>
                    <CardDescription>
                      {posLabelZh(v.part_of_speech)}
                    </CardDescription>
                  </div>
                  <PronunciationButton text={v.display_word} size="sm" />
                </div>
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {(v.senses[0]?.zh_meaning ?? v.zh_meaning)}
                </p>
              </Card>
            );
          })}
        </div>
      ) : null}

      {selectedVocabItem &&
      !vocabUserStyle(selectedVocabItem) &&
      overlappingUserVocabForAiDetail.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            用户在同一位置补充的词条：
          </p>
          {overlappingUserVocabForAiDetail.map((id) => {
            const v = vocabById[id];
            if (!v) return null;
            return (
              <Card
                key={id}
                className="border-amber-200/80 dark:border-amber-900/50"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{v.display_word}</CardTitle>
                  {vocabBadge(v.source)}
                </div>
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {v.zh_meaning}
                </p>
              </Card>
            );
          })}
        </div>
      ) : null}

      {!selectedVocabItem ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          点击文中的高亮词或左侧列表，可在此查看词汇解释。
        </p>
      ) : null}
    </div>
  );

  const grammarDetailOnly = (
    <div className="space-y-4">
      {selectedGrammarItem ? (
        <Card
          className={
            grammarUserStyle(selectedGrammarItem)
              ? "border-violet-200/80 dark:border-violet-900/50"
              : "border-sky-200/80 dark:border-sky-900/50"
          }
          onMouseEnter={() =>
            setHoveredListItemId({
              kind: "grammar",
              id: selectedGrammarItem.id,
            })
          }
          onMouseLeave={() => setHoveredListItemId(null)}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="min-w-0 break-words">
                  {selectedGrammarItem.name_zh}
                </CardTitle>
                {grammarBadge(selectedGrammarItem.source)}
                {grammarNeedsAiEnrichEntry(selectedGrammarItem) ? (
                  <Badge tone="muted">待 AI 补全</Badge>
                ) : null}
              </div>
              <CardDescription>
                {selectedGrammarItem.name_de}
                {selectedGrammarItem.level_estimate ? (
                  <span className="text-zinc-500">
                    {" "}
                    · 估计 {String(selectedGrammarItem.level_estimate)}
                  </span>
                ) : null}
              </CardDescription>
            </div>
            <ReadingMasteryTitleActions
              status={selectedGrammarItem.mastery_status}
              onStatusChange={(status) =>
                setGrammarMastery(selectedGrammarItem.id, status)
              }
              onDelete={() => requestDeleteGrammarItem(selectedGrammarItem)}
              deleteDisabled={grammarDeletingId === selectedGrammarItem.id}
              className="pt-0.5"
            />
          </div>
          {persistEnabled &&
          selectedGrammarItem.dbItemId &&
          grammarNeedsAiEnrichEntry(selectedGrammarItem) ? (
            <div className="mt-2 flex flex-col gap-2">
              {grammarEnrichLoadingId === selectedGrammarItem.id ? (
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  AI 解释生成中...
                </p>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  className="self-start text-sm"
                  onClick={() =>
                    void handleEnrichGrammarForItem(selectedGrammarItem.id)
                  }
                >
                  补充 AI 解释
                </Button>
              )}
              {grammarEnrichError &&
              grammarEnrichErrorItemId === selectedGrammarItem.id ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {grammarEnrichError}
                </p>
              ) : null}
            </div>
          ) : null}
          <p className="mt-2 text-xs text-zinc-500">
            {selectedGrammarItem.occurrences.length} 次
          </p>
          <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
            {selectedGrammarItem.explanation_zh}
          </p>
          {selectedGrammarItem.explanation_de_simple ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {selectedGrammarItem.explanation_de_simple}
            </p>
          ) : null}
          {selectedGrammarItem.reason_for_selection ? (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-medium text-zinc-600 dark:text-zinc-300">
                入选说明：
              </span>
              {selectedGrammarItem.reason_for_selection}
            </p>
          ) : null}
          <div className="mt-3 rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-2.5 dark:border-zinc-700/80 dark:bg-zinc-900/35">
            <p className="mb-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              外部深入解释
            </p>
            <p className="mb-2 rounded-md border border-emerald-200/70 bg-emerald-50/80 px-2 py-1.5 text-xs font-medium text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
              提示：点击后会自动复制深度学习 Prompt，可在外部页面直接 Ctrl+V 粘贴发送。
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="secondary"
                className="px-2 py-1 text-xs font-normal"
                onClick={() =>
                  void runGrammarExternalPrompt(GRAMMAR_EXTERNAL_DEEP_LINKS.chatgpt)
                }
              >
                ChatGPT
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="px-2 py-1 text-xs font-normal"
                onClick={() =>
                  void runGrammarExternalPrompt(GRAMMAR_EXTERNAL_DEEP_LINKS.claude)
                }
              >
                Claude
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="px-2 py-1 text-xs font-normal"
                onClick={() =>
                  void runGrammarExternalPrompt(GRAMMAR_EXTERNAL_DEEP_LINKS.gemini)
                }
              >
                Gemini
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="px-2 py-1 text-xs font-normal"
                onClick={() =>
                  void runGrammarExternalPrompt(
                    GRAMMAR_EXTERNAL_DEEP_LINKS.deepseek,
                  )
                }
              >
                DeepSeek
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="px-2 py-1 text-xs font-normal"
                onClick={() => void runGrammarExternalPrompt(null)}
              >
                仅复制 Prompt
              </Button>
            </div>
            {grammarExternalPromptNotice ? (
              <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                {grammarExternalPromptNotice}
              </p>
            ) : null}
          </div>
          {persistEnabled && selectedGrammarItem.dbItemId ? (
            <details className="group mt-3 rounded-lg border border-amber-200/80 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
              <summary className="cursor-pointer list-none px-2.5 py-2 text-xs font-medium text-amber-900 marker:hidden dark:text-amber-200 [&::-webkit-details-marker]:hidden">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    我的深度笔记
                    <span className="ml-2 font-normal text-amber-800/80 dark:text-amber-200/75">
                      {selectedGrammarItem.user_deep_note ? "已有笔记" : "可展开添加"}
                    </span>
                  </span>
                  <span className="text-[11px] font-normal text-amber-800/80 group-open:rotate-180 dark:text-amber-200/80">
                    ▼
                  </span>
                </span>
              </summary>
              <div className="border-t border-amber-200/70 px-2.5 pb-2.5 pt-2 dark:border-amber-900/50">
                {selectedGrammarItem.user_deep_note_updated_at ? (
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80">
                    更新于{" "}
                    {formatDeepNoteUpdatedAt(
                      selectedGrammarItem.user_deep_note_updated_at,
                    )}
                  </p>
                ) : null}
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                可粘贴外部 AI 的回答或自己的补充笔记；这里只保存文本，不调用本应用 AI。
              </p>
              <textarea
                value={
                  grammarDeepNoteDrafts[selectedGrammarItem.id] ??
                  normalizeDeepNoteMarkdown(
                    selectedGrammarItem.user_deep_note ?? "",
                  )
                }
                onChange={(e) =>
                  setGrammarDeepNoteDrafts((prev) => ({
                    ...prev,
                    [selectedGrammarItem.id]: e.target.value,
                  }))
                }
                rows={5}
                placeholder="只粘贴外部 AI 的解释回答，不要粘贴原 Prompt…"
                className="mt-2 w-full resize-y rounded-md border border-amber-200 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none ring-amber-500/20 focus:ring-2 dark:border-amber-900/60 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                  onClick={() =>
                    void pasteGrammarDeepNoteFromClipboard(selectedGrammarItem.id)
                  }
                  disabled={grammarDeepNoteSavingId === selectedGrammarItem.id}
                >
                  从剪贴板读取
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                  onClick={() =>
                    void saveGrammarDeepNote(
                      selectedGrammarItem,
                      grammarDeepNoteDrafts[selectedGrammarItem.id] ??
                        normalizeDeepNoteMarkdown(
                          selectedGrammarItem.user_deep_note ?? "",
                        ),
                    )
                  }
                  disabled={grammarDeepNoteSavingId === selectedGrammarItem.id}
                >
                  {grammarDeepNoteSavingId === selectedGrammarItem.id
                    ? "保存中…"
                    : "保存笔记"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() =>
                    void saveGrammarDeepNote(selectedGrammarItem, "")
                  }
                  disabled={grammarDeepNoteSavingId === selectedGrammarItem.id}
                >
                  清空笔记
                </Button>
              </div>
              {grammarDeepNoteNotice ? (
                <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  {grammarDeepNoteNotice}
                </p>
              ) : null}
              {grammarDeepNoteError ? (
                <p className="mt-2 text-xs font-medium text-red-700 dark:text-red-300">
                  {grammarDeepNoteError}
                </p>
              ) : null}
              </div>
            </details>
          ) : null}
          <div className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="font-medium">本篇出现位置：</span>
            <div className="mt-2 space-y-2.5">
              {selectedGrammarItem.occurrences.map((o, occIndex) => {
                const selectedOcc = grammarSelection?.occurrenceId;
                return (
                  <div
                    key={o.id}
                    data-occurrence-key={o.id}
                    data-active-occurrence={
                      o.id === selectedOcc ? "true" : undefined
                    }
                    className="flex items-start gap-2 text-sm leading-relaxed"
                  >
                    <span
                      className="flex w-[2rem] shrink-0 justify-end pt-0.5 text-right tabular-nums text-zinc-500"
                      aria-hidden
                    >
                      {occIndex + 1}.
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setGrammarSelection({
                          itemId: selectedGrammarItem.id,
                          occurrenceId: o.id,
                        });
                        scrollArticleToOccurrence(
                          o.id,
                          o.start_offset !== undefined &&
                            o.end_offset !== undefined
                            ? {
                                start: o.start_offset,
                                end: o.end_offset,
                              }
                            : undefined,
                        );
                      }}
                      className={`min-w-0 flex-1 rounded-md px-2 py-1.5 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-800/80 ${
                        o.id === selectedOcc
                          ? "bg-violet-50/90 font-semibold text-violet-800 dark:bg-violet-950/45 dark:text-violet-200"
                          : "text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {o.sentence}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
            <span>键：{selectedGrammarItem.grammar_key}</span>
          </div>
        </Card>
      ) : null}

      {!selectedGrammarItem ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          点击文中的语法高亮或左侧列表，可在此查看语法说明。
        </p>
      ) : null}
    </div>
  );

  const renderVocabListItem = (v: ArticleVocabItem) => {
    const vocabFlash = flashPulse?.kind === "vocab" && flashPulse.id === v.id;
    return (
      <li
        key={v.id}
        data-learning-item-id={v.id}
        data-vocab-item-id={v.id}
        ref={(el) => {
          if (el) {
            vocabItemRefs.current.set(v.id, el);
          } else {
            vocabItemRefs.current.delete(v.id);
          }
        }}
      >
        <div
          className={`overflow-hidden rounded-lg border text-sm transition ${
            vocabSelection?.itemId === v.id
              ? vocabUserStyle(v)
                ? "border-amber-500 bg-amber-50/60 shadow-sm dark:border-amber-700 dark:bg-amber-950/40"
                : "border-emerald-500 bg-emerald-50/60 shadow-sm dark:border-emerald-700 dark:bg-emerald-950/40"
              : "border-zinc-200 dark:border-zinc-800"
          }${
            vocabFlash
              ? " ring-2 ring-emerald-500/80 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950"
              : ""
          }`}
          onMouseEnter={() =>
            setHoveredListItemId({ kind: "vocab", id: v.id })
          }
          onMouseLeave={() => setHoveredListItemId(null)}
        >
          <div className="flex items-start">
            <button
              type="button"
              onClick={() => {
                const firstOcc = v.occurrences[0];
                selectVocabItem(v.id, firstOcc ? firstOcc.id : undefined);
                triggerTouchPeek("vocab", v.id);
                if (firstOcc) {
                  queueMicrotask(() => {
                    scrollArticleToOccurrence(firstOcc.id);
                  });
                }
              }}
              className="min-w-0 flex-1 flex flex-col gap-0.5 px-3 py-2 text-left hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50"
            >
              <span className="flex flex-wrap items-center gap-2 font-medium text-zinc-900 dark:text-zinc-50">
                <span className="min-w-0 max-w-full break-words">
                  {vocabularyHeadwordDe(
                    v.display_word,
                    v.lemma,
                    v.grammatical_gender,
                  )}
                </span>
                {vocabBadge(v.source)}
                <span className="text-xs font-normal text-zinc-500">
                  {v.occurrences.length} 次
                </span>
              {v.level_estimate ? (
                <span className="text-xs font-normal text-zinc-500">
                  {String(v.level_estimate)}
                </span>
              ) : null}
              {v.senses.length > 1 ? (
                <span className="text-xs font-normal text-zinc-500">
                  {v.senses.length} 个含义
                </span>
              ) : null}
            </span>
            <span className="text-xs text-zinc-500">
              {v.senses[0]?.zh_meaning ?? v.zh_meaning}
            </span>
            {shouldShowGrammaticalGenderSubtitle(
              v.part_of_speech,
              v.lemma,
              v.grammatical_gender,
              v.display_word,
            ) ? (
              <span className="text-xs text-zinc-500">
                名词性：
                {displayGrammaticalGenderLabelZh(v.lemma, v.grammatical_gender)}
              </span>
            ) : null}
            {v.occurrences[0]?.surface_form ? (
                <span className="text-xs text-zinc-500">
                  原文形式：{v.occurrences[0].surface_form}
                </span>
              ) : null}
          </button>
            <div className="flex shrink-0 flex-nowrap items-start py-2 pr-2 pl-1">
              <ReadingMasteryTitleActions
                status={v.mastery_status}
                onStatusChange={(status) => setVocabMastery(v.id, status)}
                onDelete={() => requestDeleteVocabItem(v)}
                deleteDisabled={vocabDeletingId === v.id}
              />
            </div>
          </div>
          {persistEnabled && v.dbItemId && vocabNeedsAiEnrichEntry(v) ? (
            <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
              {vocabEnrichLoadingId === v.id ? (
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  AI 解释生成中...
                </p>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  className="text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleEnrichVocabForItem(v.id);
                  }}
                >
                  补充 AI 解释
                </Button>
              )}
              {vocabEnrichError && vocabEnrichErrorItemId === v.id ? (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {vocabEnrichError}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        {vocabSelection?.itemId === v.id ? (
          <div className="mt-3 hidden border-t border-zinc-200 pt-3 dark:border-zinc-700 md:block">
            {vocabDetailOnly}
          </div>
        ) : null}
      </li>
    );
  };

  const renderGrammarListItem = (g: ArticleGrammarItem) => {
    const surface = g.occurrences[0]?.surface_form ?? g.name_de;
    const grammarFlash = flashPulse?.kind === "grammar" && flashPulse.id === g.id;
    return (
      <li
        key={g.id}
        data-learning-item-id={g.id}
        data-grammar-item-id={g.id}
        ref={(el) => {
          if (el) {
            grammarItemRefs.current.set(g.id, el);
          } else {
            grammarItemRefs.current.delete(g.id);
          }
        }}
      >
        <div
          className={`overflow-hidden rounded-lg border text-sm transition ${
            grammarSelection?.itemId === g.id
              ? grammarUserStyle(g)
                ? "border-violet-500 bg-violet-50/60 shadow-sm dark:border-violet-700 dark:bg-violet-950/40"
                : "border-sky-500 bg-sky-50/60 shadow-sm dark:border-sky-700 dark:bg-sky-950/40"
              : "border-zinc-200 dark:border-zinc-800"
          }${
            grammarFlash
              ? " ring-2 ring-violet-500/80 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950"
              : ""
          }`}
          onMouseEnter={() =>
            setHoveredListItemId({ kind: "grammar", id: g.id })
          }
          onMouseLeave={() => setHoveredListItemId(null)}
        >
          <div className="flex items-start">
            <button
              type="button"
              onClick={() => {
                const firstOcc = g.occurrences[0];
                selectGrammarItem(g.id, firstOcc ? firstOcc.id : undefined);
                triggerTouchPeek("grammar", g.id);
                if (firstOcc) {
                  queueMicrotask(() => {
                    scrollArticleToOccurrence(
                      firstOcc.id,
                      firstOcc.start_offset !== undefined &&
                        firstOcc.end_offset !== undefined
                        ? {
                            start: firstOcc.start_offset,
                            end: firstOcc.end_offset,
                          }
                        : undefined,
                    );
                  });
                }
              }}
              className="min-w-0 flex-1 flex flex-col gap-0.5 px-3 py-2 text-left hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50"
            >
              <span className="flex flex-wrap items-center gap-2 font-medium text-zinc-900 dark:text-zinc-50">
                <span className="min-w-0 max-w-full break-words">{surface}</span>
                {grammarBadge(g.source)}
                <span className="text-xs font-normal text-zinc-500">
                  {g.occurrences.length} 次
                </span>
              {g.level_estimate ? (
                <span className="text-xs font-normal text-zinc-500">
                  {String(g.level_estimate)}
                </span>
              ) : null}
            </span>
            <span className="text-xs text-zinc-500">{g.name_zh}</span>
          </button>
            <div className="flex shrink-0 flex-nowrap items-start py-2 pr-2 pl-1">
              <ReadingMasteryTitleActions
                status={g.mastery_status}
                onStatusChange={(status) => setGrammarMastery(g.id, status)}
                onDelete={() => requestDeleteGrammarItem(g)}
                deleteDisabled={grammarDeletingId === g.id}
              />
            </div>
          </div>
          {persistEnabled && g.dbItemId && grammarNeedsAiEnrichEntry(g) ? (
            <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
              {grammarEnrichLoadingId === g.id ? (
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  AI 解释生成中...
                </p>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  className="text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleEnrichGrammarForItem(g.id);
                  }}
                >
                  补充 AI 解释
                </Button>
              )}
              {grammarEnrichError && grammarEnrichErrorItemId === g.id ? (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {grammarEnrichError}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        {grammarSelection?.itemId === g.id ? (
          <div className="mt-3 hidden border-t border-zinc-200 pt-3 dark:border-zinc-700 md:block">
            {grammarDetailOnly}
          </div>
        ) : null}
      </li>
    );
  };

  const vocabList = (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          className="text-sm"
          onClick={() => {
            setVocabFormOpen(true);
            setVocabFormValue("");
          }}
        >
          手动添加单词
        </Button>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          本篇词汇
        </p>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-2.5 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300">
          <p className="font-medium text-zinc-800 dark:text-zinc-200">
            本篇词汇统计
          </p>
          <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
            <p>
              生词数（去重，含暂忽略）：{vocabLearningWordStats.unknownWordCount}
            </p>
            <p>
              全文总词数（不去重）：{vocabLearningWordStats.totalWordCount}
            </p>
            <p className="sm:col-span-2">
              生词占比：
              {vocabLearningWordStats.unknownWordCount}/
              {vocabLearningWordStats.totalWordCount}
              {" ("}
              {(vocabLearningWordStats.unknownRatio * 100).toFixed(1)}%
              {")"}
            </p>
          </div>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          学习中：保留并可继续推荐；已掌握：保留但以后少推荐；暂忽略：暂时不学；删除：从本文移除。
        </p>
        <ul className="space-y-2">{vocabLearningItems.map(renderVocabListItem)}</ul>
        {vocabMasteredItems.length > 0 ? (
          <div className="pt-1">
            <button
              type="button"
              className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-300"
              onClick={() => setShowMasteredVocab((x) => !x)}
            >
              {showMasteredVocab
                ? `收起已掌握词汇（${vocabMasteredItems.length}）`
                : `已掌握词汇（${vocabMasteredItems.length}）`}
            </button>
            {showMasteredVocab ? (
              <ul className="mt-2 space-y-2">
                {vocabMasteredItems.map(renderVocabListItem)}
              </ul>
            ) : null}
          </div>
        ) : null}
        {vocabIgnoredItems.length > 0 ? (
          <div className="pt-1">
            <button
              type="button"
              className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-300"
              onClick={() => setShowIgnoredVocab((x) => !x)}
            >
              {showIgnoredVocab
                ? `收起暂忽略词汇（${vocabIgnoredItems.length}）`
                : `暂忽略词汇（${vocabIgnoredItems.length}）`}
            </button>
            {showIgnoredVocab ? (
              <ul className="mt-2 space-y-2">
                {vocabIgnoredItems.map(renderVocabListItem)}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  const grammarList = (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          className="text-sm"
          onClick={() => {
            setGrammarFormOpen(true);
            setGrammarFormValue("");
          }}
        >
          手动添加语法问题
        </Button>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          本篇语法
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          学习中：保留并可继续推荐；已掌握：保留但以后少推荐；暂忽略：暂时不学；删除：从本文移除。
        </p>
        <ul className="space-y-2">{grammarLearningItems.map(renderGrammarListItem)}</ul>
        {grammarMasteredItems.length > 0 ? (
          <div className="pt-1">
            <button
              type="button"
              className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-300"
              onClick={() => setShowMasteredGrammar((x) => !x)}
            >
              {showMasteredGrammar
                ? `收起已掌握语法（${grammarMasteredItems.length}）`
                : `已掌握语法（${grammarMasteredItems.length}）`}
            </button>
            {showMasteredGrammar ? (
              <ul className="mt-2 space-y-2">
                {grammarMasteredItems.map(renderGrammarListItem)}
              </ul>
            ) : null}
          </div>
        ) : null}
        {grammarIgnoredItems.length > 0 ? (
          <div className="pt-1">
            <button
              type="button"
              className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-300"
              onClick={() => setShowIgnoredGrammar((x) => !x)}
            >
              {showIgnoredGrammar
                ? `收起暂忽略语法（${grammarIgnoredItems.length}）`
                : `暂忽略语法（${grammarIgnoredItems.length}）`}
            </button>
            {showIgnoredGrammar ? (
              <ul className="mt-2 space-y-2">
                {grammarIgnoredItems.map(renderGrammarListItem)}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  const tabItems = [
    { id: "vocab", label: "词汇", content: vocabList },
    { id: "grammar", label: "语法", content: grammarList },
    { id: "summary", label: "摘要", content: summaryPanel },
    { id: "questions", label: "阅读问题", content: questionsPanel },
  ];

  /** 与右侧 occurrence 列表顺序对齐（0-based） */
  function occurrenceRowIndex(meta: RunMeta): number | undefined {
    const kind = runMetaListKind(meta);
    const item =
      kind === "vocab" ? vocabById[meta.itemId] : grammarById[meta.itemId];
    if (!item) return undefined;
    const idx = item.occurrences.findIndex((o) => o.id === meta.occurrenceId);
    return idx >= 0 ? idx : undefined;
  }

  function runHighlightExtraClass(meta: RunMeta): string {
    const listKind = runMetaListKind(meta);
    const peek = listHighlightTarget;
    const itemMatch = Boolean(
      peek && peek.kind === listKind && peek.id === meta.itemId,
    );
    const flash = flashOccurrenceId === meta.occurrenceId;
    if (flash) {
      // 点击右侧 occurrence 后左侧定位：高对比描边 + 外发光（不用 animate-pulse，避免低谷时几乎看不见）
      return "relative z-[1] rounded-sm ring-2 ring-amber-500 ring-offset-2 ring-offset-white shadow-[0_0_12px_rgba(245,158,11,0.65)] dark:ring-amber-300 dark:ring-offset-zinc-950 dark:shadow-[0_0_16px_rgba(253,224,71,0.55)]";
    }
    if (itemMatch) {
      return "ring-2 ring-zinc-900/35 ring-offset-0 dark:ring-zinc-100/30";
    }
    return "";
  }

  function isMasteredVocabRun(meta: RunMeta): boolean {
    return (
      (meta.kind === "ai_vocab" || meta.kind === "user_vocab") &&
      vocabById[meta.itemId]?.mastery_status === "mastered"
    );
  }

  function vocabRunClassName(
    meta: RunMeta,
    highlightedClassName: string,
  ): string {
    if (!isMasteredVocabRun(meta)) {
      return highlightedClassName;
    }
    return `mx-0 rounded-sm bg-transparent p-0 text-inherit no-underline shadow-none transition hover:bg-transparent dark:hover:bg-transparent ${runHighlightExtraClass(meta)}`;
  }

  function handleHighlightPointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    activate: () => void,
  ) {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;

    event.preventDefault();
    event.stopPropagation();
    selectionTextSnapshotRef.current = null;
    setTextSelectionUi(null);
    clearNativeSelection();
    activate();
  }

  function handleHighlightClick(
    event: ReactMouseEvent<HTMLButtonElement>,
    activate: () => void,
  ) {
    event.stopPropagation();
    activate();
  }

  /** 有非空选区时不打开语法（避免拖选单词后误触打开语法抽屉） */
  function handleGrammarHighlightClick(
    event: ReactMouseEvent<HTMLElement>,
    activate: () => void,
  ) {
    event.stopPropagation();
    const sel = window.getSelection()?.toString().trim() ?? "";
    if (sel.length > 0) return;
    activate();
  }

  function renderRunContent(
    run: { start: number; end: number; meta: RunMeta | null },
    runIndex: number,
  ) {
    const text = articlePlain.slice(run.start, run.end);
    if (!run.meta) {
      return <span key={`plain-${runIndex}`}>{text}</span>;
    }

    const { meta } = run;
    const onVocab = () =>
      selectVocabItem(meta.itemId, meta.occurrenceId);
    const onGrammar = () =>
      selectGrammarItem(meta.itemId, meta.occurrenceId);

    if (meta.kind === "ai_vocab") {
      return (
        <span
          key={`${meta.kind}-${meta.itemId}-${meta.occurrenceId}-${runIndex}`}
          className="group relative inline-block align-baseline"
        >
          <button
            type="button"
            onPointerDown={(event) =>
              handleHighlightPointerDown(event, onVocab)
            }
            onClick={(event) => handleHighlightClick(event, onVocab)}
            style={HIGHLIGHT_TOUCH_GUARD_STYLE}
            data-marker-id={meta.itemId}
            data-occurrence-id={meta.occurrenceId}
            data-occurrence-index={occurrenceRowIndex(meta)}
            data-range-id={`${run.start}-${run.end}`}
            className={vocabRunClassName(
              meta,
              `mx-0.5 rounded bg-emerald-100 px-0.5 font-medium text-emerald-900 underline decoration-emerald-400/60 decoration-2 underline-offset-2 transition hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-100 dark:hover:bg-emerald-800/60 ${runHighlightExtraClass(meta)}`,
            )}
          >
            {text}
          </button>
          {!isMasteredVocabRun(meta) ? (
            <span
              className="invisible absolute left-1/2 top-full z-20 w-max -translate-x-1/2 pt-1 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 max-md:hidden"
              role="tooltip"
            >
              <span className="block h-2 w-full" aria-hidden />
              <span className="block rounded-lg border border-zinc-200 bg-white p-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                <PronunciationButton text={text} size="sm" />
              </span>
            </span>
          ) : null}
        </span>
      );
    }

    if (meta.kind === "user_vocab") {
      return (
        <span
          key={`${meta.kind}-${meta.itemId}-${meta.occurrenceId}-${runIndex}`}
          className="group relative inline-block align-baseline"
        >
          <button
            type="button"
            onPointerDown={(event) =>
              handleHighlightPointerDown(event, onVocab)
            }
            onClick={(event) => handleHighlightClick(event, onVocab)}
            style={HIGHLIGHT_TOUCH_GUARD_STYLE}
            data-marker-id={meta.itemId}
            data-occurrence-id={meta.occurrenceId}
            data-occurrence-index={occurrenceRowIndex(meta)}
            data-range-id={`${run.start}-${run.end}`}
            className={vocabRunClassName(
              meta,
              `mx-0.5 rounded bg-amber-200 px-0.5 font-medium text-amber-950 underline decoration-amber-500/70 decoration-2 underline-offset-2 transition hover:bg-amber-300 dark:bg-amber-900/55 dark:text-amber-100 dark:hover:bg-amber-800/60 ${runHighlightExtraClass(meta)}`,
            )}
          >
            {text}
          </button>
          {!isMasteredVocabRun(meta) ? (
            <span
              className="invisible absolute left-1/2 top-full z-20 w-max -translate-x-1/2 pt-1 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 max-md:hidden"
              role="tooltip"
            >
              <span className="block h-2 w-full" aria-hidden />
              <span className="block rounded-lg border border-amber-200 bg-white p-2 text-xs shadow-lg dark:border-amber-900/50 dark:bg-zinc-900">
                <span className="mb-1 block font-medium text-amber-800 dark:text-amber-200">
                  用户
                </span>
                <PronunciationButton text={text} size="sm" />
              </span>
            </span>
          ) : null}
        </span>
      );
    }

    if (meta.kind === "ai_grammar") {
      return (
        <span
          key={`${meta.kind}-${meta.itemId}-${meta.occurrenceId}-${runIndex}`}
          className="group relative inline-block align-baseline"
        >
          <span
            role="button"
            tabIndex={0}
            onKeyDown={(event: ReactKeyboardEvent<HTMLElement>) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.stopPropagation();
              onGrammar();
            }}
            onClick={(event) => handleGrammarHighlightClick(event, onGrammar)}
            style={GRAMMAR_ARTICLE_HIGHLIGHT_STYLE}
            data-marker-id={meta.itemId}
            data-occurrence-id={meta.occurrenceId}
            data-occurrence-index={occurrenceRowIndex(meta)}
            data-range-id={`${run.start}-${run.end}`}
            className={`mx-0.5 cursor-pointer whitespace-pre-line rounded bg-sky-100 px-0.5 font-medium text-sky-900 underline decoration-sky-400/60 decoration-2 underline-offset-2 transition hover:bg-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 dark:bg-sky-900/45 dark:text-sky-100 dark:hover:bg-sky-800/50 dark:focus-visible:ring-sky-400 dark:focus-visible:ring-offset-zinc-950 ${runHighlightExtraClass(meta)}`}
          >
            {text}
          </span>
          <span
            className="invisible absolute left-1/2 top-full z-20 w-max max-w-xs -translate-x-1/2 pt-1 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 max-md:hidden"
            role="tooltip"
          >
            <span className="block h-2 w-full" aria-hidden />
            <span className="block rounded-lg border border-zinc-200 bg-white p-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <span className="mb-1 block text-zinc-500">系统语法</span>
              <p className="text-zinc-700 dark:text-zinc-300">
                {grammarById[meta.itemId]?.name_zh ?? ""}
              </p>
            </span>
          </span>
        </span>
      );
    }

    return (
      <span
        key={`${meta.kind}-${meta.itemId}-${meta.occurrenceId}-${runIndex}`}
        className="group relative inline-block align-baseline"
      >
        <span
          role="button"
          tabIndex={0}
          onKeyDown={(event: ReactKeyboardEvent<HTMLElement>) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            event.stopPropagation();
            onGrammar();
          }}
          onClick={(event) => handleGrammarHighlightClick(event, onGrammar)}
          style={GRAMMAR_ARTICLE_HIGHLIGHT_STYLE}
          data-marker-id={meta.itemId}
          data-occurrence-id={meta.occurrenceId}
          data-occurrence-index={occurrenceRowIndex(meta)}
          data-range-id={`${run.start}-${run.end}`}
          className={`mx-0.5 cursor-pointer whitespace-pre-line rounded bg-violet-200 px-0.5 font-medium text-violet-950 underline decoration-violet-500/70 decoration-2 underline-offset-2 transition hover:bg-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 dark:bg-violet-900/50 dark:text-violet-100 dark:hover:bg-violet-800/55 dark:focus-visible:ring-violet-400 dark:focus-visible:ring-offset-zinc-950 ${runHighlightExtraClass(meta)}`}
        >
          {text}
        </span>
        <span
          className="invisible absolute left-1/2 top-full z-20 w-max max-w-xs -translate-x-1/2 pt-1 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 max-md:hidden"
          role="tooltip"
        >
          <span className="block h-2 w-full" aria-hidden />
          <span className="block rounded-lg border border-violet-200 bg-white p-2 text-xs shadow-lg dark:border-violet-900/50 dark:bg-zinc-900">
            <span className="mb-1 block font-medium text-violet-800 dark:text-violet-200">
              用户语法
            </span>
            <p className="text-zinc-700 dark:text-zinc-300">
              {grammarById[meta.itemId]?.name_zh ?? ""}
            </p>
          </span>
        </span>
      </span>
    );
  }

  const articleBody = (
    <div className="whitespace-pre-line leading-8 text-zinc-900 dark:text-zinc-100 [&_button]:whitespace-pre-line">
      {runs.map((run, runIndex) => renderRunContent(run, runIndex))}
    </div>
  );

  return (
    <>
      {analysisToolbar ? (
        <div className="mb-4 space-y-2">{analysisToolbar}</div>
      ) : null}
      <div className="grid flex-1 gap-4 md:grid-cols-2 md:items-start">
        <Card
          ref={articleScrollRef}
          className="flex max-h-[calc(100vh-100px)] min-h-[280px] flex-col overflow-y-auto md:min-h-[360px]"
        >
          <CardTitle className="text-base">{metaTitle}</CardTitle>
          <div className="mt-1 space-y-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            <p>
              可选中单词、短语或句子，使用浮层加入词库、标记语法或发音（不悬停自动播放）。
            </p>
            <p className="md:hidden">
              语法高亮（蓝 / 紫）内也可拖选其中单词加入词库；无选区时轻点该片段仍会打开语法说明。
            </p>
            <p className="md:hidden text-zinc-500">
              底部「详情」打开时仍可滑动、点选课文中内容；高亮会尽量上移到抽屉上方。收起请点抽屉内「关闭」。
            </p>
            <p className="font-medium text-zinc-700 dark:text-zinc-300">高亮含义</p>
            {legendMode === "full" ? (
              <ul className="list-inside list-disc space-y-0.5 pl-0.5">
                <li>
                  <span className="font-medium text-emerald-800 dark:text-emerald-200">
                    绿色
                  </span>
                  ：系统自动标出的<strong>课文词汇</strong>
                </li>
                <li>
                  <span className="font-medium text-amber-800 dark:text-amber-200">
                    琥珀色
                  </span>
                  ：<strong>用户添加</strong>或<strong>用户确认</strong>的词汇
                </li>
                <li>
                  <span className="font-medium text-sky-800 dark:text-sky-200">
                    蓝色
                  </span>
                  ：系统自动标出的<strong>课文语法</strong>
                </li>
                <li>
                  <span className="font-medium text-violet-800 dark:text-violet-200">
                    紫色
                  </span>
                  ：<strong>用户标记</strong>的语法片段
                </li>
              </ul>
            ) : (
              <ul className="list-inside list-disc space-y-0.5 pl-0.5">
                <li>
                  <span className="font-medium text-amber-800 dark:text-amber-200">
                    琥珀色
                  </span>
                  ：您添加的<strong>词汇</strong>
                </li>
                <li>
                  <span className="font-medium text-violet-800 dark:text-violet-200">
                    紫色
                  </span>
                  ：您标记的<strong>语法</strong>片段
                </li>
              </ul>
            )}
            <p className="text-zinc-500">
              同一词在列表中只出现一次；文中多次出现时会尽量全部高亮。
            </p>
          </div>
          <article
            ref={articleRef}
            className="mt-4 cursor-text select-text text-[17px]"
            onMouseUp={handleArticlePointerUp}
            onTouchEnd={handleArticlePointerUp}
          >
            {articleBody}
          </article>
        </Card>

        <div className="flex min-h-0 flex-col md:sticky md:top-20 md:z-10 md:h-[calc(100vh-100px)] md:max-h-[calc(100vh-100px)] md:w-full md:self-start">
          <Card className="flex h-full min-h-[280px] flex-col overflow-hidden md:min-h-0">
            <div className="flex min-h-0 flex-1 flex-col">
              <Tabs
                items={tabItems}
                activeId={tab}
                onChange={(id) => setTab(id as typeof tab)}
                panelScrollRef={sidePanelScrollRef}
              />
            </div>
          </Card>
        </div>
      </div>

      {textSelectionUi ? (
        <div
          ref={selectionPopoverRef}
          role="toolbar"
          aria-label="选中文本操作"
          className="fixed z-[55] flex -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          style={{
            left: textSelectionUi.left,
            top: textSelectionUi.top,
            maxWidth: "min(100vw - 1rem, 280px)",
          }}
        >
          <Button
            type="button"
            variant="secondary"
            className="px-2 py-1 text-xs"
            onClick={() => {
              const phrase = (
                textSelectionUi.text ||
                selectionTextSnapshotRef.current ||
                ""
              ).trim();
              if (!phrase) return;
              addVocabFromText(phrase, cloneDomRangeInArticle());
            }}
          >
            {addVocabLabel}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="px-2 py-1 text-xs"
            onClick={() => {
              const phrase = (
                textSelectionUi.text ||
                selectionTextSnapshotRef.current ||
                ""
              ).trim();
              if (!phrase) return;
              addGrammarFromText(phrase, cloneDomRangeInArticle());
            }}
          >
            {addGrammarLabel}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="px-2 py-1 text-xs"
            onClick={onPopoverSpeak}
          >
            发音
          </Button>
        </div>
      ) : null}

      {vocabFormOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => setVocabFormOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vocab-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="vocab-form-title"
              className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
            >
              手动添加单词
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              将按 normalized key 去重；若文中可匹配则记入 occurrence 并高亮。
            </p>
            <input
              value={vocabFormValue}
              onChange={(e) => setVocabFormValue(e.target.value)}
              className="mt-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="z. B. angekündigt"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setVocabFormOpen(false)}
              >
                取消
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  const t = vocabFormValue.trim();
                  if (!t) return;
                  const { nextItems, itemId, occurrenceId } =
                    mergeVocabFromFormText(vocabularyItems, articlePlain, t);
                  const preItem = nextItems.find((v) => v.id === itemId);
                  const preOcc = preItem?.occurrences.find(
                    (o) => o.id === occurrenceId,
                  );
                  let merged = finalizeArticleVocabularyItems(
                    nextItems,
                    articlePlain,
                  );
                  let selectItemId = itemId;
                  let selectOccId = alignVocabOccurrenceIdAfterFinalize(
                    itemId,
                    nextItems,
                    occurrenceId,
                    merged,
                  );
                  const targetMerged = merged.find((v) => v.id === itemId);
                  if (
                    persistEnabled &&
                    persistArticleId &&
                    persistUserId &&
                    targetMerged
                  ) {
                    const sb = getSupabaseBrowserClient();
                    const { item: saved, error } =
                      await persistManualVocabularyItem(sb, {
                        userId: persistUserId,
                        articleId: persistArticleId,
                        articlePlain,
                        item: targetMerged,
                      });
                    if (error) {
                      emitPersistError(`词汇保存失败：${error}`);
                    } else if (saved) {
                      merged = merged.map((v) =>
                        v.normalized_key === saved.normalized_key ? saved : v,
                      );
                      selectItemId = saved.id;
                      selectOccId = alignVocabOccurrenceIdAfterPersist(
                        preOcc,
                        saved,
                        selectOccId,
                      );
                    }
                  }
                  setVocabularyItems(merged);
                  setVocabFormOpen(false);
                  if (selectItemId) selectVocabItem(selectItemId, selectOccId);
                }}
              >
                保存
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {grammarFormOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => setGrammarFormOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
            role="dialog"
            aria-modal="true"
            aria-labelledby="grammar-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="grammar-form-title"
              className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
            >
              手动添加语法问题
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              同一 normalized 片段去重，新位置加入 occurrences。
            </p>
            <textarea
              value={grammarFormValue}
              onChange={(e) => setGrammarFormValue(e.target.value)}
              rows={3}
              className="mt-3 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="粘贴或输入德语句子…"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setGrammarFormOpen(false)}
              >
                取消
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  const t = grammarFormValue.trim();
                  if (!t) return;
                  const { nextItems, itemId, occurrenceId } =
                    mergeGrammarFromFormText(grammarItems, articlePlain, t);
                  let merged = expandGrammarItemsWithRepeatedSurface(
                    nextItems,
                    articlePlain,
                  );
                  let selectItemId = itemId;
                  let selectOccId = occurrenceId;
                  const targetMerged = merged.find((g) => g.id === itemId);
                  const prevOccSnapshot = targetMerged?.occurrences.find(
                    (o) => o.id === occurrenceId,
                  );
                  if (
                    persistEnabled &&
                    persistArticleId &&
                    persistUserId &&
                    targetMerged
                  ) {
                    const sb = getSupabaseBrowserClient();
                    const { item: saved, error } =
                      await persistManualGrammarItem(sb, {
                        userId: persistUserId,
                        articleId: persistArticleId,
                        articlePlain,
                        item: targetMerged,
                      });
                    if (error) {
                      emitPersistError(`语法保存失败：${error}`);
                    } else if (saved) {
                      merged = merged.map((g) =>
                        g.normalized_key === saved.normalized_key ? saved : g,
                      );
                      selectItemId = saved.id;
                      selectOccId = prevOccSnapshot
                        ? saved.occurrences.find(
                            (o) =>
                              occurrencePositionKey(o) ===
                              occurrencePositionKey(prevOccSnapshot),
                          )?.id ??
                          saved.occurrences[0]?.id ??
                          occurrenceId
                        : occurrenceId;
                    }
                  }
                  setGrammarItems(merged);
                  setGrammarFormOpen(false);
                  if (selectItemId) selectGrammarItem(selectItemId, selectOccId);
                }}
              >
                保存
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showMobileSheet ? (
        <div
          className="pointer-events-none fixed inset-0 z-40 bg-black/40 md:hidden"
          role="presentation"
          aria-hidden
        />
      ) : null}

      {showMobileSheet ? (
        <div
          ref={mobileSheetScrollRef}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[min(360px,50dvh)] overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 md:hidden"
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
              详情
            </p>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              onClick={() => {
                if (tab === "vocab") setVocabSelection(null);
                else if (tab === "grammar") setGrammarSelection(null);
              }}
            >
              关闭
            </button>
          </div>
          <div className="mt-2">
            {tab === "vocab"
              ? vocabDetailOnly
              : tab === "grammar"
                ? grammarDetailOnly
                : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
