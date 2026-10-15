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
});
