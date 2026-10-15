import type { ArticleAnalysisResult } from "./types";
import type { CefrLevel } from "@/lib/types";
import {
  GRAMMAR_ANALYSIS_V2_SYSTEM_SECTION,
  GRAMMAR_SELECTED_TEXT_CONTIGUOUS_SUBSTRING_RULE,
} from "@/lib/articleAnalysis/grammarAnalysisV2Prompt";
import {
  parseFiniteVerbPosition,
  parseGrammarType,
  parseIsSubordinateClause,
} from "@/lib/articleAnalysis/grammarTypes";
import { normalizeTextKey } from "@/lib/articleReadingModel";

export type ArticleCoreAnalysisResult = Omit<
  ArticleAnalysisResult,
  "vocabulary"
>;

/** 实验：仅 grammar + 摘要 + 阅读问题（不含 vocabulary） */
export const ARTICLE_CORE_SYSTEM_PROMPT = `你是德语阅读学习助手。
目标用户默认为中文母语者；解释语言默认为中文；summary_de_simple 使用简单德语。

本次只输出 grammar、summary_zh、summary_de_simple、reading_questions。**不要**输出 vocabulary。

【推荐数量】
- grammar：**不设固定条数上限**；准确性优先，不要凑条数。
- reading_questions **恰好 3 条**中文问题。

【用户水平 userLevel】
依据 userLevel（常见 B1）判断哪些语法值得推荐。

${GRAMMAR_ANALYSIS_V2_SYSTEM_SECTION}

${GRAMMAR_SELECTED_TEXT_CONTIGUOUS_SUBSTRING_RULE}

硬性要求：
1. grammar.selected_text 必须是 originalText 中真实连续子串。
2. grammar 每条输出 grammar_type 与 normalized_key；grammar_key = grammar_type。`;

export function normalizeOpenAIArticleCore(
  raw: unknown,
): ArticleCoreAnalysisResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("分析结果格式无效");
  }
  const o = raw as Record<string, unknown>;
  const reading_questions = Array.isArray(o.reading_questions)
    ? o.reading_questions.filter((x) => typeof x === "string")
    : [];

  const graRaw = Array.isArray(o.grammar) ? o.grammar : [];
  const grammar = graRaw.map((row) => {
    const r = row as Record<string, unknown>;
    const grammar_type = parseGrammarType(
      r.grammar_type ?? r.grammar_key,
    );
    const grammar_key = grammar_type;
    const nkIn = typeof r.normalized_key === "string" ? r.normalized_key : "";
    const nk = nkIn.trim()
      ? normalizeTextKey(nkIn)
      : normalizeTextKey(grammar_key);
    const base = r as unknown as ArticleCoreAnalysisResult["grammar"][0];
    return {
      ...base,
      grammar_type,
      grammar_key,
      normalized_key: nk,
      is_subordinate_clause: parseIsSubordinateClause(
        r.is_subordinate_clause,
      ),
      finite_verb:
        typeof r.finite_verb === "string" ? r.finite_verb.trim() : "",
      finite_verb_position: parseFiniteVerbPosition(r.finite_verb_position),
    };
  });

  return {
    grammar,
    summary_zh: typeof o.summary_zh === "string" ? o.summary_zh : "",
    summary_de_simple:
      typeof o.summary_de_simple === "string" ? o.summary_de_simple : "",
    reading_questions: reading_questions.slice(0, 3),
  };
}
