import { describe, expect, it } from "vitest";
import { normalizeDeepNoteMarkdown } from "./normalizeDeepNoteMarkdown";

describe("normalizeDeepNoteMarkdown", () => {
  it("removes invisible control characters from copied AI notes", () => {
    const text = normalizeDeepNoteMarkdown(
      "\uFEFF## Hinweis\u0000\r\n**wichtig**\u200B\u0007\u00A0bleibt",
    );

    expect(text).toBe("Hinweis\nwichtig bleibt");
  });
});
