import type { LearningLanguage } from "@/lib/language/learningLanguage";
import type { CefrLevel } from "@/lib/types";

export type ProperNameContext = {
  appearsLowercaseInText: boolean;
  capitalizedMidSentence: boolean;
};

export type ArticleToken = {
  surface: string;
  start: number;
  end: number;
};

/**
 * 一种语言的选词所需全部语言知识。选词规则（学习中必推、已掌握不推、词频分界线、自适应）对所有语言相同，
 * 只有这里的分词、词频、词形还原、专名判断和提示词示例按语言不同。
 * 德语：germanLexicon.ts（即原有实现，未改动）；英语：englishLexicon.ts。
 */
export type VocabLexicon = {
  language: LearningLanguage;
  /** 大小写转换用 */
  locale: string;
  /** 各等级默认「已认识」分界线（词频排名） */
  levelCutoff: Record<CefrLevel, number>;
  tokenize(text: string): ArticleToken[];
  /** 单个词形的词频排名（会尝试还原词形）；查不到返回 undefined */
  rankOfWord(word: string): number | undefined;
  /** 统一比对键（小写、去冠词等），用于「已掌握 / 学习中」判断 */
  matchKey(raw: string | null | undefined): string;
  /** 小写词形是否为某个已知键的屈折变形（含原形） */
  isKnownToken(tokenLower: string, knownKeys: ReadonlySet<string>): boolean;
  /** 小写词形是否为该键的屈折变形（含原形） */
  tokenMatchesKey(tokenLower: string, key: string): boolean;
  /**
   * 疑似专名。`ctx` 为该词形在全文中的大小写信号（英语用；德语名词都大写，不使用）：
   * - appearsLowercaseInText：文中也以小写出现过；
   * - capitalizedMidSentence：在句中（非句首）以大写出现过。
   */
  looksLikeProperNameToken(surface: string, ctx: ProperNameContext): boolean;
  /** 给模型的提示词中与语言相关的几行 */
  prompt: {
    /** 「动词、形容词……同等重要」一行（含本语言示例） */
    partsOfSpeechLine: string;
    /** 多词表达一行 */
    multiWordLine: string;
    /** 【候选生词】标题行 */
    candidatesHeader: string;
  };
};
