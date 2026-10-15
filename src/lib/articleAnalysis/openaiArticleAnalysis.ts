import type { AnalyzedVocabularyItem, ArticleAnalysisResult } from "./types";
import type { CefrLevel } from "@/lib/types";
import {
  GRAMMAR_ANALYSIS_V2_SYSTEM_SECTION,
  GRAMMAR_SELECTED_TEXT_CONTIGUOUS_SUBSTRING_RULE,
} from "@/lib/articleAnalysis/grammarAnalysisV2Prompt";
import { VOCABULARY_SYSTEM_SECTION } from "@/lib/articleAnalysis/vocabularySelectionPrompt";
import {
  READING_QUESTIONS_SHORT_SECTION,
  VOCABULARY_MINIMAL_B_SYSTEM,
} from "@/lib/articleAnalysis/vocabularyMinimalBPrompt";
import {
  parseFiniteVerbPosition,
  parseGrammarType,
  parseIsSubordinateClause,
} from "@/lib/articleAnalysis/grammarTypes";
import { parseGrammaticalGender } from "@/lib/vocabulary/grammaticalGender";
import { normalizeTextKey } from "@/lib/articleReadingModel";

/**
 * 单次整文分析送入模型的正文上限（字符数）。
 * 原因：控制单次 OpenAI 调用的 token/费用/延迟，并降低超长文 JSON 输出失败率；超长文目前只分析前半段（响应 warning）。
 * 后续可改为分块分析或分段合并推荐。
 */
export const OPENAI_ANALYSIS_TEXT_CHAR_LIMIT = 10_000;

/** 选词 v2：程序根据用户词库与词频计算的候选/必推列表优先于模型对等级的主观判断 */
const USER_VOCAB_PROFILE_PRIORITY_SECTION = `【用户词汇画像优先】
若 user 消息中给出【用户词汇画像】【候选生词】【必须推荐】，选词以它们为准：单个词只从候选生词中选，必须推荐的词逐条输出，按对读懂本文的重要程度排序；下文按 userLevel 的判断仅作补充。这些列表由程序根据用户真实词库计算，比你对等级的主观估计更可靠。`;

export const SYSTEM_PROMPT_LEGACY = `你是德语阅读学习助手。
目标用户为中文母语德语学习者；解释语言默认为中文；simple_de_explanation / explanation_de_simple 使用简单德语。

核心目标：用户在阅读文章前，先查看你标出的关键词汇和语法点；看完这些解释后，应能大致读懂文章主旨和关键细节。

【输出范围】
- reading_questions：**恰好 3 条**中文问题。
- grammar：见下方 Grammar Analysis v2；不设固定条数上限；不要为了凑条数编造语法点。
- vocabulary：见下方【vocabulary】专节（唯一词汇任务说明）。

${VOCABULARY_SYSTEM_SECTION}

${USER_VOCAB_PROFILE_PRIORITY_SECTION}

【userLevel】
依据 user 消息中的 userLevel 判断哪些词汇与语法值得推荐（A2 偏基础；B1 新闻常见搭配与结构；B2 减少过于基础的词；C1/C2 仅在确有帮助时提高难度）。

${GRAMMAR_ANALYSIS_V2_SYSTEM_SECTION}

${GRAMMAR_SELECTED_TEXT_CONTIGUOUS_SUBSTRING_RULE}

【grammar 与 vocabulary 的分工】
语法结构（从句、语序、语态等）→ grammar；词汇与表达含义 → vocabulary。同一位置不要重复堆砌。

【硬性要求】
1. 不要推荐明显人名、地名、媒体名、公司名，除非它们本身有语言学习价值。
2. 不要推荐正文中不存在的词或片段。
3. grammar.**selected_text** 必须是 originalText 中的真实连续子串（区分大小写与变音符号）。vocabulary.**surface_form** 优先为文中连续片段；禁止省略号占位或文中不存在的拼接。
4. 不要编造原文中不存在的例句；example_sentence 可摘自原文。
5. vocabulary 填写 **normalized_key**（lemma 小写或规范形式的归一化键）。
6. grammar 每条输出 **grammar_type** 与 **normalized_key**；入库 grammar_key = grammar_type。`;

/** 生产默认：极简 B vocabulary + 短阅读问题；无 grammar、无摘要。 */
export const SYSTEM_PROMPT_VOCAB_FIRST = `你是德语阅读学习助手。
目标用户为中文母语德语学习者；词汇释义与阅读问题使用中文；simple_de_explanation 使用简单德语。

核心目标：帮助用户在阅读前掌握值得学习的词汇与表达，并通过 3 条阅读问题检查理解。不要推荐语法点，不要写摘要。

【输出范围】
- vocabulary：见下方英文任务说明。
- reading_questions：见下方短说明。

${VOCABULARY_MINIMAL_B_SYSTEM}

${READING_QUESTIONS_SHORT_SECTION}

${USER_VOCAB_PROFILE_PRIORITY_SECTION}

【userLevel】
依据 user 消息中的 userLevel 判断哪些词汇值得推荐（A2 偏基础；B1 新闻常见搭配；B2 减少过于基础的词）。

【硬性要求】
1. 不要推荐正文中不存在的 surface_form。
2. vocabulary 填写 normalized_key。
3. 不要输出 grammar、summary_zh、summary_de_simple。`;

/** 生产默认 system prompt（legacy 见 ENABLE_AUTO_GRAMMAR_ANALYSIS）。 */
export const SYSTEM_PROMPT = SYSTEM_PROMPT_VOCAB_FIRST;

export function truncateForOpenAIAnalysis(fullText: string): {
  text: string;
  truncated: boolean;
} {
  if (fullText.length <= OPENAI_ANALYSIS_TEXT_CHAR_LIMIT) {
    return { text: fullText, truncated: false };
  }
  return {
    text: fullText.slice(0, OPENAI_ANALYSIS_TEXT_CHAR_LIMIT),
    truncated: true,
  };
}

export function buildOpenAIAnalysisUserContent(params: {
  title: string;
  originalText: string;
  userLevel: CefrLevel;
  /** 已掌握/暂忽略词汇键说明（OpenAI user 消息附加段） */
  vocabLibraryBlockAppendix?: string;
  /** 已掌握/暂忽略语法键说明（legacy 整文分析） */
  grammarLibraryBlockAppendix?: string;
}): string {
  const base = `userLevel: ${params.userLevel}

title:
${params.title}

originalText:
${params.originalText}`;
  const extras = [
    params.vocabLibraryBlockAppendix,
    params.grammarLibraryBlockAppendix,
  ]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
  if (!extras.length) return base;
  return `${base}\n\n${extras.join("\n\n")}`;
}

function normalizeVocabularyRows(
  vocRaw: unknown[],
): ArticleAnalysisResult["vocabulary"] {
  return vocRaw.map((row): AnalyzedVocabularyItem => {
    const r = row as Record<string, unknown>;
    const base = r as unknown as AnalyzedVocabularyItem;
    return {
      ...base,
      grammatical_gender: parseGrammaticalGender(r.grammatical_gender),
    };
  });
}

function normalizeGrammarRows(
  graRaw: unknown[],
): ArticleAnalysisResult["grammar"] {
  return graRaw.map((row) => {
    const r = row as Record<string, unknown>;
    const grammar_type = parseGrammarType(r.grammar_type ?? r.grammar_key);
    const grammar_key = grammar_type;
    const nkIn = typeof r.normalized_key === "string" ? r.normalized_key : "";
    const nk = nkIn.trim()
      ? normalizeTextKey(nkIn)
      : normalizeTextKey(grammar_key);
    const base = r as unknown as ArticleAnalysisResult["grammar"][0];
    return {
      ...base,
      grammar_type,
      grammar_key,
      normalized_key: nk,
      is_subordinate_clause: parseIsSubordinateClause(r.is_subordinate_clause),
      finite_verb: typeof r.finite_verb === "string" ? r.finite_verb.trim() : "",
      finite_verb_position: parseFiniteVerbPosition(r.finite_verb_position),
    };
  });
}

/** vocab-first API 响应规范化（grammar/摘要恒空，兼容 ArticleAnalysisResult）。 */
export function normalizeOpenAIVocabFirstArticleAnalysis(
  raw: unknown,
): ArticleAnalysisResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("分析结果格式无效");
  }
  const o = raw as Record<string, unknown>;
  const reading_questions = Array.isArray(o.reading_questions)
    ? o.reading_questions.filter((x) => typeof x === "string")
    : [];
  const vocRaw = Array.isArray(o.vocabulary) ? o.vocabulary : [];

  return {
    vocabulary: normalizeVocabularyRows(vocRaw),
    grammar: [],
    summary_zh: "",
    summary_de_simple: "",
    reading_questions: reading_questions.slice(0, 3),
  };
}

export function normalizeOpenAIArticleAnalysis(
  raw: unknown,
): ArticleAnalysisResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("分析结果格式无效");
  }
  const o = raw as Record<string, unknown>;
  const reading_questions = Array.isArray(o.reading_questions)
    ? o.reading_questions.filter((x) => typeof x === "string")
    : [];

  const vocRaw = Array.isArray(o.vocabulary) ? o.vocabulary : [];
  const graRaw = Array.isArray(o.grammar) ? o.grammar : [];

  return {
    vocabulary: normalizeVocabularyRows(vocRaw),
    grammar: normalizeGrammarRows(graRaw),
    summary_zh: typeof o.summary_zh === "string" ? o.summary_zh : "",
    summary_de_simple:
      typeof o.summary_de_simple === "string" ? o.summary_de_simple : "",
    reading_questions: reading_questions.slice(0, 3),
  };
}
