export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type MasteryStatus =
  | "new"
  | "learning"
  | "familiar"
  | "mastered"
  | "ignored";

/** 词条来源：课文内置高亮为 article；用户选区或表单添加为 user_added */
export type VocabSource = "article" | "user_added";

export interface VocabEntry {
  id: string;
  lemma: string;
  display_word: string;
  part_of_speech: string;
  /** 名词性（课文 seed 可选）；非名词用 na */
  grammatical_gender?: "na" | "m" | "f" | "n" | "unclear";
  zh_meaning: string;
  simple_de_explanation: string;
  encounter_count: number;
  mastery_status: MasteryStatus;
  source?: VocabSource;
}

/** 语法点来源：课文内置为 article；用户选区或表单为 user_added */
export type GrammarSource = "article" | "user_added";

export interface GrammarEntry {
  id: string;
  grammar_key: string;
  name_de: string;
  name_zh: string;
  explanation_zh: string;
  encounter_count: number;
  mastery_status: MasteryStatus;
  source?: GrammarSource;
}

export type ArticleChunk =
  | { kind: "text"; text: string }
  | { kind: "vocab"; id: string; surface: string }
  | { kind: "grammar"; id: string; surface: string };

export interface MockArticleMeta {
  title: string;
  summaryZh: string;
  questions: string[];
}
