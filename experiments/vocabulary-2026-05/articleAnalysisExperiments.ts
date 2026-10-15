import type OpenAI from "openai";
import { ARTICLE_CORE_ANALYSIS_JSON_SCHEMA } from "@/lib/articleAnalysis/articleAnalysisCoreJsonSchema";
import { ARTICLE_ANALYSIS_JSON_SCHEMA } from "@/lib/articleAnalysis/articleAnalysisJsonSchema";
import { VOCABULARY_ONLY_JSON_SCHEMA } from "@/lib/articleAnalysis/articleAnalysisVocabularySchema";
import {
  ARTICLE_CORE_SYSTEM_PROMPT,
  normalizeOpenAIArticleCore,
} from "@/lib/articleAnalysis/openaiArticleCoreAnalysis";
import {
  buildOpenAIAnalysisUserContent,
  normalizeOpenAIArticleAnalysis,
  SYSTEM_PROMPT,
} from "@/lib/articleAnalysis/openaiArticleAnalysis";
import { EXPERIMENTAL_SYSTEM_PROMPT_FULL_WITH_MINIMAL_B_VOCAB } from "@/lib/articleAnalysis/experimentalFullArticleMinimalBPrompt";
import { EXPERIMENTAL_MINIMAL_B_VOCAB_ONLY_SYSTEM } from "@/lib/articleAnalysis/experimentalVocabularyOnlyMinimalPrompt";
import {
  normalizeOpenAIVocabularyOnly,
  VOCABULARY_ONLY_SYSTEM_PROMPT,
} from "@/lib/articleAnalysis/openaiVocabularyOnlyAnalysis";
import type { AnalyzedVocabularyItem } from "@/lib/articleAnalysis/types";
import type { CefrLevel } from "@/lib/types";

export type VocabularyExperimentStrategy =
  | "mini_single"
  | "gpt4o_single"
  | "mini_split"
  /** 第二次调用：vocabulary-only 使用 Reset v1 段（VOCABULARY_ONLY_SYSTEM_PROMPT） */
  | "mini_split_reset_vocab"
  /** 第二次调用：vocabulary-only 使用极简 B prompt */
  | "mini_split_minimal_b"
  /** 单次调用：仅 vocabulary，零语法/摘要/问题（Reset v1） */
  | "mini_vocab_only_reset"
  /** 单次调用：仅 vocabulary，零语法（极简 B） */
  | "mini_vocab_only_minimal_b"
  /** 单次整文：vocabulary 段替换为极简 B，仍含 Grammar v2（实验假设） */
  | "mini_single_full_minimal_b_vocab";

export type VocabularyExperimentParams = {
  title: string;
  originalText: string;
  userLevel: CefrLevel;
};

function parseJsonContent(content: string | null | undefined): unknown {
  if (!content) throw new Error("empty_completion");
  return JSON.parse(content);
}

/** 方案 2/基线：单次整文，指定模型 */
export async function requestVocabularyViaFullAnalysis(
  openai: OpenAI,
  params: VocabularyExperimentParams & {
    model: string;
    systemPrompt?: string;
  },
): Promise<AnalyzedVocabularyItem[]> {
  const systemPrompt = params.systemPrompt ?? SYSTEM_PROMPT;
  const completion = await openai.chat.completions.create({
    model: params.model,
    temperature: 0.3,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: buildOpenAIAnalysisUserContent({
          title: params.title,
          originalText: params.originalText,
          userLevel: params.userLevel,
        }),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: ARTICLE_ANALYSIS_JSON_SCHEMA,
    },
  });
  return normalizeOpenAIArticleAnalysis(
    parseJsonContent(completion.choices[0]?.message?.content),
  ).vocabulary;
}

/** 第二次调用：grammar+摘要+问题 与 vocabulary-only 并行（默认 gpt-4o-mini） */
export async function requestVocabularyViaSplitAnalysis(
  openai: OpenAI,
  params: VocabularyExperimentParams & {
    model?: string;
    vocabularySystemPrompt?: string;
  },
): Promise<AnalyzedVocabularyItem[]> {
  const model = params.model ?? "gpt-4o-mini";
  const vocabularySystemPrompt =
    params.vocabularySystemPrompt ?? VOCABULARY_ONLY_SYSTEM_PROMPT;
  const userContent = buildOpenAIAnalysisUserContent({
    title: params.title,
    originalText: params.originalText,
    userLevel: params.userLevel,
  });

  const [coreCompletion, vocabularyCompletion] = await Promise.all([
    openai.chat.completions.create({
      model,
      temperature: 0.3,
      messages: [
        { role: "system", content: ARTICLE_CORE_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: {
        type: "json_schema",
        json_schema: ARTICLE_CORE_ANALYSIS_JSON_SCHEMA,
      },
    }),
    openai.chat.completions.create({
      model,
      temperature: 0.3,
      messages: [
        { role: "system", content: vocabularySystemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: {
        type: "json_schema",
        json_schema: VOCABULARY_ONLY_JSON_SCHEMA,
      },
    }),
  ]);

  normalizeOpenAIArticleCore(
    parseJsonContent(coreCompletion.choices[0]?.message?.content),
  );

  return normalizeOpenAIVocabularyOnly(
    parseJsonContent(vocabularyCompletion.choices[0]?.message?.content),
  );
}

/** 单次调用：只请求 vocabulary JSON，不涉及 grammar / 摘要 / 阅读问题 */
export async function requestVocabularyViaVocabularyOnlySingleCall(
  openai: OpenAI,
  params: VocabularyExperimentParams & {
    model?: string;
    vocabularySystemPrompt?: string;
  },
): Promise<AnalyzedVocabularyItem[]> {
  const model = params.model ?? "gpt-4o-mini";
  const vocabularySystemPrompt =
    params.vocabularySystemPrompt ?? VOCABULARY_ONLY_SYSTEM_PROMPT;
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.3,
    messages: [
      { role: "system", content: vocabularySystemPrompt },
      {
        role: "user",
        content: buildOpenAIAnalysisUserContent({
          title: params.title,
          originalText: params.originalText,
          userLevel: params.userLevel,
        }),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: VOCABULARY_ONLY_JSON_SCHEMA,
    },
  });
  return normalizeOpenAIVocabularyOnly(
    parseJsonContent(completion.choices[0]?.message?.content),
  );
}

export async function requestVocabularyForStrategy(
  openai: OpenAI,
  strategy: VocabularyExperimentStrategy,
  params: VocabularyExperimentParams,
): Promise<AnalyzedVocabularyItem[]> {
  switch (strategy) {
    case "mini_single":
      return requestVocabularyViaFullAnalysis(openai, {
        ...params,
        model: "gpt-4o-mini",
      });
    case "gpt4o_single":
      return requestVocabularyViaFullAnalysis(openai, {
        ...params,
        model: "gpt-4o",
      });
    case "mini_split":
    case "mini_split_reset_vocab":
      return requestVocabularyViaSplitAnalysis(openai, params);
    case "mini_split_minimal_b":
      return requestVocabularyViaSplitAnalysis(openai, {
        ...params,
        vocabularySystemPrompt: EXPERIMENTAL_MINIMAL_B_VOCAB_ONLY_SYSTEM,
      });
    case "mini_vocab_only_reset":
      return requestVocabularyViaVocabularyOnlySingleCall(openai, params);
    case "mini_vocab_only_minimal_b":
      return requestVocabularyViaVocabularyOnlySingleCall(openai, {
        ...params,
        vocabularySystemPrompt: EXPERIMENTAL_MINIMAL_B_VOCAB_ONLY_SYSTEM,
      });
    case "mini_single_full_minimal_b_vocab":
      return requestVocabularyViaFullAnalysis(openai, {
        ...params,
        model: "gpt-4o-mini",
        systemPrompt: EXPERIMENTAL_SYSTEM_PROMPT_FULL_WITH_MINIMAL_B_VOCAB,
      });
    default: {
      const _exhaustive: never = strategy;
      throw new Error(`unknown strategy: ${String(_exhaustive)}`);
    }
  }
}
