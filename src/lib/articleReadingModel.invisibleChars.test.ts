import { describe, expect, it } from "vitest";
import {
  articleVocabItemIsHighlightableInText,
  finalizeArticleVocabularyItems,
  findBestTextOccurrence,
  relocateAiVocabOccurrencesMissingOffsets,
  sanitizeArticlePlainForMatching,
  stripInvisibleMatchChars,
} from "./articleReadingModel";
import type { ArticleVocabItem, VocabOccurrence } from "./articleReadingTypes";

function aiItem(opts: {
  id?: string;
  source?: ArticleVocabItem["source"];
  display: string;
  occurrences: VocabOccurrence[];
}): ArticleVocabItem {
  return {
    id: opts.id ?? "vocab-ai",
    dbItemId: "db-item",
    persisted: true,
    lemma: opts.display,
    display_word: opts.display,
    normalized_key: opts.display.toLowerCase(),
    part_of_speech: "名词",
    grammatical_gender: "f",
    zh_meaning: "释义",
    simple_de_explanation: "Erklärung.",
    mastery_status: "new",
    source: opts.source ?? "ai",
    needs_ai_enrichment: false,
    senses: [
      { id: "sense-1", zh_meaning: "释义", simple_de_explanation: "Erklärung." },
    ],
    occurrences: opts.occurrences,
  };
}

function occ(partial: Partial<VocabOccurrence> & { id: string; surface: string }): VocabOccurrence {
  return {
    id: partial.id,
    surface_form: partial.surface,
    sentence: partial.sentence ?? "（未定位）",
    start_offset: partial.start_offset,
    end_offset: partial.end_offset,
    fallbackMatchText: partial.fallbackMatchText ?? partial.surface,
    source: partial.source ?? "ai_detected",
  };
}

describe("stripInvisibleMatchChars", () => {
  it("removes soft hyphens and BOM and leaves spaces and ordinary hyphens", () => {
    expect(stripInvisibleMatchChars("Kün\u00ADdigungsfrist")).toBe("Kündigungsfrist");
    expect(stripInvisibleMatchChars("\uFEFFHallo")).toBe("Hallo");
    expect(stripInvisibleMatchChars("a\u00ADb\uFEFFc")).toBe("abc");
    expect(sanitizeArticlePlainForMatching("a\u00ADb\uFEFF")).toBe("ab");
    expect(stripInvisibleMatchChars("Labor partnerin")).toBe("Labor partnerin");
    expect(stripInvisibleMatchChars("Labor  partnerin")).toBe("Labor  partnerin");
    expect(stripInvisibleMatchChars("wohl-\u00ADbekannt")).toBe("wohl-bekannt");
    expect(stripInvisibleMatchChars("a\u00A0b")).toBe("a\u00A0b");
  });
});

describe("findBestTextOccurrence — soft hyphen", () => {
  it("finds a needle that only differs by a soft hyphen in cleaned text", () => {
    const text = "Im Vertrag steht die Kündigungsfrist klar.";
    const hit = findBestTextOccurrence(text, "Kün\u00ADdigungsfrist", 0);
    expect(hit).not.toBeNull();
    expect(text.slice(hit!.start, hit!.end)).toBe("Kündigungsfrist");
  });

  it("still matches when both the article and the needle keep the soft hyphen", () => {
    const text = "Die Kün\u00ADdigungsfrist gilt.";
    const hit = findBestTextOccurrence(text, "Kün\u00ADdigungsfrist", 0);
    expect(hit).not.toBeNull();
    expect(text.slice(hit!.start, hit!.end)).toBe("Kün\u00ADdigungsfrist");
  });

  it("does not treat extra spaces as the same word", () => {
    expect(
      findBestTextOccurrence("Die Laborpartnerin arbeitet.", "Labor partnerin", 0),
    ).toBeNull();
    expect(
      findBestTextOccurrence("Die Labor  partnerin arbeitet.", "Labor partnerin", 0),
    ).toBeNull();
  });
});

describe("relocateAiVocabOccurrencesMissingOffsets", () => {
  it("fills a missing offset from a soft-hyphen surface and is idempotent", () => {
    const article = "Im Vertrag steht die Kündigungsfrist klar.";
    const item = aiItem({
      display: "Kün\u00ADdigungsfrist",
      occurrences: [occ({ id: "11111111-1111-4111-8111-111111111111", surface: "Kün\u00ADdigungsfrist" })],
    });
    const first = relocateAiVocabOccurrencesMissingOffsets([item], article);
    const start = article.indexOf("Kündigungsfrist");
    expect(first.fills).toEqual([
      expect.objectContaining({
        occurrenceId: "11111111-1111-4111-8111-111111111111",
        start_offset: start,
        end_offset: start + "Kündigungsfrist".length,
        surface_form: "Kündigungsfrist",
      }),
    ]);
    expect(first.items[0]!.occurrences[0]!.surface_form).toBe("Kündigungsfrist");
    expect(first.items[0]!.display_word).toBe("Kündigungsfrist");
    expect(articleVocabItemIsHighlightableInText(first.items[0]!, article)).toBe(true);

    const again = relocateAiVocabOccurrencesMissingOffsets(first.items, article);
    expect(again.fills).toHaveLength(0);
    expect(again.items[0]!.occurrences[0]!.start_offset).toBe(start);
    expect(again.items[0]!.occurrences[0]!.end_offset).toBe(start + "Kündigungsfrist".length);
  });

  it("does not overwrite an existing offset", () => {
    const article = "Der Begriff steht. Noch ein Begriff folgt.";
    const second = article.lastIndexOf("Begriff");
    const item = aiItem({
      display: "Be\u00ADgriff",
      occurrences: [
        occ({
          id: "occ-kept",
          surface: "Be\u00ADgriff",
          start_offset: second,
          end_offset: second + "Begriff".length,
        }),
      ],
    });
    const { fills, items } = relocateAiVocabOccurrencesMissingOffsets([item], article);
    expect(fills).toHaveLength(0);
    expect(items[0]!.occurrences[0]!.start_offset).toBe(second);
    expect(items[0]!.occurrences[0]!.end_offset).toBe(second + "Begriff".length);
  });

  it("leaves user-added items and extra-space surfaces untouched", () => {
    const article = "Die Laborpartnerin arbeitet heute.";
    const user = aiItem({
      source: "user_added",
      display: "Labor\u00ADpartnerin",
      occurrences: [occ({ id: "user-occ", surface: "Labor\u00ADpartnerin" })],
    });
    const spaced = aiItem({
      id: "vocab-space",
      display: "Labor partnerin",
      occurrences: [occ({ id: "space-occ", surface: "Labor partnerin" })],
    });
    const { fills, items } = relocateAiVocabOccurrencesMissingOffsets(
      [user, spaced],
      article,
    );
    expect(fills).toHaveLength(0);
    expect(items[0]).toBe(user);
    expect(items[1]!.occurrences[0]!.start_offset).toBeUndefined();
    expect(articleVocabItemIsHighlightableInText(items[1]!, article)).toBe(false);
  });

  it("assigns distinct ranges when the same AI word is missing twice", () => {
    const article = "Begriff hier. Begriff dort.";
    const item = aiItem({
      display: "Be\u00ADgriff",
      occurrences: [
        occ({ id: "a", surface: "Be\u00ADgriff" }),
        occ({ id: "b", surface: "Be\u00ADgriff" }),
      ],
    });
    const { fills, items } = relocateAiVocabOccurrencesMissingOffsets([item], article);
    expect(fills.map((fill) => fill.start_offset)).toEqual([
      article.indexOf("Begriff"),
      article.lastIndexOf("Begriff"),
    ]);
    expect(items[0]!.occurrences[0]!.start_offset).not.toBe(
      items[0]!.occurrences[1]!.start_offset,
    );
  });

  it("matches a lowercase soft-hyphen surface to the capitalized article form", () => {
    const article = "Die Regierung plant etwas.";
    const item = aiItem({
      source: "ai_mock",
      display: "re\u00ADgierung",
      occurrences: [occ({ id: "gov", surface: "re\u00ADgierung" })],
    });
    const { fills } = relocateAiVocabOccurrencesMissingOffsets([item], article);
    expect(fills[0]!.surface_form).toBe("Regierung");
    expect(article.slice(fills[0]!.start_offset, fills[0]!.end_offset)).toBe("Regierung");
  });
});

describe("finalizeArticleVocabularyItems — soft hyphen", () => {
  it("keeps a single occurrence when the word appears once", () => {
    const article = "Im Vertrag steht die Kündigungsfrist klar.";
    const item = aiItem({
      display: "Kün\u00ADdigungsfrist",
      occurrences: [occ({ id: "db-occ", surface: "Kün\u00ADdigungsfrist" })],
    });
    const [out] = finalizeArticleVocabularyItems([item], article);
    expect(out!.occurrences).toHaveLength(1);
    expect(out!.occurrences[0]!.id).toBe("db-occ");
    expect(out!.occurrences[0]!.start_offset).toBe(article.indexOf("Kündigungsfrist"));
    expect(articleVocabItemIsHighlightableInText(out!, article)).toBe(true);
  });

  it("adds the other exact repeats after the stored occurrence is located", () => {
    const article = "Begriff hier. Begriff dort.";
    const item = aiItem({
      display: "Be\u00ADgriff",
      occurrences: [occ({ id: "db-occ", surface: "Be\u00ADgriff" })],
    });
    const [out] = finalizeArticleVocabularyItems([item], article);
    expect(out!.occurrences.map((row) => row.id)).toContain("db-occ");
    expect(out!.occurrences).toHaveLength(2);
    expect(out!.occurrences.every((row) => typeof row.start_offset === "number")).toBe(true);
    const starts = out!.occurrences.map((row) => row.start_offset).sort((a, b) => a! - b!);
    expect(starts).toEqual([article.indexOf("Begriff"), article.lastIndexOf("Begriff")]);
  });
});
