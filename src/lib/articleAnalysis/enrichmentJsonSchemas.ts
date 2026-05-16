/** OpenAI `response_format.json_schema`（strict），单条词汇补充解释 */
export const VOCAB_ENRICHMENT_JSON_SCHEMA = {
  name: "vocab_enrichment",
  strict: true as const,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      canonical_form: { type: "string" },
      surface_form: { type: "string" },
      zh_meaning: { type: "string" },
      simple_de_explanation: { type: "string" },
      part_of_speech: { type: "string" },
      level_estimate: {
        type: "string",
        enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
      },
      reason_for_selection: { type: "string" },
      example_sentence: { type: "string" },
    },
    required: [
      "canonical_form",
      "surface_form",
      "zh_meaning",
      "simple_de_explanation",
      "part_of_speech",
      "level_estimate",
      "reason_for_selection",
      "example_sentence",
    ],
  },
} as const;

import { FINITE_VERB_POSITION_VALUES, GRAMMAR_TYPE_VALUES } from "./grammarTypes";

/** OpenAI `response_format.json_schema`（strict），单条语法补充解释 */
export const GRAMMAR_ENRICHMENT_JSON_SCHEMA = {
  name: "grammar_enrichment",
  strict: true as const,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      grammar_type: {
        type: "string",
        enum: [...GRAMMAR_TYPE_VALUES],
      },
      name_de: { type: "string" },
      name_zh: { type: "string" },
      is_subordinate_clause: { type: "boolean" },
      finite_verb: { type: "string" },
      finite_verb_position: {
        type: "string",
        enum: [...FINITE_VERB_POSITION_VALUES],
      },
      was_label_corrected: { type: "boolean" },
      corrected_label: { type: "string" },
      correction_reason: { type: "string" },
      explanation_zh: { type: "string" },
      explanation_de_simple: { type: "string" },
      level_estimate: {
        type: "string",
        enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
      },
      reason_for_selection: { type: "string" },
      example_sentence: { type: "string" },
    },
    required: [
      "grammar_type",
      "name_de",
      "name_zh",
      "is_subordinate_clause",
      "finite_verb",
      "finite_verb_position",
      "was_label_corrected",
      "corrected_label",
      "correction_reason",
      "explanation_zh",
      "explanation_de_simple",
      "level_estimate",
      "reason_for_selection",
      "example_sentence",
    ],
  },
} as const;
