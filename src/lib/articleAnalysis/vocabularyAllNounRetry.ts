import type { ArticleAnalysisResult } from "./types";
import {
  countNonNounVocabulary,
  isVocabularyAllNounLike,
} from "./vocabularyRegressionDiagnostic";

/** 长文且 vocabulary 几乎全为名词时，允许再调一次 OpenAI（仅一次） */
export const VOCAB_ALL_NOUN_RETRY_MIN_TEXT_CHARS = 2_500;

/** 长文至少应有若干非名词项；仅 0–1 条时视为退化 */
const MIN_NON_NOUN_FOR_LONG_TEXT = 2;

export function shouldRetryAnalysisForAllNounVocabulary(
  analysis: ArticleAnalysisResult,
  articlePlainLength: number,
): boolean {
  if (articlePlainLength < VOCAB_ALL_NOUN_RETRY_MIN_TEXT_CHARS) return false;
  const voc = analysis.vocabulary;
  if (voc.length < 4) return false;
  const nonNoun = countNonNounVocabulary(voc);
  if (nonNoun >= MIN_NON_NOUN_FOR_LONG_TEXT) return false;
  if (isVocabularyAllNounLike(voc)) return true;
  return voc.length >= 5 && nonNoun <= 1;
}

export function vocabularyPosSummaryForLog(
  analysis: ArticleAnalysisResult,
): string {
  const total = analysis.vocabulary.length;
  const nonNoun = countNonNounVocabulary(analysis.vocabulary);
  return `vocabulary total=${total}, non-noun=${nonNoun}`;
}
