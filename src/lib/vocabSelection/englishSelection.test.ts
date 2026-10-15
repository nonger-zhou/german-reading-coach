import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AnalyzedVocabularyItem } from "@/lib/articleAnalysis/types";
import {
  englishLexicon,
  englishMatchKey,
  ENGLISH_LEVEL_FREQUENCY_CUTOFF,
  rankOfEnglishWord,
} from "./englishLexicon";
import { germanLexicon } from "./germanLexicon";
import { buildUserVocabProfile, type UserVocabRow } from "./userVocabProfile";
import { extractCandidateWords, findLearningWordsInArticle } from "./articleCandidates";
import {
  applyVocabularySelection,
  mergeVocabularyLists,
  planVocabularySelection,
} from "./selectVocabulary";
import { getLexicon, loadLexicon } from "./lexicons";

const ARTICLE = readFileSync(join(process.cwd(), "scripts/fixtures/en-news-article.txt"), "utf8");

function row(partial: Partial<UserVocabRow>): UserVocabRow {
  return {
    lemma: null,
    display_word: null,
    normalized_key: null,
    part_of_speech: null,
    mastery_status: "new",
    source: "manual",
    zh_meaning: null,
    simple_de_explanation: null,
    gender: null,
    level_estimate: null,
    ...partial,
  };
}

function item(partial: Partial<AnalyzedVocabularyItem>): AnalyzedVocabularyItem {
  return {
    surface_form: "",
    lemma: "",
    normalized_key: "",
    part_of_speech: "noun",
    grammatical_gender: "na",
    level_estimate: "B2",
    zh_meaning: "",
    simple_de_explanation: "",
    example_sentence: "",
    reason_for_selection: "",
    ...partial,
  };
}

describe("English frequency and word forms", () => {
  it("common words rank high, advanced words low", () => {
    expect(rankOfEnglishWord("government")!).toBeLessThan(1_000);
    expect(rankOfEnglishWord("environment")!).toBeLessThan(ENGLISH_LEVEL_FREQUENCY_CUTOFF.B1);
    expect(rankOfEnglishWord("undermine")!).toBeGreaterThan(ENGLISH_LEVEL_FREQUENCY_CUTOFF.B2);
    expect(rankOfEnglishWord("undermine")!).toBeLessThan(ENGLISH_LEVEL_FREQUENCY_CUTOFF.C1);
  });

  it("inflections, irregular forms and British spellings map to the base word", () => {
    expect(rankOfEnglishWord("undermined")).toBe(rankOfEnglishWord("undermine"));
    expect(rankOfEnglishWord("studies")).toBe(rankOfEnglishWord("study"));
    expect(rankOfEnglishWord("went")).toBe(rankOfEnglishWord("go"));
    expect(rankOfEnglishWord("crises")).toBeLessThanOrEqual(rankOfEnglishWord("crisis")!);
    expect(rankOfEnglishWord("behaviour")).toBeLessThanOrEqual(rankOfEnglishWord("behavior")!);
    expect(rankOfEnglishWord("organisation")).toBeLessThanOrEqual(rankOfEnglishWord("organization")!);
    expect(rankOfEnglishWord("government's")).toBe(rankOfEnglishWord("government"));
  });

  it("-ing / -er nouns keep their own rank (herring is not 'herr', lager is not 'lag')", () => {
    expect(rankOfEnglishWord("lager")!).toBeGreaterThan(rankOfEnglishWord("lag")!);
  });

  it("hyphenated compounds of known words count as known", () => {
    expect(rankOfEnglishWord("long-term")).toBeDefined();
    expect(rankOfEnglishWord("long-term")!).toBeLessThan(ENGLISH_LEVEL_FREQUENCY_CUTOFF.B1);
  });

  it("match key drops to / the / a and sth / sb placeholders", () => {
    expect(englishMatchKey("to carry out")).toBe("carry out");
    expect(englishMatchKey("Carry out (sth)")).toBe("carry out");
    expect(englishMatchKey("rule out sb")).toBe("rule out");
    expect(englishMatchKey("the Commons")).toBe("commons");
  });
});

describe("English vocabulary selection (same rules as German)", () => {
  it("uses English level cutoffs, not German ones", () => {
    const p = buildUserVocabProfile("B2", [], englishLexicon);
    expect(p.cutoff).toBe(ENGLISH_LEVEL_FREQUENCY_CUTOFF.B2);
    expect(p.lexicon?.language).toBe("en");
  });

  it("candidates exclude common words, include advanced ones, flag names", () => {
    const profile = buildUserVocabProfile("B2", [], englishLexicon);
    const cands = extractCandidateWords(ARTICLE, profile);
    const bySurface = new Map(cands.map((c) => [c.surface.toLowerCase(), c]));
    for (const common of ["government", "election", "pressure", "country", "economy"]) {
      expect(bySurface.has(common)).toBe(false);
    }
    for (const advanced of ["undermined", "exacerbate", "conceded"]) {
      expect(bySurface.has(advanced)).toBe(true);
    }
    expect(bySurface.get("starmer")?.maybeProperName).toBe(true);
  });

  it("a sentence-initial word that also appears in lowercase is not a proper name", () => {
    const text = "Albeit slowly, prices fell. Growth returned, albeit unevenly.";
    const cands = extractCandidateWords(text, buildUserVocabProfile("B1", [], englishLexicon));
    const albeit = cands.find((c) => c.surface.toLowerCase() === "albeit");
    expect(albeit?.maybeProperName).toBe(false);
  });

  it("mastered words (in any inflection) are not candidates", () => {
    const profile = buildUserVocabProfile(
      "B2",
      [row({ lemma: "undermine", mastery_status: "mastered" })],
      englishLexicon,
    );
    const words = extractCandidateWords(ARTICLE, profile).map((c) => c.surface.toLowerCase());
    expect(words).not.toContain("undermined");
  });

  it("learning words are found inflected, and phrasal verbs by phrase", () => {
    const learning = buildUserVocabProfile(
      "B2",
      [
        row({ lemma: "concede", mastery_status: "learning" }),
        row({ lemma: "to weather the storm", display_word: "weather the storm", mastery_status: "learning" }),
      ],
      englishLexicon,
    );
    const found = findLearningWordsInArticle(ARTICLE, learning.learningWords, englishLexicon);
    const surfaces = found.map((f) => f.surfaceInText.toLowerCase());
    expect(surfaces).toContain("conceded");
    expect(surfaces).toContain("weather the storm");
  });

  it("post-filter: drops too-common and mastered items, keeps rare ones, adds missed learning words", () => {
    const profile = buildUserVocabProfile(
      "B2",
      [
        row({ lemma: "concede", mastery_status: "learning", zh_meaning: "承认" }),
        row({ lemma: "nonetheless", mastery_status: "mastered" }),
      ],
      englishLexicon,
    );
    const plan = planVocabularySelection(ARTICLE, profile);
    expect(plan.promptAppendix).toContain("rule out");
    expect(plan.promptAppendix).not.toContain("allerdings");
    const res = applyVocabularySelection(
      [
        item({ surface_form: "exacerbate", lemma: "exacerbate" }),
        item({ surface_form: "government", lemma: "government" }),
        item({ surface_form: "Nonetheless", lemma: "nonetheless" }),
        item({ surface_form: "kicking the can down the road", lemma: "kick the can down the road" }),
      ],
      plan,
      profile,
      ARTICLE,
    );
    const lemmas = res.vocabulary.map((v) => v.lemma);
    expect(lemmas).toContain("exacerbate");
    expect(lemmas).toContain("kick the can down the road");
    expect(lemmas).toContain("concede");
    expect(res.droppedTooCommon).toContain("government");
    expect(res.droppedKnown).toContain("nonetheless");
    expect(res.addedLearning).toContain("concede");
  });

  it("merging chunks dedupes by English match key", () => {
    const merged = mergeVocabularyLists(
      [[item({ lemma: "to rule out", surface_form: "ruled out" })], [item({ lemma: "rule out", surface_form: "rule out" })]],
      englishLexicon,
    );
    expect(merged).toHaveLength(1);
  });
});

describe("lexicon registry", () => {
  it("German is available synchronously and is the default; English loads on demand", async () => {
    expect(getLexicon("de")).toBe(germanLexicon);
    expect(await loadLexicon("de")).toBe(germanLexicon);
    expect(await loadLexicon("en")).toBe(englishLexicon);
  });
});
