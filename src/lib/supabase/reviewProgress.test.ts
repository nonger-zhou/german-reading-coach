import { describe, expect, it } from "vitest";
import {
  isMissingReviewTable,
  localEntriesMissingInDb,
  rowsToReviewState,
} from "./reviewProgress";

describe("reviewProgress", () => {
  it("detects missing table errors", () => {
    expect(isMissingReviewTable({ code: "42P01", message: "x" })).toBe(true);
    expect(isMissingReviewTable({ code: "PGRST205", message: "Could not find the table" })).toBe(true);
    expect(
      isMissingReviewTable({ message: "relation \"public.vocabulary_review_progress\" does not exist" }),
    ).toBe(true);
    expect(isMissingReviewTable({ code: "42501", message: "permission denied for table articles" })).toBe(false);
    expect(isMissingReviewTable(null)).toBe(false);
  });

  it("maps rows to state", () => {
    expect(
      rowsToReviewState([{ vocabulary_item_id: "a", box: 2, due_at: "2026-10-16T00:00:00Z" }]),
    ).toEqual({ a: { box: 2, due: "2026-10-16T00:00:00Z" } });
  });

  it("only migrates local entries that are learning and not in db", () => {
    const local = {
      a: { box: 1, due: "d1" },
      b: { box: 3, due: "d2" },
      c: { box: 2, due: "d3" },
    };
    const db = { b: { box: 4, due: "dx" } };
    expect(localEntriesMissingInDb(local, db, new Set(["a", "b"]))).toEqual({ a: { box: 1, due: "d1" } });
  });
});
