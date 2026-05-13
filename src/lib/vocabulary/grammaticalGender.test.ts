import { describe, expect, it } from "vitest";
import {
  displayGrammaticalGenderLabelZh,
  grammaticalGenderLabelZh,
  inferGrammaticalGenderFromLemmaArticle,
  isNounLikePartOfSpeech,
  lemmaStartsWithGermanArticle,
  parseGrammaticalGender,
  shouldShowGrammaticalGenderRow,
  shouldShowGrammaticalGenderSubtitle,
  stripLeadingDefiniteArticle,
  vocabHeadwordShowsLeadingDefiniteArticle,
  vocabularyHeadwordDe,
} from "./grammaticalGender";

describe("parseGrammaticalGender", () => {
  it("defaults invalid to na", () => {
    expect(parseGrammaticalGender(undefined)).toBe("na");
    expect(parseGrammaticalGender("x")).toBe("na");
  });
  it("accepts enum", () => {
    expect(parseGrammaticalGender("f")).toBe("f");
  });
});

describe("grammaticalGenderLabelZh", () => {
  it("maps m/f/n", () => {
    expect(grammaticalGenderLabelZh("m")).toContain("der");
    expect(grammaticalGenderLabelZh("f")).toContain("die");
    expect(grammaticalGenderLabelZh("n")).toContain("das");
  });
});

describe("isNounLikePartOfSpeech", () => {
  it("detects Chinese 名词 label", () => {
    expect(isNounLikePartOfSpeech("名词 (复数)")).toBe(true);
  });
  it("rejects verb", () => {
    expect(isNounLikePartOfSpeech("verb")).toBe(false);
  });
  it("rejects empty or dash placeholder", () => {
    expect(isNounLikePartOfSpeech("—")).toBe(false);
    expect(isNounLikePartOfSpeech("")).toBe(false);
  });
  it("detects substantiv / subst.", () => {
    expect(isNounLikePartOfSpeech("Substantiv")).toBe(true);
    expect(isNounLikePartOfSpeech("subst.")).toBe(true);
  });
});

describe("lemmaStartsWithGermanArticle / infer", () => {
  it("detects der/die/das prefix", () => {
    expect(lemmaStartsWithGermanArticle("  der Krieg")).toBe(true);
    expect(lemmaStartsWithGermanArticle("Handelskrieg")).toBe(false);
  });
  it("infers m/f/n from lemma", () => {
    expect(inferGrammaticalGenderFromLemmaArticle("die Wahl")).toBe("f");
    expect(inferGrammaticalGenderFromLemmaArticle("das Mandat")).toBe("n");
    expect(inferGrammaticalGenderFromLemmaArticle("der Zoll")).toBe("m");
  });
});

describe("shouldShowGrammaticalGenderRow", () => {
  it("shows when stored gender is set even if POS is phrase", () => {
    expect(
      shouldShowGrammaticalGenderRow("phrase", "x", "m"),
    ).toBe(true);
  });
  it("shows when lemma has article even if POS is phrase and gender na", () => {
    expect(
      shouldShowGrammaticalGenderRow("phrase", "der Handelskrieg", "na"),
    ).toBe(true);
  });
  it("hides when phrase, na, no article in lemma", () => {
    expect(
      shouldShowGrammaticalGenderRow("phrase", "Handelskrieg", "na"),
    ).toBe(false);
  });
});

describe("displayGrammaticalGenderLabelZh", () => {
  it("uses lemma when stored is na", () => {
    expect(displayGrammaticalGenderLabelZh("die Wahl", "na")).toContain("die");
  });
});

describe("shouldShowGrammaticalGenderSubtitle", () => {
  it("hides when headword already has definite article (gender-derived)", () => {
    expect(
      shouldShowGrammaticalGenderSubtitle(
        "noun",
        "Fehlinvestition",
        "f",
        "Fehlinvestition",
      ),
    ).toBe(false);
  });
  it("hides when lemma already has der/die/das", () => {
    expect(
      shouldShowGrammaticalGenderSubtitle(
        "phrase",
        "der Handelskrieg",
        "na",
        "Handelskrieg",
      ),
    ).toBe(false);
  });
  it("shows unclear when title has no definite article", () => {
    expect(
      shouldShowGrammaticalGenderSubtitle(
        "noun",
        "Fehlinvestition",
        "unclear",
        "Fehlinvestition",
      ),
    ).toBe(true);
  });
  it("hides when display_word already carries der/die/das even if stored gender is na", () => {
    expect(
      shouldShowGrammaticalGenderSubtitle(
        "noun",
        "Herzklinik",
        "na",
        "die Herzklinik",
      ),
    ).toBe(false);
  });
});

describe("vocabHeadwordShowsLeadingDefiniteArticle", () => {
  it("is true when gender prefixes article onto lemma", () => {
    expect(
      vocabHeadwordShowsLeadingDefiniteArticle(
        "Fehlinvestition",
        "Fehlinvestition",
        "f",
      ),
    ).toBe(true);
  });
  it("is true when display_word already has definite article", () => {
    expect(
      vocabHeadwordShowsLeadingDefiniteArticle(
        "die Herzklinik",
        "Herzklinik",
        "f",
      ),
    ).toBe(true);
  });
  it("is false for indefinite lemma", () => {
    expect(
      vocabHeadwordShowsLeadingDefiniteArticle("Mandat", "ein Mandat", "n"),
    ).toBe(false);
  });
});

describe("vocabularyHeadwordDe", () => {
  it("prefixes article from gender when lemma lacks article", () => {
    expect(
      vocabularyHeadwordDe("Gymiprüfung", "Gymiprüfung", "f"),
    ).toBe("die Gymiprüfung");
  });
  it("returns lemma unchanged when it already has article", () => {
    expect(vocabularyHeadwordDe("x", "das Mandat", "n")).toBe("das Mandat");
  });
  it("does not prefix indefinite lemma", () => {
    expect(vocabularyHeadwordDe("x", "ein Mandat", "n")).toBe("ein Mandat");
  });
  it("uses surface when lemma empty", () => {
    expect(vocabularyHeadwordDe("Zoll", "", "m")).toBe("der Zoll");
  });
});

describe("stripLeadingDefiniteArticle", () => {
  it("strips der/die/das", () => {
    expect(stripLeadingDefiniteArticle("  die Wahl")).toBe("Wahl");
  });
});
