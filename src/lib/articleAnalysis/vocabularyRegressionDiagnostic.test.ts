import { describe, expect, it } from "vitest";
import {
  countExpressionTypeVocabulary,
  hasExpressionTypeVocabulary,
  nonNounSurfaceFormsMissingFromArticle,
} from "./vocabularyRegressionDiagnostic";

describe("vocabularyRegressionDiagnostic", () => {
  it("flags skeleton surface_form and non-substring", () => {
    const article = "Er wies die Kritik zurück.";
    const missing = nonNounSurfaceFormsMissingFromArticle(
      [
        {
          part_of_speech: "separable_verb",
          surface_form: "wies die Kritik zurück",
        },
        {
          part_of_speech: "verb_phrase",
          surface_form: "sich distanzieren von",
        },
        {
          part_of_speech: "verb_phrase",
          surface_form: "wies … zurück",
        },
      ],
      article,
    );
    expect(missing).toContain("sich distanzieren von");
    expect(missing).toContain("wies … zurück");
    expect(missing).not.toContain("wies die Kritik zurück");
  });

  it("detects expression part_of_speech", () => {
    const items = [
      { part_of_speech: "noun" },
      { part_of_speech: "verb_phrase" },
      { part_of_speech: "separable_verb" },
    ];
    expect(hasExpressionTypeVocabulary(items)).toBe(true);
    expect(countExpressionTypeVocabulary(items)).toBe(2);
  });
});
