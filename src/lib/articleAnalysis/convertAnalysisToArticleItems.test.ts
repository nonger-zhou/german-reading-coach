import { describe, expect, it } from "vitest";
import {
  convertAnalysisResultToArticleItems,
  listRealAiEntriesWithoutTextMatch,
} from "./convertAnalysisToArticleItems";
import { articleVocabItemIsHighlightableInText } from "@/lib/articleReadingModel";
import type { ArticleAnalysisResult } from "./types";

describe("convertAnalysisResultToArticleItems", () => {
  it("keeps vocabulary when surface_form cannot be located in article", () => {
    const articlePlain = "Nur ein kurzer Satz hier.";
    const result: ArticleAnalysisResult = {
      vocabulary: [
        {
          surface_form: "diesesWortGibtEsNicht",
          lemma: "diesesWortGibtEsNicht",
          normalized_key: "dieseswortgibtesnicht",
          part_of_speech: "noun",
          grammatical_gender: "na",
          level_estimate: "B1",
          zh_meaning: "测试",
          simple_de_explanation: "Test.",
          example_sentence: "",
          reason_for_selection: "",
        },
      ],
      grammar: [],
      summary_zh: "",
      summary_de_simple: "",
      reading_questions: [],
    };
    const { vocabulary } = convertAnalysisResultToArticleItems(
      result,
      articlePlain,
      { itemSource: "ai" },
    );
    expect(vocabulary).toHaveLength(1);
    expect(vocabulary[0]!.display_word).toBe("diesesWortGibtEsNicht");
    expect(
      articleVocabItemIsHighlightableInText(vocabulary[0]!, articlePlain),
    ).toBe(false);

    const unmatched = listRealAiEntriesWithoutTextMatch(result, articlePlain);
    expect(unmatched.vocabulary).toContain("diesesWortGibtEsNicht");
  });

  it("locates a surface_form that only differs by a soft hyphen", () => {
    const articlePlain = "Im Vertrag steht die Kündigungsfrist klar.";
    const result: ArticleAnalysisResult = {
      vocabulary: [
        {
          surface_form: "Kün\u00ADdigungsfrist",
          lemma: "Kündigungsfrist",
          normalized_key: "kün\u00ADdigungsfrist",
          part_of_speech: "noun",
          grammatical_gender: "f",
          level_estimate: "B1",
          zh_meaning: "解约期限",
          simple_de_explanation: "Frist.",
          example_sentence: "",
          reason_for_selection: "",
        },
      ],
      grammar: [],
      summary_zh: "",
      summary_de_simple: "",
      reading_questions: [],
    };
    const { vocabulary } = convertAnalysisResultToArticleItems(
      result,
      articlePlain,
      { itemSource: "ai" },
    );
    expect(vocabulary[0]!.display_word).toBe("Kündigungsfrist");
    expect(vocabulary[0]!.occurrences[0]!.start_offset).toBe(
      articlePlain.indexOf("Kündigungsfrist"),
    );
    expect(vocabulary[0]!.occurrences[0]!.surface_form).toBe("Kündigungsfrist");
    expect(
      articleVocabItemIsHighlightableInText(vocabulary[0]!, articlePlain),
    ).toBe(true);
    expect(listRealAiEntriesWithoutTextMatch(result, articlePlain).vocabulary).toEqual(
      [],
    );
  });

  it("still treats an extra internal space as unmatched", () => {
    const articlePlain = "Die Laborpartnerin arbeitet.";
    const result: ArticleAnalysisResult = {
      vocabulary: [
        {
          surface_form: "Labor partnerin",
          lemma: "Laborpartnerin",
          normalized_key: "labor partnerin",
          part_of_speech: "noun",
          grammatical_gender: "f",
          level_estimate: "B1",
          zh_meaning: "同事",
          simple_de_explanation: "Kollegin.",
          example_sentence: "",
          reason_for_selection: "",
        },
      ],
      grammar: [],
      summary_zh: "",
      summary_de_simple: "",
      reading_questions: [],
    };
    const { vocabulary } = convertAnalysisResultToArticleItems(
      result,
      articlePlain,
      { itemSource: "ai" },
    );
    expect(vocabulary[0]!.occurrences[0]!.start_offset).toBeUndefined();
    expect(
      articleVocabItemIsHighlightableInText(vocabulary[0]!, articlePlain),
    ).toBe(false);
    expect(listRealAiEntriesWithoutTextMatch(result, articlePlain).vocabulary).toContain(
      "Labor partnerin",
    );
  });
});
