import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReviewEntry, ReviewState } from "@/lib/review/reviewQueue";
import { selectInChunks } from "@/lib/supabase/inChunks";

/**
 * 复习排期的数据库存储（表 vocabulary_review_progress，迁移 012）。
 * 表不存在时（未执行 012）调用方应退回浏览器 localStorage。
 */

const TABLE = "vocabulary_review_progress";

type ProgressRow = {
  vocabulary_item_id: string;
  box: number;
  due_at: string;
};

/** 表不存在 / schema cache 里找不到表 */
export function isMissingReviewTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; message?: unknown };
  const message = typeof e.message === "string" ? e.message : "";
  return (
    e.code === "42P01" ||
    e.code === "PGRST205" ||
    e.code === "PGRST204" ||
    message.includes(TABLE)
  );
}

export function rowsToReviewState(rows: ReadonlyArray<ProgressRow>): ReviewState {
  const out: ReviewState = {};
  for (const r of rows) {
    if (typeof r.box === "number" && typeof r.due_at === "string") {
      out[r.vocabulary_item_id] = { box: r.box, due: r.due_at };
    }
  }
  return out;
}

/** 本地有、数据库没有的记录（用于一次性把浏览器排期搬进数据库） */
export function localEntriesMissingInDb(
  local: ReviewState,
  db: ReviewState,
  learningIds: ReadonlySet<string>,
): ReviewState {
  const out: ReviewState = {};
  for (const [id, entry] of Object.entries(local)) {
    if (learningIds.has(id) && !(id in db)) out[id] = entry;
  }
  return out;
}

/**
 * 读取这些词条的排期。
 * - `{ state }`：成功；
 * - `{ missingTable: true }`：未执行 012，调用方退回本地；
 * - 其他错误抛出。
 */
export async function fetchReviewProgress(
  supabase: SupabaseClient,
  userId: string,
  itemIds: readonly string[],
): Promise<{ state: ReviewState; missingTable: false } | { state: null; missingTable: true }> {
  // 先探测表是否存在（词条为 0 时 selectInChunks 不会发请求）
  const probe = await supabase.from(TABLE).select("vocabulary_item_id").eq("user_id", userId).limit(1);
  if (probe.error) {
    if (isMissingReviewTable(probe.error)) return { state: null, missingTable: true };
    throw probe.error;
  }
  const rows = await selectInChunks<ProgressRow>(itemIds, (chunk) =>
    supabase
      .from(TABLE)
      .select("vocabulary_item_id,box,due_at")
      .eq("user_id", userId)
      .in("vocabulary_item_id", chunk),
  );
  return { state: rowsToReviewState(rows), missingTable: false };
}

export async function upsertReviewEntries(
  supabase: SupabaseClient,
  userId: string,
  entries: ReviewState,
): Promise<{ error: unknown }> {
  const rows = Object.entries(entries).map(([id, e]: [string, ReviewEntry]) => ({
    user_id: userId,
    vocabulary_item_id: id,
    box: e.box,
    due_at: e.due,
    updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from(TABLE)
      .upsert(rows.slice(i, i + 500), { onConflict: "user_id,vocabulary_item_id" });
    if (error) return { error };
  }
  return { error: null };
}

export async function deleteReviewEntry(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("vocabulary_item_id", itemId);
  return { error };
}
