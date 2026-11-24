import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseReaderFocusSearch,
  replaceReaderFocusInHref,
  resetReaderFocusUrlStateForTests,
  resolveReaderFocus,
  writeReaderFocusToCurrentUrl,
} from "./readerFocusUrl";

afterEach(() => {
  resetReaderFocusUrlStateForTests();
  vi.unstubAllGlobals();
});

describe("parseReaderFocusSearch", () => {
  it("reads a vocabulary deep link", () => {
    expect(
      parseReaderFocusSearch("?focus=vocab&vocabItemId=db-1&occurrenceId=occ-9"),
    ).toEqual({
      kind: "vocab",
      itemId: "db-1",
      occurrenceId: "occ-9",
    });
  });

  it("reads a grammar deep link", () => {
    expect(
      parseReaderFocusSearch("focus=grammar&grammarItemId=g-1"),
    ).toEqual({
      kind: "grammar",
      itemId: "g-1",
      occurrenceId: undefined,
    });
  });

  it("ignores an empty focus", () => {
    expect(parseReaderFocusSearch("?focus=vocab")).toBeUndefined();
    expect(parseReaderFocusSearch("")).toBeUndefined();
  });
});

describe("replaceReaderFocusInHref", () => {
  const base = "https://reading.example/articles/a1";

  it("writes the vocabulary params and keeps unrelated ones", () => {
    const next = replaceReaderFocusInHref(`${base}?next=%2Farticles%2Fa1`, {
      kind: "vocab",
      itemId: "db-1",
      occurrenceId: "occ-1",
    });
    const url = new URL(next, base);
    expect(url.pathname).toBe("/articles/a1");
    expect(url.searchParams.get("next")).toBe("/articles/a1");
    expect(url.searchParams.get("focus")).toBe("vocab");
    expect(url.searchParams.get("vocabItemId")).toBe("db-1");
    expect(url.searchParams.get("occurrenceId")).toBe("occ-1");
    expect(url.searchParams.get("grammarItemId")).toBeNull();
  });

  it("clears focus params and switches from vocab to grammar", () => {
    const next = replaceReaderFocusInHref(
      `${base}?focus=vocab&vocabItemId=db-1&occurrenceId=occ-1`,
      { kind: "grammar", itemId: "g-2" },
    );
    const url = new URL(next, base);
    expect(url.searchParams.get("focus")).toBe("grammar");
    expect(url.searchParams.get("grammarItemId")).toBe("g-2");
    expect(url.searchParams.get("vocabItemId")).toBeNull();
    expect(url.searchParams.get("occurrenceId")).toBeNull();
  });

  it("removes focus params when the selection is closed", () => {
    const next = replaceReaderFocusInHref(
      `${base}?focus=vocab&vocabItemId=db-1&src=library#top`,
      null,
    );
    expect(next).toBe("/articles/a1?src=library#top");
  });
});

describe("resolveReaderFocus", () => {
  it("prefers the live URL over the prop captured at page load", () => {
    vi.stubGlobal("window", {
      location: { search: "?focus=vocab&vocabItemId=live" },
    });
    expect(
      resolveReaderFocus({ kind: "vocab", itemId: "stale" }),
    ).toEqual({
      kind: "vocab",
      itemId: "live",
      occurrenceId: undefined,
    });
  });

  it("ignores a stale prop after the selection was cleared", () => {
    const replaceState = vi.fn();
    vi.stubGlobal("window", {
      location: {
        href: "https://reading.example/articles/a1?focus=vocab&vocabItemId=db-1",
        pathname: "/articles/a1",
        search: "?focus=vocab&vocabItemId=db-1",
        hash: "",
      },
      history: { state: { next: true }, replaceState },
    });
    writeReaderFocusToCurrentUrl(null);
    window.location.search = "";
    window.location.href = "https://reading.example/articles/a1";
    expect(resolveReaderFocus({ kind: "vocab", itemId: "db-1" })).toBeUndefined();
    expect(replaceState).toHaveBeenCalledWith(
      { next: true },
      "",
      "/articles/a1",
    );
  });
});
