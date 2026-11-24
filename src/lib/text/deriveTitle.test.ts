import { describe, expect, it } from "vitest";
import {
  DERIVED_TITLE_MAX_CHARS,
  FALLBACK_ARTICLE_TITLE,
  deriveTitle,
  resolveArticleTitle,
} from "./deriveTitle";

describe("deriveTitle", () => {
  it("uses the fallback when the body is empty", () => {
    expect(deriveTitle("")).toBe(FALLBACK_ARTICLE_TITLE);
    expect(deriveTitle(" \n\t ")).toBe(FALLBACK_ARTICLE_TITLE);
  });

  it("keeps a short first sentence, including its closing punctuation", () => {
    expect(
      deriveTitle(
        "Kurz und klar. Danach kommt noch ein sehr langer Satz mit vielen Wörtern die nicht in den Titel sollen.",
      ),
    ).toBe("Kurz und klar.");
    expect(deriveTitle("Wie geht es dir? Gut.")).toBe("Wie geht es dir?");
  });

  it("collapses newlines and takes the first sentence", () => {
    expect(deriveTitle("Hallo\nWelt.\nNoch ein Satz.")).toBe("Hallo Welt.");
  });

  it("keeps a Chinese sentence up to the full stop", () => {
    expect(deriveTitle("今天天气很好。后面还有一句。")).toBe("今天天气很好。");
  });

  it("does not split abbreviations or decimals", () => {
    expect(deriveTitle("Das ist z.B. wichtig.")).toBe("Das ist z.B. wichtig.");
    expect(deriveTitle("Pi ist 3.14 und damit bekannt.")).toBe("Pi ist 3.14 und damit bekannt.");
    expect(deriveTitle("Dr. Müller sagte nichts.")).toBe("Dr. Müller sagte nichts.");
  });

  it("uses the first 10 words when the first sentence is longer", () => {
    expect(
      deriveTitle("eins zwei drei vier fünf sechs sieben acht neun zehn elf zwölf."),
    ).toBe("eins zwei drei vier fünf sechs sieben acht neun zehn…");
  });

  it("keeps exactly 10 words when that is the whole sentence", () => {
    expect(deriveTitle("eins zwei drei vier fünf sechs sieben acht neun zehn.")).toBe(
      "eins zwei drei vier fünf sechs sieben acht neun zehn.",
    );
  });

  it("caps the result at 80 characters and adds an ellipsis", () => {
    const longWord = "A".repeat(100);
    const title = deriveTitle(longWord);
    expect(title).toHaveLength(DERIVED_TITLE_MAX_CHARS);
    expect(title.endsWith("…")).toBe(true);

    const manyLongWords = Array.from({ length: 12 }, () => "Abcdefghij").join(" ");
    const clipped = deriveTitle(manyLongWords);
    expect(clipped.length).toBeLessThanOrEqual(DERIVED_TITLE_MAX_CHARS);
    expect(clipped.endsWith("…")).toBe(true);
    expect(clipped.includes(" ")).toBe(true);
  });
});

describe("resolveArticleTitle", () => {
  it("keeps a typed title and trims it", () => {
    expect(resolveArticleTitle("  Meine Überschrift  ", "Anderer erster Satz.")).toBe(
      "Meine Überschrift",
    );
  });

  it("derives a title when the box is empty or whitespace", () => {
    expect(resolveArticleTitle("   ", "Erster Satz. Zweiter Satz.")).toBe("Erster Satz.");
    expect(resolveArticleTitle("", "")).toBe(FALLBACK_ARTICLE_TITLE);
  });
});
