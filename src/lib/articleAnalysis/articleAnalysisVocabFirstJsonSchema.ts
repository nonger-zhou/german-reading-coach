/** OpenAI json_schema：vocab-first 整文分析（仅 vocabulary + reading_questions）。 */

const VOCABULARY_ITEM_SCHEMA = {
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
} as const;

export const ARTICLE_VOCAB_FIRST_JSON_SCHEMA = {
  name: "article_vocab_first_analysis",
  strict: true as const,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      vocabulary: {
        type: "array",
        items: VOCABULARY_ITEM_SCHEMA,
      },
      reading_questions: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 3,
      },
    },
    required: ["vocabulary", "reading_questions"],
  },
} as const;
