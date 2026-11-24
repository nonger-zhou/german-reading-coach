/**
 * 阅读页当前词条写进地址栏，供整页重载（例如 iOS 丢掉标签页）恢复。
 * 只用 history.replaceState，不走 Next 路由，避免搜索参数变化把阅读器再渲染一遍。
 *
 * 总词库 / 总语法的深链仍是 ?focus=vocab|grammar&vocabItemId|grammarItemId&occurrenceId。
 * 这里写入数据库 id（没有则用界面 id），与那两条深链同一套参数。
 */

export type ReaderFocus = {
  kind: "vocab" | "grammar";
  itemId?: string;
  occurrenceId?: string;
};

export type ReaderFocusWrite = {
  kind: "vocab" | "grammar";
  itemId: string;
  occurrenceId?: string;
};

const FOCUS_PARAM_KEYS = [
  "focus",
  "vocabItemId",
  "grammarItemId",
  "occurrenceId",
] as const;

/**
 * 用户关掉详情后，Next 的 searchParams 可能还停在打开页面时的深链。
 * 重挂阅读器时不要用那份过期参数把词再打开。整页重载会清掉这个标记，以地址栏为准。
 */
let ignoreStalePropFocus = false;

export function resetReaderFocusUrlStateForTests(): void {
  ignoreStalePropFocus = false;
}

export function parseReaderFocusSearch(search: string): ReaderFocus | undefined {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const focus = params.get("focus");
  const occurrenceId = params.get("occurrenceId")?.trim() || undefined;
  if (focus === "vocab") {
    const itemId = params.get("vocabItemId")?.trim() || undefined;
    if (!itemId && !occurrenceId) return undefined;
    return { kind: "vocab", itemId, occurrenceId };
  }
  if (focus === "grammar") {
    const itemId = params.get("grammarItemId")?.trim() || undefined;
    if (!itemId && !occurrenceId) return undefined;
    return { kind: "grammar", itemId, occurrenceId };
  }
  return undefined;
}

/** 地址栏优先；关掉详情后忽略页面初次带入、但已被 replaceState 清掉的 prop。 */
export function resolveReaderFocus(
  prop: ReaderFocus | undefined,
): ReaderFocus | undefined {
  if (typeof window === "undefined") return prop;
  const live = parseReaderFocusSearch(window.location.search);
  if (live) return live;
  if (ignoreStalePropFocus) return undefined;
  return prop;
}

export function replaceReaderFocusInHref(
  href: string,
  selection: ReaderFocusWrite | null,
): string {
  const url = new URL(href);
  for (const key of FOCUS_PARAM_KEYS) url.searchParams.delete(key);
  if (selection) {
    url.searchParams.set("focus", selection.kind);
    url.searchParams.set(
      selection.kind === "vocab" ? "vocabItemId" : "grammarItemId",
      selection.itemId,
    );
    if (selection.occurrenceId) {
      url.searchParams.set("occurrenceId", selection.occurrenceId);
    }
  }
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}

export function writeReaderFocusToCurrentUrl(
  selection: ReaderFocusWrite | null,
): void {
  if (typeof window === "undefined") return;
  ignoreStalePropFocus = selection == null;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const next = replaceReaderFocusInHref(window.location.href, selection);
  if (next === current) return;
  window.history.replaceState(window.history.state, "", next);
}
