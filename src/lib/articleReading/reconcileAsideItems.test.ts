import { describe, expect, it } from "vitest";
import {
  reconcileAsideItems,
  type ReconcilableAsideItem,
} from "./reconcileAsideItems";

function item(
  partial: Pick<ReconcilableAsideItem, "id"> &
    Partial<ReconcilableAsideItem>,
): ReconcilableAsideItem {
  return {
    dbItemId: null,
    normalized_key: partial.id,
    occurrences: [],
    ...partial,
  };
}

describe("reconcileAsideItems", () => {
  it("keeps the open word when a refresh returns the same ids", () => {
    const prev = [
      item({
        id: "vocab-1",
        dbItemId: "1",
        occurrences: [{ id: "occ-1", start_offset: 0, end_offset: 4 }],
      }),
    ];
    const incoming = [
      item({
        id: "vocab-1",
        dbItemId: "1",
        normalized_key: "haus",
        occurrences: [{ id: "occ-1", start_offset: 0, end_offset: 4 }],
      }),
      item({ id: "vocab-2", dbItemId: "2", normalized_key: "neu" }),
    ];
    const result = reconcileAsideItems(prev, incoming, {
      itemId: "vocab-1",
      occurrenceId: "occ-1",
    });
    expect(result.items.map((entry) => entry.id)).toEqual(["vocab-1", "vocab-2"]);
    expect(result.selection).toEqual({
      itemId: "vocab-1",
      occurrenceId: "occ-1",
    });
  });

  it("follows a word whose interface id changed but the database id did not", () => {
    const prev = [
      item({
        id: "v-item-local",
        dbItemId: "db-9",
        normalized_key: "haus",
        occurrences: [{ id: "v-item-local-2-6", start_offset: 2, end_offset: 6 }],
      }),
    ];
    const incoming = [
      item({
        id: "vocab-db-9",
        dbItemId: "db-9",
        normalized_key: "haus",
        occurrences: [{ id: "uuid-occ", start_offset: 2, end_offset: 6 }],
      }),
    ];
    const result = reconcileAsideItems(prev, incoming, {
      itemId: "v-item-local",
      occurrenceId: "v-item-local-2-6",
    });
    expect(result.selection).toEqual({
      itemId: "vocab-db-9",
      occurrenceId: "uuid-occ",
    });
  });

  it("keeps a just-selected word that the snapshot does not contain yet", () => {
    const local = item({
      id: "v-item-new",
      normalized_key: "neu",
      occurrences: [{ id: "occ-new" }],
    });
    const result = reconcileAsideItems(
      [local],
      [item({ id: "vocab-1", dbItemId: "1" })],
      { itemId: "v-item-new", occurrenceId: "occ-new" },
    );
    expect(result.items.map((entry) => entry.id)).toEqual([
      "vocab-1",
      "v-item-new",
    ]);
    expect(result.selection?.itemId).toBe("v-item-new");
  });

  it("drops the selection when the word is gone from both lists", () => {
    const result = reconcileAsideItems(
      [],
      [item({ id: "vocab-1", dbItemId: "1" })],
      { itemId: "missing" },
    );
    expect(result.selection).toBeNull();
    expect(result.items).toHaveLength(1);
  });

  it("replaces the list with the snapshot when nothing is selected", () => {
    const result = reconcileAsideItems(
      [item({ id: "local-only" })],
      [item({ id: "vocab-1", dbItemId: "1" })],
      null,
    );
    expect(result.items.map((entry) => entry.id)).toEqual(["vocab-1"]);
    expect(result.selection).toBeNull();
  });
});
