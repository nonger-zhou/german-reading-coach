import { describe, expect, it } from "vitest";
import {
  analysisGrammarItemIsBlocked,
  buildGrammarLibraryBlockedKeySet,
  filterArticleAnalysisGrammarByBlockedSet,
  grammarLibraryBlockKey,
} from "./filterGrammarByUserLibrary";
import type { AnalyzedGrammarItem } from "./types";
import type { CefrLevel } from "@/lib/types";

function sampleGrammar(
  partial: Partial<AnalyzedGrammarItem>,
): AnalyzedGrammarItem {
  const level: CefrLevel = "B1";
  return {
    grammar_type: "other",
    grammar_key: "x",
    normalized_key: "x",
    selected_text: "x",
    name_de: "x",
    name_zh: "x",
    is_subordinate_clause: false,
    finite_verb: "",
    finite_verb_position: "unknown",
    level_estimate: level,
    explanation_zh: "",
    explanation_de_simple: "",
    example_sentence: "",
    reason_for_selection: "",
    ...partial,
  };
}

describe("filterGrammarByUserLibrary", () => {
  it("blocks exact grammar_key + normalized_key match", () => {
    const blocked = buildGrammarLibraryBlockedKeySet([
      { grammar_key: "konjunktiv_i", normalized_key: "indirekte_rede" },
    ]);
    expect(
      analysisGrammarItemIsBlocked(
        sampleGrammar({
          grammar_key: "Konjunktiv_I",
          normalized_key: "Indirekte_Rede",
          selected_text: "sagte",
        }),
        blocked,
      ),
    ).toBe(true);
    expect(
      analysisGrammarItemIsBlocked(
        sampleGrammar({
          grammar_key: "konjunktiv_i",
          normalized_key: "anders",
          selected_text: "foo",
        }),
        blocked,
      ),
    ).toBe(false);
  });

  it("filterArticleAnalysisGrammarByBlockedSet counts removals", () => {
    const blocked = new Set([
      grammarLibraryBlockKey("a", "b"),
      grammarLibraryBlockKey("c", "d"),
    ]);
    const { grammar, removedCount } = filterArticleAnalysisGrammarByBlockedSet(
      [
        sampleGrammar({ grammar_key: "a", normalized_key: "b" }),
        sampleGrammar({ grammar_key: "x", normalized_key: "y" }),
        sampleGrammar({ grammar_key: "c", normalized_key: "d" }),
      ],
      blocked,
    );
    expect(removedCount).toBe(2);
    expect(grammar).toHaveLength(1);
    expect(grammar[0]?.grammar_key).toBe("x");
  });
});
