/** explain-grammar-selection：深入读懂句子（非 enrich 分类纠错）。 */

export const GRAMMAR_EXPLAIN_SELECTION_JSON_SCHEMA = {
  name: "grammar_explain_selection",
  strict: true as const,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      translation_zh: { type: "string" },
      sentence_skeleton_zh: { type: "string" },
      clause_structure_zh: { type: "string" },
      verb_position_note_zh: { type: "string" },
      roles_zh: { type: "string" },
      key_collocations: {
        type: "array",
        items: { type: "string" },
      },
      why_difficult_zh: { type: "string" },
      learning_order_zh: { type: "string" },
      explanation_de_simple: { type: "string" },
    },
    required: [
      "translation_zh",
      "sentence_skeleton_zh",
      "clause_structure_zh",
      "verb_position_note_zh",
      "roles_zh",
      "key_collocations",
      "why_difficult_zh",
      "learning_order_zh",
      "explanation_de_simple",
    ],
  },
} as const;

export type GrammarExplainSelectionResult = {
  translation_zh: string;
  sentence_skeleton_zh: string;
  clause_structure_zh: string;
  verb_position_note_zh: string;
  roles_zh: string;
  key_collocations: string[];
  why_difficult_zh: string;
  learning_order_zh: string;
  explanation_de_simple: string;
};

export function normalizeGrammarExplainSelection(
  raw: unknown,
): GrammarExplainSelectionResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("语法解释格式无效");
  }
  const o = raw as Record<string, unknown>;
  const coll = Array.isArray(o.key_collocations)
    ? o.key_collocations.filter((x) => typeof x === "string")
    : [];
  const str = (k: string) =>
    typeof o[k] === "string" ? (o[k] as string).trim() : "";
  return {
    translation_zh: str("translation_zh"),
    sentence_skeleton_zh: str("sentence_skeleton_zh"),
    clause_structure_zh: str("clause_structure_zh"),
    verb_position_note_zh: str("verb_position_note_zh"),
    roles_zh: str("roles_zh"),
    key_collocations: coll,
    why_difficult_zh: str("why_difficult_zh"),
    learning_order_zh: str("learning_order_zh"),
    explanation_de_simple: str("explanation_de_simple"),
  };
}

/** 合并为可保存的 explanation_zh 主解释文本。 */
export function formatGrammarExplainForMainField(
  e: GrammarExplainSelectionResult,
): string {
  const parts = [
    e.translation_zh ? `【大意】\n${e.translation_zh}` : "",
    e.sentence_skeleton_zh ? `【主干】\n${e.sentence_skeleton_zh}` : "",
    e.clause_structure_zh ? `【结构】\n${e.clause_structure_zh}` : "",
    e.verb_position_note_zh ? `【动词位置】\n${e.verb_position_note_zh}` : "",
    e.roles_zh ? `【成分】\n${e.roles_zh}` : "",
    e.key_collocations.length
      ? `【搭配】\n${e.key_collocations.join("；")}`
      : "",
    e.why_difficult_zh ? `【难点】\n${e.why_difficult_zh}` : "",
    e.learning_order_zh ? `【理解顺序】\n${e.learning_order_zh}` : "",
  ].filter(Boolean);
  return parts.join("\n\n");
}
