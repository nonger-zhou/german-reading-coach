/**
 * 学习语言（多语言 Reading Coach）。见 docs/PRD.md §1.5。
 *
 * - 所有文章、词条、语法项都带 `language`；数据库默认 'de'（010 迁移前的旧数据一律为德语）。
 * - 德语与英语是两个独立的学习空间：列表、推荐、复习、水平设置都只针对当前语言。
 */

export type LearningLanguage = "de" | "en";

export const LEARNING_LANGUAGES: readonly LearningLanguage[] = ["de", "en"] as const;

/** 缺省语言：旧数据、未指定时一律视为德语，保证德语行为不变 */
export const DEFAULT_LEARNING_LANGUAGE: LearningLanguage = "de";

export function isLearningLanguage(v: unknown): v is LearningLanguage {
  return v === "de" || v === "en";
}

/** 任意输入 → 合法语言；无法识别时回落德语 */
export function normalizeLearningLanguage(v: unknown): LearningLanguage {
  return isLearningLanguage(v) ? v : DEFAULT_LEARNING_LANGUAGE;
}

export const LEARNING_LANGUAGE_LABEL_ZH: Record<LearningLanguage, string> = {
  de: "德语",
  en: "英语",
};

/** 朗读、大小写转换用的 locale */
export const LEARNING_LANGUAGE_LOCALE: Record<LearningLanguage, string> = {
  de: "de-DE",
  en: "en-US",
};
