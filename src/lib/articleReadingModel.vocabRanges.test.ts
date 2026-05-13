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

  it("keeps original occurrences when nothing in text can be relocated (avoid empty sidebar)", () => {
    const article = "hello world";
    const occ: VocabOccurrence = {
      id: "occ-stale",
      surface_form: "nope",
      sentence: "short",
      start_offset: 0,
      end_offset: 2,
      fallbackMatchText: "",
      source: "user_added",
    };
    const item: ArticleVocabItem = {
      id: "vocab-stale",
      dbItemId: "db-1",
      persisted: true,
      lemma: "x",
      display_word: "not-in-article",
      normalized_key: "x",
      part_of_speech: "名词",
      grammatical_gender: "na",
      zh_meaning: "",
      simple_de_explanation: "",
      mastery_status: "new",
      source: "user_added",
      needs_ai_enrichment: false,
      senses: [{ id: "s1", zh_meaning: "", simple_de_explanation: "" }],
      occurrences: [occ],
    };
    const out = rebuildUserStyleVocabOccurrencesFromArticle(item, article);
    expect(out.occurrences).toHaveLength(1);
    expect(out.occurrences[0]!.id).toBe(occ.id);
  });
});

describe("vocabOccurrenceToRanges sentence window + stale offset", () => {
  it("finds fallback needle inside stored sentence when offsets and surface are wrong", () => {
    const article =
      "Einleitung. Mit Fake-Nachrichten knöpfte eine französische Gang den Opfern Geld ab.";
    const sentence =
      "Mit Fake-Nachrichten knöpfte eine französische Gang den Opfern Geld ab.";
    const occ: VocabOccurrence = {
      id: "occ-sw",
      surface_form: "___NOT_IN_TEXT___",
      sentence,
      start_offset: 1,
      end_offset: 3,
      fallbackMatchText: "knöpfte",
      source: "user_added",
    };
    const ranges = vocabOccurrenceToRanges(occ, article, {
      displayWord: "knöpfte … ab",
      lemma: "abknöpfen",
    });
    expect(ranges).toHaveLength(1);
    expect(article.slice(ranges[0]!.start, ranges[0]!.end)).toBe("knöpfte");
  });

  it("uses sentence window to disambiguate when fallback needle appears twice in article", () => {
    const article =
      "Zuerst knöpfte man leicht. Mit Fake-Nachrichten knöpfte eine Gang ab.";
    const sentence = "Mit Fake-Nachrichten knöpfte eine Gang ab.";
    const occ: VocabOccurrence = {
      id: "occ-2x",
      surface_form: "___BAD___",
      sentence,
      start_offset: 0,
      end_offset: 2,
      fallbackMatchText: "knöpfte",
      source: "user_added",
    };
    const ranges = vocabOccurrenceToRanges(occ, article, {});
    expect(ranges).toHaveLength(1);
    expect(article.slice(ranges[0]!.start, ranges[0]!.end)).toBe("knöpfte");
    expect(ranges[0]!.start).toBeGreaterThan(article.indexOf("Mit Fake"));
  });

  it("relocates surface with hint 0 when stored start_offset is far off", () => {
    const article = "aaa foo bar baz";
    const occ: VocabOccurrence = {
      id: "occ-hint",
      surface_form: "foo",
      sentence: "aaa foo bar baz",
      start_offset: 500,
      end_offset: 503,
      fallbackMatchText: "foo",
      source: "user_added",
    };
    const ranges = vocabOccurrenceToRanges(occ, article, {});
    expect(ranges).toHaveLength(1);
    expect(article.slice(ranges[0]!.start, ranges[0]!.end)).toBe("foo");
  });
});
