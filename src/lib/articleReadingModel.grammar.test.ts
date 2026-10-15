import { describe, expect, it } from "vitest";
import {
  articleGrammarItemIsHighlightableInText,
  buildRunsFromReadingItems,
  dedupeGrammarItemsBySurfaceKey,
  finalizeArticleGrammarItems,
  grammarOccurrenceToRanges,
  grammarOccurrencePromptSentence,
  normalizeGrammarSurfaceKey,
  rebuildUserStyleGrammarOccurrencesFromArticle,
  extendGrammarClauseEndInPlain,
} from "./articleReadingModel";
import type { ArticleGrammarItem } from "./articleReadingTypes";

const PLAIN =
  "Lindsey Halls Freund fragte ChatGPT, ob er noch verliebt sein müsse. Sie trennte sich.";

describe("normalizeGrammarSurfaceKey", () => {
  it("ignores trailing period for dedup", () => {
    expect(normalizeGrammarSurfaceKey("ob er noch verliebt sein müsse.")).toBe(
      normalizeGrammarSurfaceKey("ob er noch verliebt sein müsse"),
    );
  });
});

describe("grammarOccurrencePromptSentence", () => {
  it("returns full sentence including main clause before comma", () => {
    const idx = PLAIN.indexOf("ob er noch");
    expect(idx).toBeGreaterThan(-1);
    const end = PLAIN.indexOf("müsse.") + "müsse.".length;
    const sentence = grammarOccurrencePromptSentence(PLAIN, {
      start_offset: idx,
      end_offset: end,
      surface_form: PLAIN.slice(idx, end),
    });
    expect(sentence).toContain("fragte ChatGPT");
    expect(sentence).toContain("ob er noch verliebt sein müsse");
  });
});

describe("rebuildUserStyleGrammarOccurrencesFromArticle", () => {
  it("assigns offsets so grammar can highlight in plain text", () => {
    const item: ArticleGrammarItem = {
      id: "g-test",
      dbItemId: null,
      grammar_key: "ob er noch verliebt sein müsse.",
      name_de: "ob er noch verliebt sein müsse.",
      name_zh: "用户标记的语法问题",
      explanation_zh: "待 AI 补充",
      mastery_status: "new",
      source: "user_added",
      normalized_key: "ob er noch verliebt sein müsse.",
      occurrences: [
        {
          id: "occ-1",
          surface_form: "ob er noch verliebt sein müsse.",
          sentence: "是否他还爱着",
          fallbackMatchText: "ob er noch verliebt sein müsse.",
          source: "user_added",
        },
      ],
    };
    const rebuilt = rebuildUserStyleGrammarOccurrencesFromArticle(item, PLAIN);
    expect(rebuilt.occurrences[0]?.start_offset).toBeGreaterThanOrEqual(0);
    expect(rebuilt.occurrences[0]?.sentence).toContain("fragte ChatGPT");
  });
});

describe("extendGrammarClauseEndInPlain", () => {
  it("extends end through newline to müsste when selection ends at sein", () => {
    const plain =
      "fragte ChatGPT, ob er noch verliebt sein\nmüsste. Sie trennte sich.";
    const start = plain.indexOf("ob er noch");
    const end = plain.indexOf("sein") + "sein".length;
    const extended = extendGrammarClauseEndInPlain(plain, start, end);
    expect(extended).toBeGreaterThan(end);
    expect(plain.slice(start, extended!)).toMatch(/sein\s+m[uü]sste/iu);
  });
});

describe("grammar highlight when saved text differs from article", () => {
  const PLAIN_MUSSTE =
    "Lindsey Halls Freund fragte ChatGPT, ob er noch verliebt sein müsste. Sie trennte sich.";

  it("finds range when user saved müsse but article has müsste", () => {
    const item: ArticleGrammarItem = {
      id: "g-muss",
      dbItemId: null,
      grammar_key: "ob er noch verliebt sein müsse",
      name_de: "ob er noch verliebt sein müsse",
      name_zh: "用户标记的语法问题",
      explanation_zh: "待 AI 补充",
      mastery_status: "new",
      source: "user_added",
      normalized_key: "ob er noch verliebt sein müsse",
      occurrences: [
        {
          id: "occ-muss",
          surface_form: "ob er noch verliebt sein müsse",
          sentence: "是否他还爱着",
          fallbackMatchText: "ob er noch verliebt sein müsse",
          source: "user_added",
        },
      ],
    };
    const finalized = finalizeArticleGrammarItems([item], PLAIN_MUSSTE)[0]!;
    expect(articleGrammarItemIsHighlightableInText(finalized, PLAIN_MUSSTE)).toBe(
      true,
    );
    const ranges = grammarOccurrenceToRanges(
      finalized.occurrences[0]!,
      PLAIN_MUSSTE,
    );
    expect(ranges.length).toBeGreaterThan(0);
    expect(PLAIN_MUSSTE.slice(ranges[0]!.start, ranges[0]!.end)).toContain(
      "ob er noch verliebt sein",
    );
    const runs = buildRunsFromReadingItems(PLAIN_MUSSTE, [], [finalized]);
    expect(runs.some((r) => r.meta?.kind === "user_grammar")).toBe(true);
  });
});

describe("dedupeGrammarItemsBySurfaceKey", () => {
  it("merges items that differ only by trailing punctuation", () => {
    const mk = (nk: string): ArticleGrammarItem => ({
      id: `g-${nk}`,
      dbItemId: null,
      grammar_key: nk,
      name_de: nk,
      name_zh: "用户标记的语法问题",
      explanation_zh: "待 AI 补充",
      mastery_status: "new",
      source: "user_added",
      normalized_key: nk,
      occurrences: [
        {
          id: `occ-${nk}`,
          surface_form: nk,
          sentence: nk,
          fallbackMatchText: nk,
          source: "user_added",
          start_offset: PLAIN.indexOf("ob er noch"),
          end_offset: PLAIN.indexOf("müsse.") + 6,
        },
      ],
    });
    const merged = dedupeGrammarItemsBySurfaceKey([
      mk("ob er noch verliebt sein müsse"),
      mk("ob er noch verliebt sein müsse."),
    ]);
    expect(merged).toHaveLength(1);
  });
});
