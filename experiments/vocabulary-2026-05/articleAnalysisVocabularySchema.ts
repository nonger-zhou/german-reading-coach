/** vocabulary-only strict JSON schema（实验 / live 对比，生产 route 仍用整文 schema） */

export const VOCABULARY_ITEM_JSON_SCHEMA = {
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

export const VOCABULARY_ONLY_JSON_SCHEMA = {
  name: "vocabulary_only",
  strict: true as const,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      vocabulary: {
        type: "array",
        items: VOCABULARY_ITEM_JSON_SCHEMA,
      },
    },
    required: ["vocabulary"],
  },
} as const;
