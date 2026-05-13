import { cleanArticleText } from "./cleanArticleText";

/**
 * 回归样例（瑞士德语媒体引号长标题）：首行 «…›…» 为文章标题，次行问句与第三行为 lead，
 * 作者重复一行应合并；发布时间保留在正文中。解析结果应为：
 * - suggestedTitle = 首行（含 « ‹ › »）
 * - suggestedSubtitle = 问句行 + Recruterin 行
 * - cleanedText 开头含副标题/作者/发布时间，且不重复首行标题全文。
 *
 * «Sagt jemand im Vorstellungsgespräch: ‹Mein Chef war schlecht›, ist das ein klares Warnsignal»
 * Wie entlarven Unternehmen ungeeignete Kandidaten in Zeiten von künstlicher Intelligenz?
 * Recruterin Mathusa Kandasamy von Twint verrät ihre Tricks. Und sie gibt Stellensuchenden Tipps.
 *
 * Sofiya Miroshnyk
 * Sofiya Miroshnyk
 * Publiziert: 02.02.2026, 14:15
 */

export type ParsedArticleFromRaw = {
  suggestedTitle: string | null;
  suggestedSubtitle: string | null;
  publishedAtLine: string | null;
  authorDisplay: string | null;
  cleanedText: string;
  originalCharCount: number;
  cleanedCharCount: number;
  removedLineCount: number;
};

function norm(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function collapseWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** 瑞士/德语纸媒常见：标题以法式引号或德式下引号开头，不应与版面面包屑「A › B › C」混淆 */
function looksLikeQuotedNewsHeadline(t: string): boolean {
  const s = t.trimStart();
  if (!s) return false;
  const c0 = s[0]!;
  // « » ‹ › „ " " ASCII "
  if (
    c0 === "«" ||
    c0 === "‹" ||
    c0 === "„" ||
    c0 === "\u201C" ||
    c0 === "\u201D" ||
    c0 === '"' ||
    c0 === "\u201E"
  ) {
    return true;
  }
  return false;
}

function isBreadcrumbLine(t: string): boolean {
  if (looksLikeQuotedNewsHeadline(t)) {
    return false;
  }
  if (t.length > 140) {
    return false;
  }
  const bc = (t.match(/[›»]/g) || []).length;
  if (bc >= 2) {
    return true;
  }
  if (/^\s*[^›»]{0,40}\s*›\s*.+›/.test(t)) {
    return true;
  }
  const gt = (t.match(/>/g) || []).length;
  if (gt >= 2 && t.length < 100) {
    return true;
  }
  return false;
}

function isPublishedLine(t: string): boolean {
  return /^(Publiziert|Aktualisiert|Veröffentlicht|Published|Zuletzt\s+aktualisiert)\s*:/i.test(
    t.trim(),
  );
}

function isAuthorLine(t: string): boolean {
  const s = t.trim();
  if (s.length === 0 || s.length > 120) {
    return false;
  }
  if (/^Von\s+.+$/i.test(s)) {
    return true;
  }
  if (
    /^[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+){1,3}$/.test(s) &&
    !/[.!?]\s/.test(s)
  ) {
    return true;
  }
  return false;
}

/** 用于合并重复署名（如 Von X 与 X、或卡片区多次出现） */
function authorKey(line: string): string {
  return line
    .trim()
    .replace(/^von\s+/i, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isBadTitleCandidate(t: string): boolean {
  const s = t.trim();
  if (s.length < 8 || s.length > 220) {
    return true;
  }
  if (!/[a-zA-ZäöüÄÖÜß]/.test(s)) {
    return true;
  }
  if (isPublishedLine(s)) {
    return true;
  }
  if (isAuthorLine(s)) {
    return true;
  }
  if (isBreadcrumbLine(s)) {
    return true;
  }
  if (/^\s*\d{1,2}\.\d{1,2}\.\d{4}/.test(s) && s.length < 40) {
    return true;
  }
  return false;
}

function findContentStart(trimmed: string[]): number {
  let i = 0;
  const n = trimmed.length;
  while (i < n && (trimmed[i] === "" || isBreadcrumbLine(trimmed[i]))) {
    i++;
  }
  while (i < n && isPublishedLine(trimmed[i])) {
    i++;
  }
  while (i < n && isAuthorLine(trimmed[i])) {
    i++;
  }
  return i;
}

function collectSubtitleLines(
  trimmed: string[],
  afterTitle: number,
): number[] {
  const indices: number[] = [];
  let j = afterTitle;
  const n = trimmed.length;
  while (j < n && trimmed[j] === "") {
    j++;
  }
  let total = 0;
  /** 标题后说明性 lead：常见 1～2 行（问句 + 导语），与正文长段区分 */
  const maxLines = 2;
  const maxChars = 520;
  while (j < n && indices.length < maxLines) {
    const line = trimmed[j];
    if (line === "") {
      break;
    }
    if (isPublishedLine(line) || isAuthorLine(line)) {
      break;
    }
    if (line.length > 260) {
      if (indices.length === 0) {
        indices.push(j);
      }
      break;
    }
    indices.push(j);
    total += line.length;
    if (total >= maxChars) {
      break;
    }
    j++;
  }
  return indices;
}

function findPublishedIndexGlobal(trimmed: string[]): number {
  for (let i = 0; i < trimmed.length; i++) {
    if (isPublishedLine(trimmed[i])) {
      return i;
    }
  }
  return -1;
}

function collectAuthorLines(
  trimmed: string[],
  structural: {
    titleIdx: number;
    subtitleIdxs: Set<number>;
    publishedIdx: number;
  },
): { display: string | null; block: string | null; excludeIndices: Set<number> } {
  const firstByKey = new Map<string, string>();
  const excludeIndices = new Set<number>();
  const cap = Math.min(trimmed.length, 500);
  for (let i = 0; i < cap; i++) {
    if (structural.titleIdx >= 0 && i === structural.titleIdx) {
      continue;
    }
    if (structural.publishedIdx >= 0 && i === structural.publishedIdx) {
      continue;
    }
    if (structural.subtitleIdxs.has(i)) {
      continue;
    }
    const line = trimmed[i];
    if (!isAuthorLine(line)) {
      continue;
    }
    const key = authorKey(line);
    if (!firstByKey.has(key)) {
      firstByKey.set(key, line.trim());
    }
    excludeIndices.add(i);
  }
  if (firstByKey.size === 0) {
    return { display: null, block: null, excludeIndices };
  }
  const lines = [...firstByKey.values()];
  return {
    display: lines.join(" · "),
    block: lines.join("\n\n"),
    excludeIndices,
  };
}

function stripLeadingTitleDuplicate(body: string, title: string | null): string {
  if (!title?.trim()) {
    return body;
  }
  const t = collapseWs(title.trim());
  const lines = body.split("\n");
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i].trim();
    if (raw === "") {
      i++;
      continue;
    }
    if (collapseWs(raw) === t) {
      lines.splice(i, 1);
      continue;
    }
    break;
  }
  return lines.join("\n").trim();
}

function bodyStartsWithNormalizedPrefix(body: string, prefix: string): boolean {
  const p = prefix.trim();
  if (!p) {
    return false;
  }
  const bodyLines = body.split("\n").map((l) => l.trim());
  const prefLines = p.split("\n").map((l) => l.trim()).filter(Boolean);
  if (prefLines.length === 0) {
    return false;
  }
  let bi = 0;
  for (const pl of prefLines) {
    while (bi < bodyLines.length && bodyLines[bi] === "") {
      bi++;
    }
    if (bi >= bodyLines.length) {
      return false;
    }
    if (collapseWs(bodyLines[bi]) !== collapseWs(pl)) {
      return false;
    }
    bi++;
  }
  return true;
}

function composeCleanedText(
  subtitle: string | null,
  authorBlock: string | null,
  publishedLine: string | null,
  cleanedBody: string,
  suggestedTitle: string | null,
): string {
  const bodyTrim = stripLeadingTitleDuplicate(cleanedBody, suggestedTitle);

  const parts: string[] = [];
  if (subtitle) {
    const sub = subtitle.trim();
    if (sub && !bodyStartsWithNormalizedPrefix(bodyTrim, sub)) {
      parts.push(sub);
    }
  }
  if (authorBlock) {
    const ab = authorBlock.trim();
    if (ab && !bodyStartsWithNormalizedPrefix(bodyTrim, ab)) {
      parts.push(ab);
    }
  }
  if (publishedLine) {
    const pl = publishedLine.trim();
    if (pl && !bodyTrim.includes(pl)) {
      parts.push(pl);
    }
  }
  parts.push(bodyTrim);
  return parts.filter(Boolean).join("\n\n").trim();
}

/**
 * 从粘贴的网页文本解析标题/副标题/作者/发布时间，并生成将写入 articles.original_text 的正文。
 * 作者与发布时间均不单独建库字段；作者署名去重后置于正文前部（保留原文样式，不强制「作者：」前缀）。
 */
export function parseArticleFromRawInput(raw: string): ParsedArticleFromRaw {
  const normalized = norm(raw);
  const originalCharCount = normalized.length;
  const lines = normalized.split("\n");
  const trimmed = lines.map((l) => l.trim());

  const start = findContentStart(trimmed);
  const excluded = new Set<number>();
  for (let k = 0; k < start; k++) {
    excluded.add(k);
  }

  let titleLineIdx = -1;
  let suggestedTitle: string | null = null;
  for (let k = start; k < Math.min(start + 6, trimmed.length); k++) {
    if (trimmed[k] === "") {
      continue;
    }
    if (!isBadTitleCandidate(trimmed[k])) {
      titleLineIdx = k;
      suggestedTitle = trimmed[k];
      break;
    }
  }

  if (titleLineIdx >= 0) {
    excluded.add(titleLineIdx);
  }

  const subtitleIdxs =
    titleLineIdx >= 0 ? collectSubtitleLines(trimmed, titleLineIdx + 1) : [];
  for (const si of subtitleIdxs) {
    excluded.add(si);
  }

  const suggestedSubtitle =
    subtitleIdxs.length > 0
      ? subtitleIdxs.map((i) => trimmed[i]).join("\n").trim() || null
      : null;

  const publishedIdx = findPublishedIndexGlobal(trimmed);
  if (publishedIdx >= 0) {
    excluded.add(publishedIdx);
  }
  const publishedAtLine =
    publishedIdx >= 0 ? trimmed[publishedIdx].trim() : null;

  const { display: authorDisplay, block: authorBlock, excludeIndices: authorExclude } =
    collectAuthorLines(trimmed, {
      titleIdx: titleLineIdx,
      subtitleIdxs: new Set(subtitleIdxs),
      publishedIdx: publishedIdx,
    });
  for (const ai of authorExclude) {
    excluded.add(ai);
  }

  const bodyChunks: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!excluded.has(i)) {
      bodyChunks.push(lines[i].trimEnd());
    }
  }
  const bodyRaw = bodyChunks.join("\n");

  const cleanedPass = cleanArticleText(bodyRaw);
  const cleanedBody = cleanedPass.cleanedText;
  const removedLineCount = cleanedPass.removedLineCount;

  const cleanedText = composeCleanedText(
    suggestedSubtitle,
    authorBlock,
    publishedAtLine,
    cleanedBody,
    suggestedTitle,
  );

  return {
    suggestedTitle,
    suggestedSubtitle,
    publishedAtLine,
    authorDisplay,
    cleanedText,
    originalCharCount,
    cleanedCharCount: cleanedText.length,
    removedLineCount,
  };
}

/** 与 {@link parseArticleFromRawInput} 相同（便于按「parsePasted」命名检索） */
export const parsePastedArticleText = parseArticleFromRawInput;
