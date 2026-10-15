import type { LearningLanguage } from "@/lib/language/learningLanguage";
import { germanLexicon } from "./germanLexicon";
import type { VocabLexicon } from "./lexicon";

/**
 * 按语言取选词用的语言知识。
 * 德语同步可用（与以前一样常驻）；英语词表约 650 KB，只在分析英语文章时按需加载，德语请求不加载。
 */
export function getLexicon(language: "de"): VocabLexicon;
export function getLexicon(language: LearningLanguage): VocabLexicon | undefined;
export function getLexicon(language: LearningLanguage): VocabLexicon | undefined {
  return language === "de" ? germanLexicon : englishCache;
}

let englishCache: VocabLexicon | undefined;

export async function loadLexicon(language: LearningLanguage): Promise<VocabLexicon> {
  if (language === "de") return germanLexicon;
  if (!englishCache) {
    const mod = await import("./englishLexicon");
    englishCache = mod.englishLexicon;
  }
  return englishCache;
}
