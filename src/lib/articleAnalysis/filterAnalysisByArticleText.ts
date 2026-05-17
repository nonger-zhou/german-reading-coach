import { findBestTextOccurrence } from "@/lib/articleReadingModel";
import type { ArticleAnalysisResult } from "./types";

/** grammar.selected_text 须在正文中为真实连续子串（与 Prompt 一致）。 */
export function isContiguousSubstringInArticle(
  articlePlain: string,
  fragment: string,
): boolean {
  const t = fragment.trim();
  if (!t) return false;
  return findBestTextOccurrence(articlePlain, t, 0) !== null;
}

/** 仅剔除 grammar；vocabulary 不在此剔除（见 route 与 listRealAiEntriesWithoutTextMatch）。 */
export function filterArticleAnalysisGrammarByArticleText(
  analysis: ArticleAnalysisResult,
  articlePlain: string,
): {
  analysis: ArticleAnalysisResult;
  removedGrammar: string[];
} {
  const removedGrammar: string[] = [];
  const grammar = analysis.grammar.filter((item) => {
    if (isContiguousSubstringInArticle(articlePlain, item.selected_text)) {
      return true;
    }
    removedGrammar.push(item.selected_text);
    return false;
  });

  return {
    analysis: { ...analysis, grammar },
    removedGrammar,
  };
}

/**
 * 兼容旧调用：仅过滤 grammar；vocabulary 原样返回，removedVocabulary 恒为空。
 */
export function filterArticleAnalysisByArticleText(
  analysis: ArticleAnalysisResult,
  articlePlain: string,
): {
  analysis: ArticleAnalysisResult;
  removedVocabulary: string[];
  removedGrammar: string[];
} {
  const { analysis: next, removedGrammar } =
    filterArticleAnalysisGrammarByArticleText(analysis, articlePlain);
  return {
    analysis: next,
    removedVocabulary: [],
    removedGrammar,
  };
}
