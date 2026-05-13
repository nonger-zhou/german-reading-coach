import { describe, expect, it } from "vitest";
import {
  rebuildUserStyleVocabOccurrencesFromArticle,
  splitEllipsisDisplayIntoTwoSurfaceParts,
  vocabOccurrenceToRanges,
} from "./articleReadingModel";
import type { ArticleVocabItem, VocabOccurrence } from "./articleReadingTypes";

describe("splitEllipsisDisplayIntoTwoSurfaceParts", () => {
  it("splits Unicode ellipsis", () => {
    expect(splitEllipsisDisplayIntoTwoSurfaceParts("knöpfte … ab")).toEqual([
      "knöpfte",
      "ab",
    ]);
  });
  it("splits three dots", () => {
    expect(splitEllipsisDisplayIntoTwoSurfaceParts("richtet...ein")).toEqual([
      "richtet",
      "ein",
    ]);
  });
});

describe("vocabOccurrenceToRanges separable + offsets", () => {
  const article =
    "Ein Text. Mit Fake-Nachrichten knöpfte eine französische Gang den Opfern Zehntausende Franken ab. Ende.";

  it("returns two ranges inside occurrence window when display_word uses ellipsis", () => {
    const start = article.indexOf("Mit Fake");
    const end = article.indexOf("ab.") + 2;
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const occ: VocabOccurrence = {
      id: "occ-1",
      surface_form: article.slice(start, end),
      sentence: article.slice(start, end),
      start_offset: start,
      end_offset: end,
      fallbackMatchText: article.slice(start, end),
      source: "user_added",
    };
    const ranges = vocabOccurrenceToRanges(occ, article, {
      displayWord: "knöpfte … ab",
    });
    expect(ranges).toHaveLength(2);
    expect(article.slice(ranges[0]!.start, ranges[0]!.end)).toBe("knöpfte");
    expect(article.slice(ranges[1]!.start, ranges[1]!.end)).toBe("ab");
  });
});

describe("rebuildUserStyleVocabOccurrencesFromArticle", () => {
  it("preserves DB-style occurrences when display_word is lemma not in text", () => {
    const article =
      "Mit Fake-Nachrichten knöpfte eine französische Gang den Opfern Zehntausende Franken ab.";
    const start = article.indexOf("Mit Fake");
    const end = article.indexOf("ab.") + 2;
    const occ: VocabOccurrence = {
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      surface_form: article.slice(start, end),
      sentence: article.slice(start, end),
      start_offset: start,
      end_offset: end,
      fallbackMatchText: article.slice(start, end),
      source: "user_added",
    };
    const item: ArticleVocabItem = {
      id: "vocab-test",
      dbItemId: "item-uuid",
      persisted: true,
      lemma: "abknöpfen",
      display_word: "abknöpfen",
      normalized_key: "abknöpfen",
      part_of_speech: "可分动词",
      grammatical_gender: "na",
      zh_meaning: "敲诈",
      simple_de_explanation: "…",
      mastery_status: "new",
      source: "user_added",
      needs_ai_enrichment: false,
      senses: [
        {
          id: "sense-1",
          zh_meaning: "敲诈",
          simple_de_explanation: "…",
        },
      ],
      occurrences: [occ],
    };
    const ctxItem: ArticleVocabItem = {
      ...item,
      display_word: "knöpfte … ab",
    };
    const outLemma = rebuildUserStyleVocabOccurrencesFromArticle(item, article);
    expect(outLemma.occurrences).toHaveLength(1);
    expect(outLemma.occurrences[0]!.id).toBe(occ.id);

    const outDual = rebuildUserStyleVocabOccurrencesFromArticle(ctxItem, article);
    expect(outDual.occurrences).toHaveLength(1);
    const rs = vocabOccurrenceToRanges(outDual.occurrences[0]!, article, {
      displayWord: outDual.display_word,
      lemma: outDual.lemma,
    });
    expect(rs).toHaveLength(2);
  });
});
