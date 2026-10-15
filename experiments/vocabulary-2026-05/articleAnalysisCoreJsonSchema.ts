import { FINITE_VERB_POSITION_VALUES, GRAMMAR_TYPE_VALUES } from "@/lib/articleAnalysis/grammarTypes";

/** grammar + 摘要 + 阅读问题（实验用拆分调用，不含 vocabulary） */
export const ARTICLE_CORE_ANALYSIS_JSON_SCHEMA = {
  name: "article_core_analysis",
  strict: true as const,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      grammar: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            grammar_type: {
              type: "string",
              enum: [...GRAMMAR_TYPE_VALUES],
            },
            normalized_key: { type: "string" },
            selected_text: { type: "string" },
            name_de: { type: "string" },
            name_zh: { type: "string" },
            is_subordinate_clause: { type: "boolean" },
            finite_verb: { type: "string" },
            finite_verb_position: {
              type: "string",
              enum: [...FINITE_VERB_POSITION_VALUES],
            },
            level_estimate: {
              type: "string",
              enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
            },
            explanation_zh: { type: "string" },
            explanation_de_simple: { type: "string" },
            example_sentence: { type: "string" },
            reason_for_selection: { type: "string" },
          },
          required: [
            "grammar_type",
            "normalized_key",
            "selected_text",
            "name_de",
            "name_zh",
            "is_subordinate_clause",
            "finite_verb",
            "finite_verb_position",
            "level_estimate",
            "explanation_zh",
            "explanation_de_simple",
            "example_sentence",
            "reason_for_selection",
          ],
        },
      },
      summary_zh: { type: "string" },
      summary_de_simple: { type: "string" },
      reading_questions: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: [
      "grammar",
      "summary_zh",
      "summary_de_simple",
      "reading_questions",
    ],
  },
} as const;
