import { describe, expect, it } from "vitest";
import { shouldRetryAnalysisForAllNounVocabulary } from "./vocabularyAllNounRetry";
import type { ArticleAnalysisResult } from "./types";

function analysisWithPos(
  poses: string[],
): ArticleAnalysisResult {
  return {
    vocabulary: poses.map((part_of_speech, i) => ({
      surface_form: `w${i}`,
      lemma: `w${i}`,
      normalized_key: `w${i}`,
      part_of_speech,
      grammatical_gender: part_of_speech.includes("noun") ? "m" : "na",
      level_estimate: "B1",
      zh_meaning: "",
      simple_de_explanation: "",
      example_sentence: "",
      reason_for_selection: "",
    })),
    grammar: [],
    summary_zh: "",
    summary_de_simple: "",
    reading_questions: [],
  };
}

describe("shouldRetryAnalysisForAllNounVocabulary", () => {
  it("returns true for long text and all-noun vocabulary", () => {
    expect(
      shouldRetryAnalysisForAllNounVocabulary(
        analysisWithPos(["noun", "compound_noun", "noun", "noun"]),
        3000,
      ),
    ).toBe(true);
  });

  it("returns false when at least two non-noun items", () => {
    expect(
      shouldRetryAnalysisForAllNounVocabulary(
        analysisWithPos(["noun", "verb", "collocation"]),
        3000,
      ),
    ).toBe(false);
  });

  it("returns true when many nouns and only one non-noun", () => {
    expect(
      shouldRetryAnalysisForAllNounVocabulary(
        analysisWithPos([
          "noun",
          "noun",
          "noun",
          "noun",
          "noun",
          "separable_verb",
        ]),
        3000,
      ),
    ).toBe(true);
  });

  it("returns false for short text", () => {
    expect(
      shouldRetryAnalysisForAllNounVocabulary(
        analysisWithPos(["noun", "noun"]),
        1000,
      ),
    ).toBe(false);
  });
});
