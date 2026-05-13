/**
 * 从 `@/lib/articleReadingTypes` 再导出类型，便于按目录导入。
 * 权威定义仍在 `articleReadingTypes.ts`。
 */

export type {
  ArticleGrammarItem,
  ArticleGrammarSource,
  ArticleVocabItem,
  ArticleVocabSource,
  ChunkInterval,
  GrammarOccurrence,
  GrammarSelection,
  OccurrenceSource,
  ReadingSelection,
  VocabOccurrence,
  VocabSelection,
  VocabSense,
} from "@/lib/articleReadingTypes";

/** 未来接入 Supabase 时用于批量同步的草稿形状（占位，尚未接线） */
export type ArticleReadingPersistBundle = {
  articleId: string;
  /** 对应 vocabulary_items / senses / occurrences */
  vocabularySnapshot: unknown;
  /** 对应 grammar_items / occurrences */
  grammarSnapshot: unknown;
};
