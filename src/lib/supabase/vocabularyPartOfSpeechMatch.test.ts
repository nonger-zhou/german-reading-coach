import { describe, expect, it } from "vitest";
import { sameVocabPartOfSpeechForUnique } from "./vocabularyItemUniqueKey";

describe("sameVocabPartOfSpeechForUnique", () => {
  it("treats null DB value as empty string", () => {
    expect(sameVocabPartOfSpeechForUnique(null, "")).toBe(true);
    expect(sameVocabPartOfSpeechForUnique(undefined, "")).toBe(true);
  });
  it("matches explicit part_of_speech", () => {
    expect(sameVocabPartOfSpeechForUnique("verb", "verb")).toBe(true);
    expect(sameVocabPartOfSpeechForUnique("verb", "noun")).toBe(false);
  });
});
