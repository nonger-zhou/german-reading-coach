"use client";

/** 从 InteractiveArticleReader.tsx 拆出（2026-10-15，行为不变）。 */
import type {
  CSSProperties,
} from "react";
import {
  Badge,
} from "@/components/ui/Badge";
import type {
  ArticleGrammarItem,
  ArticleVocabItem,
  ArticleVocabSource,
  VocabSense,
} from "@/lib/articleReadingTypes";
import type {
  CefrLevel,
} from "@/lib/types";

/** 删除（remove）≠ 忽略（ignored）：删除用于误添加/重复；忽略保留记录、可恢复、表示不想继续学。 */
export const DELETE_LEARNING_ITEM_CONFIRM_ZH =
  "确定从本文删除这个学习项吗？这不会表示你已掌握，只是移除误添加的项目。";

/**
 * 正文里「可学习」高亮（词汇绿/琥珀、语法蓝/紫）统一允许 **拖选穿过**，
 * 以便跨多个已有高亮选整句加入词库；与 `resolveUserHighlightInPlain` 依赖的选区文本一致。
 * 词汇高亮在触摸时不在 `pointerdown` 上 `preventDefault`（与语法一致），以便拖选穿过绿/琥珀词选可分动词；点按打开详情在 `click` 且无文本选区时触发。
 * `-webkit-touch-callout: none` 抑制 iOS/Android「在 Google 中搜索」等系统浮层，避免挡住应用内选区工具栏。
 */
export const ARTICLE_LEARNING_HIGHLIGHT_TEXT_STYLE = {
  WebkitTapHighlightColor: "transparent",
  touchAction: "manipulation",
  userSelect: "text",
  WebkitUserSelect: "text",
  WebkitTouchCallout: "none",
} as CSSProperties;

export const GRAMMAR_ARTICLE_HIGHLIGHT_STYLE = ARTICLE_LEARNING_HIGHLIGHT_TEXT_STYLE;

export const GRAMMAR_EXTERNAL_DEEP_LINKS = {
  chatgpt: "https://chatgpt.com/",
  claude: "https://claude.ai/",
  gemini: "https://gemini.google.com/",
  deepseek: "https://chat.deepseek.com/",
} as const;

/** 单项 enrich / 全文重新分析前统一确认（Phase 3.14） */
export const CONFIRM_AI_REGENERATE_ZH =
  "这会再次调用 AI，并可能产生费用。确定重新生成吗？";

export const VOCAB_EXTERNAL_DEEP_LINKS = {
  chatgpt: "https://chatgpt.com/",
  claude: "https://claude.ai/",
  gemini: "https://gemini.google.com/",
  deepseek: "https://chat.deepseek.com/",
} as const;

/** 在指定滚动容器内滚动到元素（避免 scrollIntoView 误滚整页） */
export function mergeVocabFromEnrichmentApi(
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
    reason_for_selection: null,
    needs_ai_enrichment: false,
    senses:
      item.senses.length > 0
        ? [updatedFirst, ...item.senses.slice(1)]
        : [updatedFirst],
  };
}

/** 保存成功后合并同 normalized_key 的重复卡片（避免 map 后列表中出现两条相同 key） */
export function applyPersistedVocabToLocalItems(
  items: ArticleVocabItem[],
  saved: ArticleVocabItem,
): ArticleVocabItem[] {
  const nk = saved.normalized_key;
  const byKey = new Map<string, ArticleVocabItem>();
  for (const v of items) {
    const k = v.normalized_key;
    byKey.set(k, k === nk ? saved : v);
  }
  return [...byKey.values()];
}

export function mergeGrammarFromEnrichmentApi(
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
    reason_for_selection: null,
    needs_ai_enrichment: false,
  };
}

export const AI_ENRICH_PENDING_ZH = "待 AI";

export function posLabelZh(raw: string | null | undefined): string {
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
    // 英语文章常见类型（德语分析不产出这些词性）
    phrasal_verb: "短语动词",
    idiom: "习语",
    preposition_pattern: "介词搭配",
  };
  if (!k || k === "unknown" || k === "missing" || k === "—") return "词汇";
  return map[k] ?? raw?.trim() ?? "词汇";
}

export function isDeExplanationPlaceholder(s: string): boolean {
  const t = s.trim().toLowerCase();
  return (
    t.length === 0 ||
    t.includes("wird später ergänzt") ||
    t === "wird später ergänzt."
  );
}

/**
 * 英语空间里，未补充的简明解释在数据库里仍是德语占位句「Wird später ergänzt.」；
 * 显示时换成中文提示。德语原样显示（不改德语行为）。
 */
export function simpleExplanationForDisplay(
  text: string | null | undefined,
  language: "de" | "en",
  kind: "vocab" | "grammar" = "vocab",
): string {
  const s = text ?? "";
  if (language === "en" && isDeExplanationPlaceholder(s)) {
    return kind === "grammar" ? "（英文解释待补充）" : "（英文释义待补充）";
  }
  return s;
}

/** 词汇中/德解释均已有效（Phase 3.14：已有内容则不再显示「补充 AI 解释」） */
export function vocabExplanationsComplete(v: ArticleVocabItem): boolean {
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
export function vocabNeedsAiEnrichEntry(v: ArticleVocabItem): boolean {
  if (v.source !== "user_added") return false;
  return !vocabExplanationsComplete(v);
}

export function grammarExplanationsComplete(g: ArticleGrammarItem): boolean {
  const zh = (g.explanation_zh ?? "").trim();
  const de = (g.explanation_de_simple ?? "").trim();
  if (!zh || !de) return false;
  if (zh.includes(AI_ENRICH_PENDING_ZH)) return false;
  if (isDeExplanationPlaceholder(de)) return false;
  return true;
}

export function grammarNeedsAiEnrichEntry(g: ArticleGrammarItem): boolean {
  if (g.source !== "user_added") return false;
  return !grammarExplanationsComplete(g);
}

export function vocabBadge(source: ArticleVocabSource) {
  switch (source) {
    case "ai_detected":
    case "ai_mock":
    case "ai":
      return <Badge tone="muted">AI</Badge>;
    case "user_added":
    case "ai_detected_then_user_confirmed":
      return <Badge tone="warning">手动</Badge>;
    default:
      return null;
  }
}

export function grammarBadge(source: ArticleGrammarItem["source"]) {
  switch (source) {
    case "ai_detected":
    case "ai_mock":
    case "ai":
      return <Badge tone="muted">AI</Badge>;
    case "user_added":
    case "ai_detected_then_user_confirmed":
      return <Badge tone="warning">手动</Badge>;
    default:
      return null;
  }
}
