/**
 * 按 ID 列表分批查询，避免 `.in(列, 很多 ID)` 拼出的 URL 过长被 Supabase 拒绝（400 Bad Request）。
 * 每个 UUID 约 37 字符，100 个一批约 3.7 KB，远低于常见 8 KB URL 上限。
 */
export const IN_QUERY_CHUNK_SIZE = 100;

export async function selectInChunks<T>(
  ids: readonly string[],
  run: (chunk: string[]) => PromiseLike<{ data: unknown; error: unknown }>,
  chunkSize = IN_QUERY_CHUNK_SIZE,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const { data, error } = await run(ids.slice(i, i + chunkSize));
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
  }
  return out;
}
