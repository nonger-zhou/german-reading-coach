import { describe, expect, it } from "vitest";
import {
  analysisVocabItemIsBlocked,
  buildVocabLibraryBlockedKeySet,
  filterArticleAnalysisVocabularyByBlockedSet,
  normalizeVocabLibraryFilterKey,
  vocabLibraryBlockKey,
} from "./filterVocabularyByUserLibrary";
import type { AnalyzedVocabularyItem } from "./types";

function sampleVocab(
  partial: Partial<AnalyzedVocabularyItem>,
): AnalyzedVocabularyItem {
  return {
    surface_form: "x",
    lemma: "x",
    normalized_key: "x",
    part_of_speech: "noun",
    grammatical_gender: "na",
    level_estimate: "B1",
    zh_meaning: "",
    simple_de_explanation: "",
    example_sentence: "",
    reason_for_selection: "",
    ...partial,
  };
}

describe("filterVocabularyByUserLibrary", () => {
  it("normalizes keys with de-DE casing", () => {
    expect(normalizeVocabLibraryFilterKey("  STRAßE  ")).toBe("straße");
  });

  it("blocks exact normalized_key + part_of_speech match", () => {
    const blocked = buildVocabLibraryBlockedKeySet([
      { normalized_key: "mandat", part_of_speech: "noun" },
    ]);
    expect(
      analysisVocabItemIsBlocked(
        sampleVocab({
          normalized_key: "Mandat",
          part_of_speech: "noun",
          lemma: "das Mandat",
        }),
        blocked,
      ),
    ).toBe(true);
    expect(
      analysisVocabItemIsBlocked(
        sampleVocab({
          normalized_key: "mandat",
          part_of_speech: "verb",
          lemma: "mandatieren",
        }),
        blocked,
      ),
    ).toBe(false);
  });

  it("falls back to lemma when normalized_key empty", () => {
    const blocked = buildVocabLibraryBlockedKeySet([
      { normalized_key: "einrichten", part_of_speech: "verb" },
    ]);
    expect(
      analysisVocabItemIsBlocked(
        sampleVocab({
          normalized_key: "",
          lemma: "einrichten",
          part_of_speech: "verb",
        }),
        blocked,
      ),
    ).toBe(true);
  });

  it("filterArticleAnalysisVocabularyByBlockedSet counts removals", () => {
    const blocked = new Set([
      vocabLibraryBlockKey("foo", "noun"),
      vocabLibraryBlockKey("bar", "phrase"),
    ]);
    const { vocabulary, removedCount } =
      filterArticleAnalysisVocabularyByBlockedSet(
        [
          sampleVocab({ normalized_key: "foo", part_of_speech: "noun" }),
          sampleVocab({ normalized_key: "baz", part_of_speech: "noun" }),
          sampleVocab({ normalized_key: "bar", part_of_speech: "phrase" }),
        ],
        blocked,
      );
    expect(removedCount).toBe(2);
    expect(vocabulary).toHaveLength(1);
    expect(vocabulary[0]?.normalized_key).toBe("baz");
  });
});
