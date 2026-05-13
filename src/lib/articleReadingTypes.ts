import type { ArticleChunk, CefrLevel, MasteryStatus } from "@/lib/types";
import type { VocabGrammaticalGender } from "@/lib/vocabulary/grammaticalGender";

/** 阅读页词条来源（列表 badge） */
export type ArticleVocabSource =
  | "ai_detected"
  | "user_added"
  | "ai_detected_then_user_confirmed"
  | "ai_mock"
  | "ai";

/** 阅读页语法项来源 */
export type ArticleGrammarSource =
  | "ai_detected"
  | "user_added"
  | "ai_detected_then_user_confirmed"
  | "ai_mock"
  | "ai";

export type OccurrenceSource = "ai_detected" | "user_added";

export interface VocabOccurrence {
  id: string;
  surface_form: string;
  sentence: string;
  start_offset?: number;
  end_offset?: number;
  /** offset 不可靠时在 articlePlain 上精确匹配 */
  fallbackMatchText: string;
  source: OccurrenceSource;
  sense_id?: string;
}

export interface VocabSense {
  id: string;
  /** `vocabulary_senses.id`（UUID）；未持久化前勿写入库 */
  dbSenseId?: string | null;
  zh_meaning: string;
  simple_de_explanation: string;
  domain?: string;
  example_sentence?: string;
}

export interface ArticleVocabItem {
  /** 前端列表/React key（如 v-item-…、词汇块 id）；勿写入 Supabase */
  id: string;
  /** `vocabulary_items.id`（UUID）；仅持久化成功后存在 */
  dbItemId: string | null;
  lemma: string;
  display_word: string;
  normalized_key: string;
  part_of_speech: string;
  /** 名词语法性（m/f/n/unclear/na）；来自 AI 或库 `vocabulary_items.gender` */
  grammatical_gender?: VocabGrammaticalGender | null;
  zh_meaning: string;
  simple_de_explanation: string;
  mastery_status: MasteryStatus;
  source: ArticleVocabSource;
  needs_ai_enrichment?: boolean;
  /** CEFR 估计（AI / mock 分析） */
  level_estimate?: CefrLevel | string | null;
  /** AI 为何选中该词（Phase 3） */
  reason_for_selection?: string | null;
  /** 已成功写入 Supabase 词汇/义项/出现记录 */
  persisted?: boolean;
  /** 用户手动保存的外部 AI / 自己整理的深度笔记；不由本应用 AI API 生成 */
  user_deep_note?: string | null;
  user_deep_note_updated_at?: string | null;
  senses: VocabSense[];
  occurrences: VocabOccurrence[];
}

export interface GrammarOccurrence {
  id: string;
  surface_form: string;
  sentence: string;
  start_offset?: number;
  end_offset?: number;
  fallbackMatchText: string;
  source: OccurrenceSource;
}

export interface ArticleGrammarItem {
  /** 前端列表/React key（如 g-item-…、语法块 id）；勿写入 Supabase */
  id: string;
  /** `grammar_items.id`（UUID）；仅持久化成功后存在 */
  dbItemId: string | null;
  grammar_key: string;
  name_de: string;
  name_zh: string;
  explanation_zh: string;
  /** 简单德语解释（库字段 `explanation_de_simple`） */
  explanation_de_simple?: string | null;
  mastery_status: MasteryStatus;
  source: ArticleGrammarSource;
  normalized_key: string;
  level_estimate?: CefrLevel | string | null;
  reason_for_selection?: string | null;
  /** 已成功写入 Supabase 语法项及出现记录 */
  persisted?: boolean;
  /** 与 vocabulary_items.needs_ai_enrichment 对齐（手动添加常为 true） */
  needs_ai_enrichment?: boolean;
  /** 用户手动保存的外部 AI / 自己整理的深度笔记；不由本应用 AI API 生成 */
  user_deep_note?: string | null;
  user_deep_note_updated_at?: string | null;
  occurrences: GrammarOccurrence[];
}

export type ChunkInterval = {
  start: number;
  end: number;
  chunk: ArticleChunk;
  index: number;
};

export type VocabSelection = {
  type: "vocab";
  itemId: string;
  occurrenceId?: string;
};

export type GrammarSelection = {
  type: "grammar";
  itemId: string;
  occurrenceId?: string;
};

export type ReadingSelection = VocabSelection | GrammarSelection;
