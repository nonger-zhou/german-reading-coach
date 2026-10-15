import { describe, expect, it } from "vitest";
import {
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
    expect(r).toEqual({ title: "T", text: "a\n\nb", language: "de", source_platform: "X" });
    expect(parseImageImportResult("not json")).toBeNull();
    expect(parseImageImportResult(JSON.stringify({ text: "x", language: "fr" }))?.language).toBe("other");
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
