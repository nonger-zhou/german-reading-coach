import type { AnalyzedVocabularyItem } from "@/lib/articleAnalysis/types";
import { VOCABULARY_SYSTEM_SECTION } from "@/lib/articleAnalysis/vocabularySelectionPrompt";
import { parseGrammaticalGender } from "@/lib/vocabulary/grammaticalGender";

/** 实验：仅 vocabulary（与生产 vocabulary 段同源，无 Grammar v2） */
export const VOCABULARY_ONLY_SYSTEM_PROMPT = `你是德语阅读学习助手，**只**输出 vocabulary 数组。
不要输出 grammar、摘要或阅读问题。解释使用中文；simple_de_explanation 使用简单德语。

${VOCABULARY_SYSTEM_SECTION}

硬性要求：surface_form 必须是 originalText 中真实连续子串；不要推荐正文不存在的片段。`;

export function normalizeOpenAIVocabularyOnly(
  raw: unknown,
): AnalyzedVocabularyItem[] {
  if (!raw || typeof raw !== "object") {
    throw new Error("词汇分析结果格式无效");
  }
  const o = raw as Record<string, unknown>;
  const vocRaw = Array.isArray(o.vocabulary) ? o.vocabulary : [];
  return vocRaw.map((row): AnalyzedVocabularyItem => {
    const r = row as Record<string, unknown>;
    const base = r as unknown as AnalyzedVocabularyItem;
    return {
      ...base,
      grammatical_gender: parseGrammaticalGender(r.grammatical_gender),
    };
  });
}
