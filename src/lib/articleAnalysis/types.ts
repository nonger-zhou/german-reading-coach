import type { CefrLevel } from "@/lib/types";
import type { VocabGrammaticalGender } from "@/lib/vocabulary/grammaticalGender";

/** AI 分析结果结构：Phase 3.0 Mock 与 Phase 3.1 OpenAI 结构化输出共用 */

export type AnalyzedOccurrenceHint = {
  start_offset: number;
  end_offset: number;
};

export type AnalyzedVocabularyItem = {
  surface_form: string;
  lemma: string;
  normalized_key: string;
  part_of_speech: string;
  /** 名词类须填 m/f/n；非名词或短语填 na；不确定填 unclear */
  grammatical_gender: VocabGrammaticalGender;
  level_estimate: CefrLevel;
  zh_meaning: string;
  simple_de_explanation: string;
  example_sentence: string;
  reason_for_selection: string;
  /** 若省略则由阅读页在 articlePlain 上匹配 surface_form */
  occurrences?: AnalyzedOccurrenceHint[];
};

export type AnalyzedGrammarItem = {
  grammar_key: string;
  /** 与 `grammar_key` 共同对应总库唯一键；可与 grammar_key 不同以区分同大概念下小难点 */
  normalized_key: string;
  selected_text: string;
  name_de: string;
  name_zh: string;
  level_estimate: CefrLevel;
  explanation_zh: string;
  explanation_de_simple: string;
  example_sentence: string;
  reason_for_selection: string;
  occurrences?: AnalyzedOccurrenceHint[];
};

export type ArticleAnalysisResult = {
  vocabulary: AnalyzedVocabularyItem[];
  grammar: AnalyzedGrammarItem[];
  summary_zh: string;
  summary_de_simple: string;
  reading_questions: string[];
};
