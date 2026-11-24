import { describe, expect, it } from "vitest";
import {
  IMAGE_IMPORT_JSON_SCHEMA,
  IMAGE_IMPORT_SYSTEM_PROMPT,
  MAX_IMPORT_TILES,
  normalizeTranscript,
  parseImageImportResult,
  planVerticalTiles,
  validateImportImages,
} from "./imageImport";

const tiny = "data:image/jpeg;base64,AAAA";

describe("imageImport", () => {
  it("validates image list", () => {
    expect(validateImportImages([])).not.toBeNull();
    expect(validateImportImages("x")).not.toBeNull();
    expect(validateImportImages(["data:text/html;base64,AAAA"])).not.toBeNull();
    expect(validateImportImages(Array(MAX_IMPORT_TILES + 1).fill(tiny))).not.toBeNull();
    expect(validateImportImages([tiny, tiny])).toBeNull();
  });

  it("parses model output", () => {
    const r = parseImageImportResult(
      JSON.stringify({ title: " T ", text: "a  \n\n\n\nb", language: "de", source_platform: "X" }),
    );
    expect(r).toEqual({
      title: "T",
      title_kind: "headline",
      text: "a\n\nb",
      language: "de",
      source_platform: "X",
    });
    expect(parseImageImportResult("not json")).toBeNull();
    expect(parseImageImportResult(JSON.stringify({ text: "x", language: "fr" }))?.language).toBe("other");
    expect(
      parseImageImportResult(
        JSON.stringify({
          title: "Kurz gesagt",
          title_kind: "summary",
          text: "Ein Post ohne Überschrift.",
          language: "de",
          source_platform: "",
        }),
      )?.title_kind,
    ).toBe("summary");
  });

  it("asks for a verbatim headline, and a same-language summary when there is none", () => {
    expect(IMAGE_IMPORT_SYSTEM_PROMPT).toMatch(/transcribe that headline VERBATIM/i);
    expect(IMAGE_IMPORT_SYSTEM_PROMPT).toMatch(/Do not invent, translate, summarize, correct or rewrite a real headline/);
    expect(IMAGE_IMPORT_SYSTEM_PROMPT).toMatch(/short summary title/i);
    expect(IMAGE_IMPORT_SYSTEM_PROMPT).toMatch(/SAME language/i);
    expect(IMAGE_IMPORT_SYSTEM_PROMPT).not.toMatch(/otherwise an empty string/i);
    expect(IMAGE_IMPORT_JSON_SCHEMA.schema.required).toContain("title_kind");
  });

  it("normalizes line endings", () => {
    expect(normalizeTranscript("a\r\nb \n\n\n c")).toBe("a\nb\n\n c");
  });

  it("plans vertical tiles with overlap and full coverage", () => {
    expect(planVerticalTiles(1500)).toEqual([{ y: 0, h: 1500 }]);
    const tiles = planVerticalTiles(5000, 2000, 120);
    expect(tiles[0]).toEqual({ y: 0, h: 2000 });
    expect(tiles[1].y).toBe(1880);
    const last = tiles[tiles.length - 1];
    expect(last.y + last.h).toBe(5000);
    for (const t of tiles) expect(t.h).toBeLessThanOrEqual(2000);
  });
});
