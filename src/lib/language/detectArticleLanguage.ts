import type { LearningLanguage } from "./learningLanguage";

/**
 * 导入时识别正文是德语还是英语（只区分这两种）。
 * 方法：数两种语言最常见虚词的出现次数（只用几乎不在另一种语言里出现的词；was、will 两种语言都有，不计）。
 * 文本太短或两边差不多时返回 null，由用户当前选择决定。
 */
const GERMAN_MARKERS = new Set([
  "der", "die", "das", "und", "ist", "nicht", "ein", "eine", "einen", "dem", "den", "des",
  "mit", "auf", "für", "sich", "auch", "wird", "werden", "wurde", "sind", "noch", "nach",
  "bei", "aus", "wie", "aber", "oder", "dass", "über", "zum", "zur", "vom", "im", "ich",
  "wir", "sie", "es", "hat", "haben", "kann", "nur", "schon", "sehr", "durch", "gegen",
]);

const ENGLISH_MARKERS = new Set([
  "the", "and", "of", "to", "is", "that", "it", "with", "for", "on", "are", "as",
  "be", "this", "have", "by", "from", "they", "at", "but", "not", "which", "has", "were",
  "their", "been", "would", "said", "who", "what", "there", "can", "more", "about",
  "its", "than", "could", "should", "these", "those", "into", "after", "over",
]);

export type LanguageDetection = {
  language: LearningLanguage | null;
  germanHits: number;
  englishHits: number;
};

export function detectArticleLanguage(text: string): LanguageDetection {
  let germanHits = 0;
  let englishHits = 0;
  const words = text.toLowerCase().match(/[a-zäöüß]+/g) ?? [];
  for (const w of words.slice(0, 3000)) {
    if (GERMAN_MARKERS.has(w)) germanHits++;
    if (ENGLISH_MARKERS.has(w)) englishHits++;
  }
  /** 德语特有字母也算证据 */
  if (/[äöüß]/i.test(text)) germanHits += Math.min(5, (text.match(/[äöüß]/gi) ?? []).length);
  const total = germanHits + englishHits;
  if (total < 8) return { language: null, germanHits, englishHits };
  if (germanHits >= englishHits * 2) return { language: "de", germanHits, englishHits };
  if (englishHits >= germanHits * 2) return { language: "en", germanHits, englishHits };
  return { language: null, germanHits, englishHits };
}
