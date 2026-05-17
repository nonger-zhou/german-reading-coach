import { describe, expect, it } from "vitest";
import type { CefrLevel } from "@/lib/types";
import {
  filterArticleAnalysisByArticleText,
  filterArticleAnalysisGrammarByArticleText,
  isContiguousSubstringInArticle,
} from "./filterAnalysisByArticleText";
import type { ArticleAnalysisResult } from "./types";

const level: CefrLevel = "B1";

function minimalAnalysis(
  partial: Partial<ArticleAnalysisResult>,
): ArticleAnalysisResult {
  return {
    vocabulary: [],
    grammar: [],
    summary_zh: "",
    summary_de_simple: "",
    reading_questions: [],
    ...partial,
  };
}

describe("filterAnalysisByArticleText", () => {
  const article =
    "Der Mann, der dort steht, ist mein Lehrer.";

  it("rejects grammar selected_text that omits embedded relative clause", () => {
    expect(
      isContiguousSubstringInArticle(article, "Der Mann ist mein Lehrer."),
    ).toBe(false);
    expect(isContiguousSubstringInArticle(article, "der dort steht")).toBe(
      true,
    );
    expect(isContiguousSubstringInArticle(article, article)).toBe(true);

    const { analysis, removedGrammar } = filterArticleAnalysisByArticleText(
      minimalAnalysis({
        grammar: [
          {
            grammar_type: "relativsatz",
            grammar_key: "relativsatz",
            normalized_key: "rel",
            selected_text: "der dort steht",
            name_de: "Relativsatz",
            name_zh: "关系从句",
            is_subordinate_clause: true,
            finite_verb: "steht",
            finite_verb_position: "final",
            level_estimate: level,
            explanation_zh: "",
            explanation_de_simple: "",
            example_sentence: "",
            reason_for_selection: "",
          },
          {
            grammar_type: "hauptsatz_v2",
            grammar_key: "hauptsatz_v2",
            normalized_key: "hk",
            selected_text: "Der Mann ist mein Lehrer.",
            name_de: "Hauptsatz",
            name_zh: "主句",
            is_subordinate_clause: false,
            finite_verb: "ist",
            finite_verb_position: "second",
            level_estimate: level,
            explanation_zh: "",
            explanation_de_simple: "",
            example_sentence: "",
            reason_for_selection: "",
          },
        ],
      }),
      article,
    );

    expect(removedGrammar).toEqual(["Der Mann ist mein Lehrer."]);
    expect(analysis.grammar).toHaveLength(1);
    expect(analysis.grammar[0]?.selected_text).toBe("der dort steht");
  });

  it("does not remove vocabulary when surface_form is not a substring", () => {
    const { analysis, removedVocabulary } = filterArticleAnalysisByArticleText(
      minimalAnalysis({
        vocabulary: [
          {
            surface_form: "wies … zurück",
            lemma: "zurückweisen",
            normalized_key: "zurückweisen",
            part_of_speech: "separable_verb",
            grammatical_gender: "na",
            level_estimate: level,
            zh_meaning: "",
            simple_de_explanation: "",
            example_sentence: "",
            reason_for_selection: "",
          },
        ],
      }),
      article,
    );
    expect(removedVocabulary).toEqual([]);
    expect(analysis.vocabulary).toHaveLength(1);
  });

  it("filterArticleAnalysisGrammarByArticleText only touches grammar", () => {
    const voc = {
      surface_form: "fake",
      lemma: "fake",
      normalized_key: "fake",
      part_of_speech: "verb",
      grammatical_gender: "na" as const,
      level_estimate: level,
      zh_meaning: "",
      simple_de_explanation: "",
      example_sentence: "",
      reason_for_selection: "",
    };
    const { analysis, removedGrammar } = filterArticleAnalysisGrammarByArticleText(
      minimalAnalysis({ vocabulary: [voc] }),
      article,
    );
    expect(analysis.vocabulary).toHaveLength(1);
    expect(removedGrammar).toEqual([]);
  });
});
