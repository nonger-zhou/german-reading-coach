import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { collectBlockParagraphs } from "./articleBodyExtractCheerio";
import {
  isImportBodyBlockNoise,
  shouldPreferBlockParagraphs,
} from "./articleBodyExtractLogic";

describe("articleBodyExtractLogic", () => {
  it("prefers block paragraphs when p set is much shorter", () => {
    const p = [
      "Johannes Badrutt wollte den Gästen etwas Exklusives bieten.",
      "Helmut Stalder ist Historiker, Publizist und Buchautor.",
    ];
    const filler =
      "Die Gäste waren begeistert und die Presse berichtete über die Errungenschaft in der Neuen Zürcher Zeitung.";
    const blocks = [
      `Es ist der 18. Juli 1879 abends. Eine illustre Gästeschar von 100 Personen hat sich im grossen Speisesaal des Hotels Kulm in St. Moritz zum Diner eingefunden. Als die Gäste an der langen Table d'hôte Platz genommen haben, schaltet er das Licht ein. ${filler}`,
      `Johannes Badrutt war ein gewiefter Hotelier mit einer guten Nase dafür, was die zahlungskräftigen Gäste der Belle Époque wünschten. Er wurde 1819 geboren und baute die Pension zum Luxushotel Kulm Hotel St. Moritz aus und betrieb es bald auch im Winter. ${filler}`,
      `Stets auf der Suche nach den neusten technischen Errungenschaften besuchte der Hotelpionier 1878 die Weltausstellung in Paris. Die elektrische Beleuchtung machte die Nacht zum Tag und schmeichelte dem Teint der noblen Gesellschaften. ${filler}`,
    ];
    expect(shouldPreferBlockParagraphs(p, blocks)).toBe(true);
    expect(shouldPreferBlockParagraphs(blocks, p)).toBe(false);
  });

  it("filters metadata and subscribe lines from blocks", () => {
    expect(isImportBodyBlockNoise("Publiziert am: 27.01.2026")).toBe(true);
    expect(
      isImportBodyBlockNoise(
        "Wir informieren Sie alle zwei Wochen über neue Artikel.",
      ),
    ).toBe(true);
    expect(
      isImportBodyBlockNoise(
        "Es ist der 18. Juli 1879 abends. Die Gäste sahen elektrisches Licht.",
      ),
    ).toBe(false);
  });

  it("collects snm-text sections from museum-like fixture", () => {
    const html = readFileSync(
      join(__dirname, "fixtures", "nationalmuseum-like.html"),
      "utf8",
    );
    const $ = load(html);
    const blocks = collectBlockParagraphs($, "article");
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    expect(blocks.some((b) => b.includes("18. Juli 1879"))).toBe(true);
    expect(blocks.some((b) => b.includes("Weltausstellung"))).toBe(true);
    expect(blocks.join(" ")).not.toMatch(/Publiziert am:/);
    expect(blocks.join(" ")).not.toMatch(/Wir informieren Sie/);
  });
});
