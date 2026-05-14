/**
 * OpenAI Chat Completions `response_format.json_schema`（strict）。
 * 与 {@link ArticleAnalysisResult} 字段对齐；不含可选 `occurrences`。
 */
export const ARTICLE_ANALYSIS_JSON_SCHEMA = {
  name: "article_analysis",
  strict: true as const,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      vocabulary: {
        type: "array",
        maxItems: 20,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            surface_form: { type: "string" },
            lemma: { type: "string" },
            normalized_key: { type: "string" },
            part_of_speech: { type: "string" },
            grammatical_gender: {
              type: "string",
              enum: ["na", "m", "f", "n", "unclear"],
            },
            level_estimate: {
              type: "string",
              enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
            },
            zh_meaning: { type: "string" },
            simple_de_explanation: { type: "string" },
            example_sentence: { type: "string" },
            reason_for_selection: { type: "string" },
          },
          required: [
            "surface_form",
            "lemma",
            "normalized_key",
            "part_of_speech",
            "grammatical_gender",
            "level_estimate",
            "zh_meaning",
            "simple_de_explanation",
            "example_sentence",
            "reason_for_selection",
          ],
        },
      },
      grammar: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            grammar_key: { type: "string" },
            normalized_key: { type: "string" },
            selected_text: { type: "string" },
            name_de: { type: "string" },
            name_zh: { type: "string" },
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
            "grammar_key",
            "normalized_key",
            "selected_text",
            "name_de",
            "name_zh",
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
      "vocabulary",
      "grammar",
      "summary_zh",
      "summary_de_simple",
      "reading_questions",
    ],
  },
} as const;
