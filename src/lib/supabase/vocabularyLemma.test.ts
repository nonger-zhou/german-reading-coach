import { describe, expect, it } from "vitest";
import { mergeLemmaForVocabularyPersist } from "./vocabularyLemmaMerge";

describe("mergeLemmaForVocabularyPersist", () => {
  it("prefers incoming article form when DB lemma was wrongly equal to display", () => {
    expect(
      mergeLemmaForVocabularyPersist("Mandat", "das Mandat", "Mandat"),
    ).toBe("das Mandat");
  });

  it("keeps longer correct lemma when incoming lacks article", () => {
    expect(mergeLemmaForVocabularyPersist("das Mandat", "Mandat", "Mandat")).toBe(
      "das Mandat",
    );
  });

  it("uses incoming when existing empty", () => {
    expect(mergeLemmaForVocabularyPersist(null, "das Mandat", "Mandat")).toBe(
      "das Mandat",
    );
  });
});
