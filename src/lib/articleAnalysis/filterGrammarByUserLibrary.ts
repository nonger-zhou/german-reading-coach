import type { AnalyzedGrammarItem } from "./types";
import { normalizeTextKey } from "../articleReadingModel";

/** 与 `grammar_items` 唯一键 `(user_id, grammar_key, normalized_key)` 对齐的复合键 */
export function grammarLibraryBlockKey(
  grammarKeyRaw: string,
  normalizedKeyRaw: string,
): string {
  const gk = normalizeTextKey(grammarKeyRaw);
  const nk = normalizeTextKey(normalizedKeyRaw);
  return `${gk}\u0000${nk}`;
}

export function buildGrammarLibraryBlockedKeySet(
  rows: ReadonlyArray<{
    grammar_key: string | null | undefined;
    normalized_key: string | null | undefined;
  }>,
): Set<string> {
  const set = new Set<string>();
  for (const row of rows) {
    const gk = (row.grammar_key ?? "").trim();
    const nk = (row.normalized_key ?? "").trim();
    if (!gk || !nk) continue;
    set.add(grammarLibraryBlockKey(gk, nk));
  }
  return set;
}

/** 与 `convertAnalysisToArticleItems` 一致：AI 项的 normalized_key 缺省则回退 grammar_key */
export function analysisGrammarItemBlockKey(
  item: Pick<AnalyzedGrammarItem, "grammar_key" | "normalized_key">,
): string {
  const gk = (item.grammar_key ?? "").trim();
  const nkSource =
    (item.normalized_key ?? "").trim() || (item.grammar_key ?? "").trim();
  if (!gk || !nkSource) return "";
  return grammarLibraryBlockKey(gk, nkSource);
}

export function analysisGrammarItemIsBlocked(
  item: Pick<AnalyzedGrammarItem, "grammar_key" | "normalized_key">,
  blocked: Set<string>,
): boolean {
  if (!blocked.size) return false;
  const k = analysisGrammarItemBlockKey(item);
  if (!k) return false;
  return blocked.has(k);
}

export function filterArticleAnalysisGrammarByBlockedSet(
  grammar: AnalyzedGrammarItem[],
  blocked: Set<string>,
): { grammar: AnalyzedGrammarItem[]; removedCount: number } {
  if (!blocked.size) {
    return { grammar, removedCount: 0 };
  }
  const kept: AnalyzedGrammarItem[] = [];
  let removedCount = 0;
  for (const item of grammar) {
    if (analysisGrammarItemIsBlocked(item, blocked)) removedCount += 1;
    else kept.push(item);
  }
  return { grammar: kept, removedCount };
}

/**
 * 供 OpenAI user 消息附加：列出已掌握/暂忽略语法键；
 * `blockedSet` 与后处理剔除使用同一套行数据。
 */
export function formatGrammarLibraryBlockPromptFromRows(
  rows: ReadonlyArray<{
    grammar_key: string | null | undefined;
    normalized_key: string | null | undefined;
  }>,
  maxDetailLines = 200,
): { blockLines: string; blockedSet: Set<string> } {
  const blockedSet = buildGrammarLibraryBlockedKeySet(rows);
  if (blockedSet.size === 0) {
    return { blockLines: "", blockedSet };
  }
  const intro =
    "【用户总语法库】以下每行：grammar_key 与 normalized_key 之间为制表符分隔（各经小写归一化与空白折叠，与总库唯一键一致）。对应用户已标为「已掌握」或「暂忽略」的语法记录。" +
    "不要把 grammar 中 grammar_key 与 normalized_key 与下列任一行完全一致的项列入推荐；" +
    "学习中（含 new / learning / familiar）或未出现在本表的项不受影响；用户改回学习中后不会出现在本表。\n";

  const lines: string[] = [];
  const seenLine = new Set<string>();
  for (const row of rows) {
    const gk = (row.grammar_key ?? "").trim();
    const nk = (row.normalized_key ?? "").trim();
    if (!gk || !nk) continue;
    const k = grammarLibraryBlockKey(gk, nk);
    if (seenLine.has(k)) continue;
    seenLine.add(k);
    lines.push(`${normalizeTextKey(gk)}\t${normalizeTextKey(nk)}`);
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
