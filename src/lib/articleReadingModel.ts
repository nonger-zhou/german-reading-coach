import type { ArticleChunk, GrammarEntry, VocabEntry } from "@/lib/types";
import type {
  ArticleGrammarItem,
  ArticleVocabItem,
  ChunkInterval,
  GrammarOccurrence,
  OccurrenceSource,
  VocabOccurrence,
  VocabSense,
} from "@/lib/articleReadingTypes";

/** 列表去重：trim、合并连续空格、小写 */
export function normalizeTextKey(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function newEntityId(prefix: string): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** 从 articlePlain 中截取含 position 的句子（按 . ! ? 粗略切分） */
export function extractSentence(
  articlePlain: string,
  start: number,
  end: number,
): string {
  let a = Math.min(start, articlePlain.length);
  while (a > 0 && !".!?".includes(articlePlain[a - 1]!)) a--;
  if (a > 0 && ".!?".includes(articlePlain[a - 1]!)) a++;
  while (a < articlePlain.length && articlePlain[a] === " ") a++;

  let b = Math.max(end, 0);
  while (b < articlePlain.length && !".!?".includes(articlePlain[b]!)) b++;
  if (b < articlePlain.length && ".!?".includes(articlePlain[b]!)) b++;

  return articlePlain.slice(a, b).trim() || articlePlain.slice(start, end).trim();
}

export function buildArticleLayout(chunks: ArticleChunk[]): {
  articlePlain: string;
  chunkIntervals: ChunkInterval[];
} {
  let off = 0;
  const chunkIntervals: ChunkInterval[] = [];
  let plain = "";
  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];
    const text = chunk.kind === "text" ? chunk.text : chunk.surface;
    const start = off;
    const end = off + text.length;
    chunkIntervals.push({ start, end, chunk, index });
    plain += text;
    off = end;
  }
  return { articlePlain: plain, chunkIntervals };
}

/** 整篇正文作为单一 text chunk（无课文嵌入词块）；用于 `/articles/[id]` 等纯文本来源 */
export function buildPlainTextArticleLayout(plain: string): {
  articlePlain: string;
  chunkIntervals: ChunkInterval[];
} {
  const chunk: ArticleChunk = { kind: "text", text: plain };
  return {
    articlePlain: plain,
    chunkIntervals: [{ start: 0, end: plain.length, chunk, index: 0 }],
  };
}

/**
 * Mock 回归：选中 "angekündigt" 加入词库时，高亮必须落在该词上，不能错位。
 * offset 不可靠时在 articlePlain 上对 selectedText 做精确匹配（距 hint 最近）。
 */
export function findBestTextOccurrence(
  articlePlain: string,
  needle: string,
  hintStart: number,
): { start: number; end: number } | null {
  if (!needle) return null;
  const candidates: number[] = [];
  let from = 0;
  while (from <= articlePlain.length) {
    const idx = articlePlain.indexOf(needle, from);
    if (idx === -1) break;
    candidates.push(idx);
    from = idx + 1;
  }
  if (candidates.length === 0) return null;
  let best = candidates[0]!;
  let bestDist = Math.abs(best - hintStart);
  for (const c of candidates) {
    const d = Math.abs(c - hintStart);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return { start: best, end: best + needle.length };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 宽松匹配：允许 needle 中的连续空白与正文的空白形态不同（空格/换行）。 */
function findLooseWhitespaceOccurrence(
  articlePlain: string,
  needle: string,
): { start: number; end: number } | null {
  const n = needle.trim();
  if (!n) return null;
  const parts = n.split(/\s+/).map((p) => escapeRegex(p)).filter(Boolean);
  if (!parts.length) return null;
  const pattern = parts.join("\\s+");
  const re = new RegExp(pattern, "u");
  const m = re.exec(articlePlain);
  if (!m || m.index < 0) return null;
  return { start: m.index, end: m.index + m[0].length };
}

export function resolveUserHighlightInPlain(
  root: HTMLElement | null,
  range: Range | null,
  articlePlain: string,
  phraseFallback: string,
): { start: number; end: number; surface: string } | null {
  const fallback = phraseFallback.trim();
  if (!fallback) return null;

  const selectedExact =
    range && root && !range.collapsed && root.contains(range.commonAncestorContainer)
      ? range.toString()
      : "";

  let hintStart = 0;
  if (range && root && root.contains(range.commonAncestorContainer)) {
    try {
      const pre = document.createRange();
      pre.setStart(root, 0);
      pre.setEnd(range.startContainer, range.startOffset);
      hintStart = pre.toString().length;
    } catch {
      hintStart = 0;
    }
  }

  if (
    range &&
    root &&
    !range.collapsed &&
    root.contains(range.commonAncestorContainer)
  ) {
    try {
      const endR = document.createRange();
      endR.setStart(root, 0);
      endR.setEnd(range.endContainer, range.endOffset);
      const endOff = endR.toString().length;
      const startR = document.createRange();
      startR.setStart(root, 0);
      startR.setEnd(range.startContainer, range.startOffset);
      const startOff = startR.toString().length;
      const domSlice = articlePlain.slice(startOff, endOff);
      const rt = range.toString();
      if (
        startOff >= 0 &&
        endOff <= articlePlain.length &&
        endOff >= startOff &&
        domSlice === rt
      ) {
        return { start: startOff, end: endOff, surface: domSlice };
      }
      const occ = findBestTextOccurrence(articlePlain, rt, hintStart);
      if (occ) {
        const surface = articlePlain.slice(occ.start, occ.end);
        if (surface === rt) {
          return { start: occ.start, end: occ.end, surface };
        }
      }
      const needles = [rt, rt.trim(), fallback].filter(
        (s, i, a) => s.length > 0 && a.indexOf(s) === i,
      );
      for (const n of needles) {
        const o = findBestTextOccurrence(articlePlain, n, hintStart);
        if (o) {
          const surface = articlePlain.slice(o.start, o.end);
          return { start: o.start, end: o.end, surface };
        }
      }
    } catch {
      /* fall through */
    }
  }

  const needles = [selectedExact, selectedExact.trim(), fallback].filter(
    (s, i, a) => s.length > 0 && a.indexOf(s) === i,
  );
  for (const n of needles) {
    const o = findBestTextOccurrence(articlePlain, n, hintStart);
    if (o) {
      const surface = articlePlain.slice(o.start, o.end);
      return { start: o.start, end: o.end, surface };
    }
  }

  return null;
}

/**
 * 单个 occurrence 在文中对应的区间（至多一处）。
 * 必须与右侧 occurrence 列表一一对应：同一 surface 多次出现时，各有独立 occurrence 行与 id，
 * 不得再对全文做 indexOf 全匹配，否则多处区间会与多条 occurrence 争抢字符栅格，导致左侧 DOM 均为第一条 id、点击列表无法定位。
 */
export function vocabOccurrenceToRanges(
  occ: VocabOccurrence,
  articlePlain: string,
): { start: number; end: number }[] {
  const needle = occ.fallbackMatchText;
  if (!needle) return [];

  if (
    occ.start_offset !== undefined &&
    occ.end_offset !== undefined &&
    occ.start_offset >= 0 &&
    occ.end_offset <= articlePlain.length &&
    occ.end_offset > occ.start_offset
  ) {
    const slice = articlePlain.slice(occ.start_offset, occ.end_offset);
    if (slice === occ.surface_form || slice === needle) {
      return [{ start: occ.start_offset, end: occ.end_offset }];
    }
  }

  const idx = articlePlain.indexOf(needle);
  if (idx === -1) return [];
  return [{ start: idx, end: idx + needle.length }];
}

export function grammarOccurrenceToRanges(
  occ: GrammarOccurrence,
  articlePlain: string,
): { start: number; end: number }[] {
  return vocabOccurrenceToRanges(
    {
      id: occ.id,
      surface_form: occ.surface_form,
      sentence: occ.sentence,
      start_offset: occ.start_offset,
      end_offset: occ.end_offset,
      fallbackMatchText: occ.fallbackMatchText,
      source: occ.source,
    },
    articlePlain,
  );
}

export function vocabUserStyle(item: ArticleVocabItem): boolean {
  return (
    item.source === "user_added" ||
    item.source === "ai_detected_then_user_confirmed"
  );
}

export function grammarUserStyle(item: ArticleGrammarItem): boolean {
  return (
    item.source === "user_added" ||
    item.source === "ai_detected_then_user_confirmed"
  );
}

export type RunMeta =
  | { kind: "ai_vocab"; itemId: string; occurrenceId: string }
  | { kind: "user_vocab"; itemId: string; occurrenceId: string }
  | { kind: "ai_grammar"; itemId: string; occurrenceId: string }
  | { kind: "user_grammar"; itemId: string; occurrenceId: string };

const PRI_AI_GRAMMAR = 2;
const PRI_AI_VOCAB = 3;
const PRI_USER_GRAMMAR = 4;
const PRI_USER_VOCAB = 5;
const PRI_MASTERED_VOCAB_ANCHOR = 1;

export function sameRunMeta(a: RunMeta | null, b: RunMeta | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.kind === b.kind &&
    a.itemId === b.itemId &&
    a.occurrenceId === b.occurrenceId
  );
}

/**
 * 将词汇 / 语法 occurrence 映射为正文「单字符单一赢家」高亮栅格。
 * 重叠优先级、已掌握词锚点与选区相关说明见 `docs/READING_HIGHLIGHTS_AND_OVERLAPS.md`。
 */
export function buildRunsFromReadingItems(
  articlePlain: string,
  vocabularyItems: ArticleVocabItem[],
  grammarItems: ArticleGrammarItem[],
): { start: number; end: number; meta: RunMeta | null }[] {
  const n = articlePlain.length;
  const metas: ({ meta: RunMeta; pri: number } | null)[] = Array.from(
    { length: n },
    () => null,
  );

  const setRange = (
    start: number,
    end: number,
    pri: number,
    meta: RunMeta,
  ) => {
    for (let i = Math.max(0, start); i < Math.min(end, n); i++) {
      const cur = metas[i];
      if (!cur || cur.pri < pri) {
        metas[i] = { meta, pri };
      }
    }
  };

  for (const item of grammarItems) {
    const user = grammarUserStyle(item);
    const pri = user ? PRI_USER_GRAMMAR : PRI_AI_GRAMMAR;
    const kind = user ? "user_grammar" : "ai_grammar";
    for (const occ of item.occurrences) {
      for (const r of grammarOccurrenceToRanges(occ, articlePlain)) {
        setRange(r.start, r.end, pri, {
          kind,
          itemId: item.id,
          occurrenceId: occ.id,
        });
      }
    }
  }

  for (const item of vocabularyItems) {
    const user = vocabUserStyle(item);
    const pri =
      item.mastery_status === "mastered"
        ? PRI_MASTERED_VOCAB_ANCHOR
        : user
          ? PRI_USER_VOCAB
          : PRI_AI_VOCAB;
    const kind = user ? "user_vocab" : "ai_vocab";
    for (const occ of item.occurrences) {
      for (const r of vocabOccurrenceToRanges(occ, articlePlain)) {
        setRange(r.start, r.end, pri, {
          kind,
          itemId: item.id,
          occurrenceId: occ.id,
        });
      }
    }
  }

  const runs: { start: number; end: number; meta: RunMeta | null }[] = [];
  let i = 0;
  while (i < n) {
    const meta0: RunMeta | null = metas[i]?.meta ?? null;
    let j = i + 1;
    while (j < n) {
      const metaj: RunMeta | null = metas[j]?.meta ?? null;
      if (!sameRunMeta(meta0, metaj)) break;
      j++;
    }
    runs.push({ start: i, end: j, meta: meta0 });
    i = j;
  }
  return runs;
}

function findAllExactSubstringRanges(
  articlePlain: string,
  needle: string,
): { start: number; end: number }[] {
  if (!needle) return [];
  const out: { start: number; end: number }[] = [];
  let from = 0;
  let idx: number;
  while ((idx = articlePlain.indexOf(needle, from)) !== -1) {
    out.push({ start: idx, end: idx + needle.length });
    from = idx + 1;
  }
  return out;
}

/** 大小写不敏感：偏移与原文长度一致时使用（德语常见大小写变体） */
function findAllCaseInsensitiveSubstringRanges(
  articlePlain: string,
  needle: string,
): { start: number; end: number }[] {
  if (!needle) return [];
  const hl = articlePlain.toLowerCase();
  const nl = needle.toLowerCase();
  if (nl.length !== needle.length) return [];
  const out: { start: number; end: number }[] = [];
  let from = 0;
  let idx: number;
  while ((idx = hl.indexOf(nl, from)) !== -1) {
    out.push({ start: idx, end: idx + needle.length });
    from = idx + 1;
  }
  return out;
}

/**
 * 用户侧词汇（琥珀 / 用户确认）：仅用一张 item 卡片，occurrence 由当前 articlePlain 全文扫描得出，
 * id 稳定为 `${item.id}-${start}-${end}`，按 start 升序。
 */
export function rebuildUserStyleVocabOccurrencesFromArticle(
  item: ArticleVocabItem,
  articlePlain: string,
): ArticleVocabItem {
  const needle =
    (item.display_word && item.display_word.trim()) ||
    item.occurrences[0]?.fallbackMatchText?.trim() ||
    "";
  if (!needle) return item;

  let ranges = findAllExactSubstringRanges(articlePlain, needle);
  if (ranges.length === 0) {
    ranges = findAllCaseInsensitiveSubstringRanges(articlePlain, needle);
  }
  ranges.sort((a, b) => a.start - b.start);

  const senseId = item.senses[0]?.id;
  const occurrences: VocabOccurrence[] = ranges.map(({ start, end }) => ({
    id: `${item.id}-${start}-${end}`,
    surface_form: articlePlain.slice(start, end),
    sentence: extractSentence(articlePlain, start, end),
    start_offset: start,
    end_offset: end,
    fallbackMatchText: needle,
    source: "user_added",
    sense_id: senseId,
  }));

  return { ...item, occurrences };
}

/**
 * 阅读页词汇列表最终形态：用户类全文重建 occurrence；课文 AI 类沿用 indexOf 扩展策略。
 */
export function finalizeArticleVocabularyItems(
  items: ArticleVocabItem[],
  articlePlain: string,
): ArticleVocabItem[] {
  return items.map((item) => {
    if (vocabUserStyle(item)) {
      return rebuildUserStyleVocabOccurrencesFromArticle(item, articlePlain);
    }
    return expandVocabItemsWithRepeatedSurface([item], articlePlain)[0]!;
  });
}

/** 课文 AI 词在文中若多次出现，补充 occurrence（仅 AI 检测词） */
export function expandVocabItemsWithRepeatedSurface(
  items: ArticleVocabItem[],
  articlePlain: string,
): ArticleVocabItem[] {
  return items.map((item) => {
    const needle = item.display_word;
    if (!needle) return item;
    const starts = new Set(
      item.occurrences.map((o) => o.start_offset).filter((x) => x !== undefined),
    );
    const next = [...item.occurrences];
    let serial = item.occurrences.length;
    let from = 0;
    let idx;
    while ((idx = articlePlain.indexOf(needle, from)) !== -1) {
      if (!starts.has(idx)) {
        const end = idx + needle.length;
        next.push({
          id: `occ-${item.id}-auto-${serial++}`,
          surface_form: needle,
          sentence: extractSentence(articlePlain, idx, end),
          start_offset: idx,
          end_offset: end,
          fallbackMatchText: needle,
          source: "ai_detected",
          sense_id: item.senses[0]?.id,
        });
        starts.add(idx);
      }
      from = idx + 1;
    }
    return { ...item, occurrences: next };
  });
}

export function expandGrammarItemsWithRepeatedSurface(
  items: ArticleGrammarItem[],
  articlePlain: string,
): ArticleGrammarItem[] {
  return items.map((item) => {
    const needle = item.occurrences[0]?.fallbackMatchText ?? item.name_de;
    if (!needle) return item;
    const starts = new Set(
      item.occurrences.map((o) => o.start_offset).filter((x) => x !== undefined),
    );
    const next = [...item.occurrences];
    let serial = item.occurrences.length;
    let from = 0;
    let idx;
    while ((idx = articlePlain.indexOf(needle, from)) !== -1) {
      if (!starts.has(idx)) {
        const end = idx + needle.length;
        next.push({
          id: `gocc-${item.id}-auto-${serial++}`,
          surface_form: needle,
          sentence: extractSentence(articlePlain, idx, end),
          start_offset: idx,
          end_offset: end,
          fallbackMatchText: needle,
          source: "ai_detected",
        });
        starts.add(idx);
      }
      from = idx + 1;
    }
    return { ...item, occurrences: next };
  });
}

export function buildInitialArticleVocabulary(
  articlePlain: string,
  chunkIntervals: ChunkInterval[],
  seed: VocabEntry[],
): ArticleVocabItem[] {
  const items: ArticleVocabItem[] = [];
  for (const row of chunkIntervals) {
    const chunk = row.chunk;
    if (chunk.kind !== "vocab") continue;
    const surface = chunk.surface;
    const seedEntry = seed.find((v) => v.id === chunk.id);
    if (!seedEntry) continue;
    const norm = normalizeTextKey(surface);
    if (items.some((x) => x.normalized_key === norm)) continue;
    const senseId = `sense-${chunk.id}-default`;
    const sense: VocabSense = {
      id: senseId,
      zh_meaning: seedEntry.zh_meaning,
      simple_de_explanation: seedEntry.simple_de_explanation,
    };
    const occ: VocabOccurrence = {
      id: `occ-${chunk.id}-0`,
      surface_form: surface,
      sentence: extractSentence(articlePlain, row.start, row.end),
      start_offset: row.start,
      end_offset: row.end,
      fallbackMatchText: surface,
      source: "ai_detected",
      sense_id: senseId,
    };
    items.push({
      id: chunk.id,
      dbItemId: null,
      lemma: seedEntry.lemma,
      display_word: surface,
      normalized_key: norm,
      part_of_speech: seedEntry.part_of_speech,
      grammatical_gender: seedEntry.grammatical_gender ?? "na",
      zh_meaning: seedEntry.zh_meaning,
      simple_de_explanation: seedEntry.simple_de_explanation,
      mastery_status: seedEntry.mastery_status,
      source: "ai_detected",
      needs_ai_enrichment: false,
      senses: [sense],
      occurrences: [occ],
    });
  }
  return expandVocabItemsWithRepeatedSurface(items, articlePlain);
}

export function buildInitialArticleGrammar(
  articlePlain: string,
  chunkIntervals: ChunkInterval[],
  seed: GrammarEntry[],
): ArticleGrammarItem[] {
  const items: ArticleGrammarItem[] = [];
  for (const row of chunkIntervals) {
    const chunk = row.chunk;
    if (chunk.kind !== "grammar") continue;
    const surface = chunk.surface;
    const seedEntry = seed.find((g) => g.id === chunk.id);
    if (!seedEntry) continue;
    const norm = normalizeTextKey(surface);
    if (items.some((x) => x.normalized_key === norm)) continue;
    const occ: GrammarOccurrence = {
      id: `gocc-${chunk.id}-0`,
      surface_form: surface,
      sentence: extractSentence(articlePlain, row.start, row.end),
      start_offset: row.start,
      end_offset: row.end,
      fallbackMatchText: surface,
      source: "ai_detected",
    };
    items.push({
      id: chunk.id,
      dbItemId: null,
      grammar_key: seedEntry.grammar_key,
      name_de: seedEntry.name_de,
      name_zh: seedEntry.name_zh,
      explanation_zh: seedEntry.explanation_zh,
      mastery_status: seedEntry.mastery_status,
      source: "ai_detected",
      normalized_key: norm,
      occurrences: [occ],
    });
  }
  return expandGrammarItemsWithRepeatedSurface(items, articlePlain);
}

export function occurrencePositionKey(
  o: Pick<VocabOccurrence, "start_offset" | "end_offset" | "sentence" | "fallbackMatchText">,
): string {
  if (o.start_offset !== undefined && o.end_offset !== undefined) {
    return `${o.start_offset}-${o.end_offset}`;
  }
  return `${o.sentence}@@${o.fallbackMatchText}`;
}

/**
 * merge 阶段生成的 occurrence id 在全文扫描 finalize 后会变为 `${itemId}-${start}-${end}`；
 * 用合并前选中的 start/end 对齐到 finalize 后的列表。
 */
export function alignVocabOccurrenceIdAfterFinalize(
  itemId: string,
  preMergeItems: ArticleVocabItem[],
  mergeOccurrenceId: string,
  finalizedItems: ArticleVocabItem[],
): string {
  const preItem = preMergeItems.find((v) => v.id === itemId);
  const preOcc = preItem?.occurrences.find((o) => o.id === mergeOccurrenceId);
  const finalItem = finalizedItems.find((v) => v.id === itemId);
  if (!finalItem) return mergeOccurrenceId;
  if (!preOcc) return finalItem.occurrences[0]?.id ?? mergeOccurrenceId;
  if (preOcc.start_offset !== undefined && preOcc.end_offset !== undefined) {
    const hit = finalItem.occurrences.find(
      (o) =>
        o.start_offset === preOcc.start_offset &&
        o.end_offset === preOcc.end_offset,
    );
    if (hit) return hit.id;
  }
  return finalItem.occurrences[0]?.id ?? mergeOccurrenceId;
}

/** 持久化后 occurrence id 稳定为 `${uiItemId}-${start}-${end}`（与全文扫描一致），仍按 start/end 对齐用户选中处 */
export function alignVocabOccurrenceIdAfterPersist(
  preMergeOcc: VocabOccurrence | undefined,
  savedItem: ArticleVocabItem,
  fallbackId: string,
): string {
  if (!preMergeOcc) {
    return savedItem.occurrences[0]?.id ?? fallbackId;
  }
  if (
    preMergeOcc.start_offset !== undefined &&
    preMergeOcc.end_offset !== undefined
  ) {
    const hit = savedItem.occurrences.find(
      (o) =>
        o.start_offset === preMergeOcc.start_offset &&
        o.end_offset === preMergeOcc.end_offset,
    );
    if (hit) return hit.id;
  }
  return savedItem.occurrences[0]?.id ?? fallbackId;
}

export function mergeVocabOccurrence(
  items: ArticleVocabItem[],
  articlePlain: string,
  surface: string,
  resolved: { start: number; end: number; surface: string } | null,
): {
  nextItems: ArticleVocabItem[];
  itemId: string;
  occurrenceId: string;
} {
  const norm = normalizeTextKey(surface);
  const fallback = resolved?.surface ?? surface.trim();
  const sentence = resolved
    ? extractSentence(articlePlain, resolved.start, resolved.end)
    : "（未定位原文，手动添加）";

  const newOcc = (source: OccurrenceSource): VocabOccurrence => ({
    id: newEntityId("voc-occ"),
    surface_form: fallback,
    sentence,
    start_offset: resolved?.start,
    end_offset: resolved?.end,
    fallbackMatchText: fallback,
    source,
    sense_id: undefined,
  });

  const idx = items.findIndex((v) => v.normalized_key === norm);

  if (idx === -1) {
    const sense: VocabSense = {
      id: newEntityId("sense"),
      zh_meaning: "待 AI 补充",
      simple_de_explanation: "Wird später ergänzt.",
    };
    const occ = newOcc("user_added");
    occ.sense_id = sense.id;
    const item: ArticleVocabItem = {
      id: newEntityId("v-item"),
      dbItemId: null,
      lemma: fallback,
      display_word: fallback,
      normalized_key: norm,
      part_of_speech: "用户添加",
      grammatical_gender: "na",
      zh_meaning: "待 AI 补充",
      simple_de_explanation: "Wird später ergänzt.",
      mastery_status: "new",
      source: "user_added",
      needs_ai_enrichment: true,
      senses: [sense],
      occurrences: [occ],
    };
    return {
      nextItems: [...items, item],
      itemId: item.id,
      occurrenceId: occ.id,
    };
  }

  const item = items[idx]!;
  const occ = newOcc("user_added");
  const defaultSense = item.senses[0];
  occ.sense_id = defaultSense?.id;

  const dup = item.occurrences.some(
    (o) => occurrencePositionKey(o) === occurrencePositionKey(occ),
  );

  let source: ArticleVocabItem["source"] = item.source;
  if (
    item.source === "ai_detected" ||
    item.source === "ai_mock" ||
    item.source === "ai"
  ) {
    source = "ai_detected_then_user_confirmed";
  }

  const nextItems = [...items];
  if (!dup) {
    nextItems[idx] = {
      ...item,
      source,
      occurrences: [...item.occurrences, occ],
    };
    return { nextItems, itemId: item.id, occurrenceId: occ.id };
  }

  const existingOcc = item.occurrences.find(
    (o) => occurrencePositionKey(o) === occurrencePositionKey(occ),
  );
  return {
    nextItems: nextItems.map((v, i) =>
      i === idx ? { ...v, source } : v,
    ),
    itemId: item.id,
    occurrenceId: existingOcc?.id ?? item.occurrences[0]!.id,
  };
}

export function mergeGrammarOccurrence(
  items: ArticleGrammarItem[],
  articlePlain: string,
  surface: string,
  resolved: { start: number; end: number; surface: string } | null,
): {
  nextItems: ArticleGrammarItem[];
  itemId: string;
  occurrenceId: string;
} {
  const norm = normalizeTextKey(surface);
  const fallback = resolved?.surface ?? surface.trim();
  const sentence = resolved
    ? extractSentence(articlePlain, resolved.start, resolved.end)
    : "（未定位原文，手动添加）";

  const newOcc = (): GrammarOccurrence => ({
    id: newEntityId("g-occ"),
    surface_form: fallback,
    sentence,
    start_offset: resolved?.start,
    end_offset: resolved?.end,
    fallbackMatchText: fallback,
    source: "user_added",
  });

  const idx = items.findIndex((g) => g.normalized_key === norm);

  if (idx === -1) {
    const occ = newOcc();
    const item: ArticleGrammarItem = {
      id: newEntityId("g-item"),
      dbItemId: null,
      grammar_key: norm,
      name_de: fallback,
      name_zh: "用户标记的语法问题",
      explanation_zh: "待 AI 补充",
      mastery_status: "new",
      source: "user_added",
      normalized_key: norm,
      needs_ai_enrichment: true,
      occurrences: [occ],
    };
    return {
      nextItems: [...items, item],
      itemId: item.id,
      occurrenceId: occ.id,
    };
  }

  const item = items[idx]!;
  const occ = newOcc();
  const dup = item.occurrences.some(
    (o) => occurrencePositionKey(o) === occurrencePositionKey(occ),
  );

  let source: ArticleGrammarItem["source"] = item.source;
  if (
    item.source === "ai_detected" ||
    item.source === "ai_mock" ||
    item.source === "ai"
  ) {
    source = "ai_detected_then_user_confirmed";
  }

  const nextItems = [...items];
  if (!dup) {
    nextItems[idx] = {
      ...item,
      source,
      occurrences: [...item.occurrences, occ],
    };
    return { nextItems, itemId: item.id, occurrenceId: occ.id };
  }

  const existingOcc = item.occurrences.find(
    (o) => occurrencePositionKey(o) === occurrencePositionKey(occ),
  );
  return {
    nextItems: nextItems.map((g, i) => (i === idx ? { ...g, source } : g)),
    itemId: item.id,
    occurrenceId: existingOcc?.id ?? item.occurrences[0]!.id,
  };
}

/** 表单添加：无 Range 时在文中找首处匹配并记 occurrence，否则仅列表 */
export function mergeVocabFromFormText(
  items: ArticleVocabItem[],
  articlePlain: string,
  text: string,
): {
  nextItems: ArticleVocabItem[];
  itemId: string;
  occurrenceId: string;
} {
  const t = text.trim();
  if (!t) {
    return { nextItems: items, itemId: "", occurrenceId: "" };
  }
  const o = findBestTextOccurrence(articlePlain, t, 0);
  const resolved = o
    ? { start: o.start, end: o.end, surface: articlePlain.slice(o.start, o.end) }
    : null;
  return mergeVocabOccurrence(items, articlePlain, t, resolved);
}

export function mergeGrammarFromFormText(
  items: ArticleGrammarItem[],
  articlePlain: string,
  text: string,
): {
  nextItems: ArticleGrammarItem[];
  itemId: string;
  occurrenceId: string;
} {
  const t = text.trim();
  if (!t) {
    return { nextItems: items, itemId: "", occurrenceId: "" };
  }
  const o =
    findBestTextOccurrence(articlePlain, t, 0) ??
    findLooseWhitespaceOccurrence(articlePlain, t);
  const resolved = o
    ? { start: o.start, end: o.end, surface: articlePlain.slice(o.start, o.end) }
    : null;
  return mergeGrammarOccurrence(items, articlePlain, t, resolved);
}

export function overlappingAiVocabIdsForRange(
  start: number,
  end: number,
  chunkIntervals: ChunkInterval[],
): string[] {
  const ids: string[] = [];
  for (const row of chunkIntervals) {
    if (row.chunk.kind !== "vocab") continue;
    if (row.start < end && row.end > start) ids.push(row.chunk.id);
  }
  return ids;
}
