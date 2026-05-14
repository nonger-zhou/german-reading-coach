import type { AnalyzedVocabularyItem } from "./types";
import { vocabPartOfSpeechForDb } from "../supabase/vocabPartOfSpeechForDb";

export function normalizeVocabLibraryFilterKey(raw: string): string {
  return raw.trim().toLocaleLowerCase("de-DE").replace(/\s+/g, " ");
}

/** `normalized_key` 已归一化、`part_of_speech` 为 DB 侧规范化后的复合键 */
export function vocabLibraryBlockKey(
  normalizedKeyCandidate: string,
  partOfSpeechRaw: string,
): string {
  const nk = normalizeVocabLibraryFilterKey(normalizedKeyCandidate);
  const pos = vocabPartOfSpeechForDb(partOfSpeechRaw);
  return `${nk}\u0000${pos}`;
}

export function buildVocabLibraryBlockedKeySet(
  rows: ReadonlyArray<{
    normalized_key: string | null | undefined;
    part_of_speech: string | null | undefined;
  }>,
): Set<string> {
  const set = new Set<string>();
  for (const row of rows) {
    const rawNk = (row.normalized_key ?? "").trim();
    if (!rawNk) continue;
    set.add(vocabLibraryBlockKey(rawNk, row.part_of_speech ?? ""));
  }
  return set;
}

export function analysisVocabItemIsBlocked(
  item: Pick<AnalyzedVocabularyItem, "normalized_key" | "lemma" | "part_of_speech">,
  blocked: Set<string>,
): boolean {
  if (!blocked.size) return false;
  const nkSource =
    (item.normalized_key ?? "").trim() || (item.lemma ?? "").trim();
  if (!nkSource) return false;
  return blocked.has(vocabLibraryBlockKey(nkSource, item.part_of_speech));
}

export function filterArticleAnalysisVocabularyByBlockedSet(
  vocabulary: AnalyzedVocabularyItem[],
  blocked: Set<string>,
): { vocabulary: AnalyzedVocabularyItem[]; removedCount: number } {
  if (!blocked.size) {
    return { vocabulary, removedCount: 0 };
  }
  const kept: AnalyzedVocabularyItem[] = [];
  let removedCount = 0;
  for (const item of vocabulary) {
    if (analysisVocabItemIsBlocked(item, blocked)) removedCount += 1;
    else kept.push(item);
  }
  return { vocabulary: kept, removedCount };
}

/**
 * 供 OpenAI user 消息附加：列出已掌握/暂忽略键，减少模型重复输出；
 * `blockedSet` 与后处理剔除使用同一套行数据。
 */
export function formatVocabLibraryBlockPromptFromRows(
  rows: ReadonlyArray<{
    normalized_key: string | null | undefined;
    part_of_speech: string | null | undefined;
  }>,
  maxDetailLines = 200,
): { blockLines: string; blockedSet: Set<string> } {
  const blockedSet = buildVocabLibraryBlockedKeySet(rows);
  if (blockedSet.size === 0) {
    return { blockLines: "", blockedSet };
  }
  const intro =
    "【用户总词库】以下每行：normalized_key（小写归一化）与 part_of_speech 之间为制表符分隔。对应用户已标为「已掌握」或「暂忽略」的词汇记录。" +
    "不要把 vocabulary 中 normalized_key 与 part_of_speech 与下列任一行完全一致的项列入推荐；" +
    "学习中（含 new / learning / familiar）或未出现在本表的词不受影响；用户改回学习中后不会出现在本表。\n";

  const lines: string[] = [];
  const seenLine = new Set<string>();
  for (const row of rows) {
    const rawNk = (row.normalized_key ?? "").trim();
    if (!rawNk) continue;
    const k = vocabLibraryBlockKey(rawNk, row.part_of_speech ?? "");
    if (seenLine.has(k)) continue;
    seenLine.add(k);
    lines.push(
      `${normalizeVocabLibraryFilterKey(rawNk)}\t${vocabPartOfSpeechForDb(row.part_of_speech ?? "")}`,
    );
  }
  lines.sort();

  let table: string;
  if (lines.length > maxDetailLines) {
    table =
      `（共 ${lines.length} 条，以下仅展示前 ${maxDetailLines} 条；服务端仍会对全部 ${lines.length} 条做命中剔除。）\n` +
      lines.slice(0, maxDetailLines).join("\n");
  } else {
    table = lines.join("\n");
  }
  return { blockLines: intro + table, blockedSet };
}
