import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectArticleLanguage } from "./detectArticleLanguage";

const fixture = (name: string) => readFileSync(join(process.cwd(), "scripts/fixtures", name), "utf8");

describe("detectArticleLanguage", () => {
  it("recognises every German fixture as German", () => {
    for (const f of [
      "autodiebe-schweiz-article.txt",
      "gaullismus-article.txt",
      "meghan-article.txt",
      "msc-oil-article.txt",
      "news-short-article.txt",
    ]) {
      expect(detectArticleLanguage(fixture(f)).language, f).toBe("de");
    }
  });

  it("recognises English text as English", () => {
    expect(detectArticleLanguage(fixture("en-news-article.txt")).language).toBe("en");
  });

  it("returns null for very short or mixed text", () => {
    expect(detectArticleLanguage("Hallo").language).toBeNull();
    expect(detectArticleLanguage("").language).toBeNull();
  });
});
