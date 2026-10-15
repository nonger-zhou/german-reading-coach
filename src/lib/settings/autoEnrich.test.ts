import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  enqueueUnique,
  readAutoEnrichOnAdd,
  STORAGE_KEY_AUTO_ENRICH_ON_ADD,
  writeAutoEnrichOnAdd,
} from "./autoEnrich";

describe("auto-enrich-on-add setting", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("defaults to on when never set", () => {
    expect(readAutoEnrichOnAdd()).toBe(true);
  });

  it("can be turned off and on again", () => {
    writeAutoEnrichOnAdd(false);
    expect(store.get(STORAGE_KEY_AUTO_ENRICH_ON_ADD)).toBe("false");
    expect(readAutoEnrichOnAdd()).toBe(false);
    writeAutoEnrichOnAdd(true);
    expect(readAutoEnrichOnAdd()).toBe(true);
  });

  it("falls back to on when storage throws", () => {
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
      },
    };
    expect(readAutoEnrichOnAdd()).toBe(true);
  });

  it("queue never holds the same item twice", () => {
    expect(enqueueUnique(["a"], "a")).toEqual(["a"]);
    expect(enqueueUnique(["a"], "b")).toEqual(["a", "b"]);
  });
});
