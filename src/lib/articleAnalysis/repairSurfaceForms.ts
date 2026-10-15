import type { AnalyzedVocabularyItem } from "./types";

/**
 * AI 给出的 surface_form 在原文里找不到时，尝试改成原文中的实际写法（2026-10-15，德语 / 英语通用）。
 *
 * 常见原因：
 * - 德语名词被加了冠词：AI 写 "das Verbrechen"，原文只有 "Verbrechen" 或 "der Tradition"；
 * - 英语加了 to / the / a：AI 写 "to concede"，原文是 "conceded"；
 * - 词形不同：AI 写 "Tradition"，原文是 "Traditionen"。
 *
 * 只处理「原文里找不到」的条目；能精确找到的保持不变。找到后把 surface_form 换成原文片段，
 * 这样预览不再提示「未精确匹配」，保存后也能高亮。依次尝试：
 * 1. 去掉开头的冠词 / to 后找（高亮只标词本身）；
 * 2. 原样找（单个词按整词匹配，不会匹配到长词内部；多词短语按子串，均先精确后不区分大小写）；
 * 3. 单个词时，允许原文词尾多 0–3 个字母（Tradition → Traditionen、concede → conceded），整词匹配。
 */

const LEADING_FUNCTION_WORD =
  /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines|the|a|an|to)\s+/i;

const LETTER = "A-Za-zÄÖÜäöüß";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 多词短语：子串匹配（先精确，再不区分大小写） */
function findPhrase(text: string, needle: string): string | null {
  if (!needle) return null;
  if (text.includes(needle)) return needle;
  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0 || needle.toLowerCase().length !== needle.length) return null;
  return text.slice(idx, idx + needle.length);
}

/** 单个词：整词匹配，允许词尾多 maxSuffix 个字母；同等条件下优先大小写完全一致 */
function findWord(text: string, word: string, maxSuffix: number): string | null {
  if (!word || /\s/.test(word)) return null;
  const body = `(?<![${LETTER}])${escapeRegex(word)}[${LETTER}]{0,${maxSuffix}}(?![${LETTER}])`;
  const exact = new RegExp(body).exec(text);
  if (exact) return exact[0];
  const ci = new RegExp(body, "i").exec(text);
  return ci ? ci[0] : null;
}

function find(text: string, needle: string): string | null {
  return /\s/.test(needle) ? findPhrase(text, needle) : findWord(text, needle, 0);
}

/** 返回原文中的实际写法；找不到返回 null */
export function locateSurfaceInText(text: string, surface: string): string | null {
  const s = (surface ?? "").trim();
  if (!s) return null;
  const stripped = s.replace(LEADING_FUNCTION_WORD, "").trim();
  const hasLeadingWord = Boolean(stripped) && stripped !== s;
  // 带冠词 / to 的先找去掉后的（高亮只标名词本身），再找原样
  if (hasLeadingWord) {
    const hit = find(text, stripped);
    if (hit) return hit;
  }
  const direct = find(text, s);
  if (direct) return direct;
  const base = hasLeadingWord ? stripped : s;
  return base.length >= 4 ? findWord(text, base, 3) : null;
}

export function repairVocabularySurfaceForms(
  items: ReadonlyArray<AnalyzedVocabularyItem>,
  text: string,
): AnalyzedVocabularyItem[] {
  return items.map((item) => {
    const surface = (item.surface_form ?? "").trim();
    if (surface && text.includes(surface)) return item;
    const found =
      locateSurfaceInText(text, surface) ?? locateSurfaceInText(text, item.lemma ?? "");
    return found && found !== item.surface_form ? { ...item, surface_form: found } : item;
  });
}
