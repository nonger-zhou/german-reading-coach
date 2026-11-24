/**
 * 标题框为空时，用正文生成可保存的标题。
 * 截图识别、链接抓取、粘贴共用：先取第一句，过长则取前若干词，再限制字数。
 */

export const FALLBACK_ARTICLE_TITLE = "未命名文章";

/** 生成标题的最长字符数（含末尾省略号） */
export const DERIVED_TITLE_MAX_CHARS = 80;

/** 第一句太长时保留的词数（按空白分词） */
export const DERIVED_TITLE_MAX_WORDS = 10;

const ELLIPSIS = "…";

/** 句点属于缩写，不应当成第一句的结尾 */
const ABBREVIATIONS = new Set([
  "z.b",
  "d.h",
  "u.a",
  "usw",
  "bzw",
  "etc",
  "ca",
  "ggf",
  "evtl",
  "vgl",
  "dr",
  "prof",
  "nr",
  "mr",
  "mrs",
  "ms",
  "st",
  "no",
  "e.g",
  "i.e",
  "u.s",
  "u.k",
  "abs",
]);

function isAbbreviationOrDecimal(text: string, periodIndex: number): boolean {
  const prev = text[periodIndex - 1] ?? "";
  if (/\d/u.test(prev)) return true;

  let i = periodIndex - 1;
  while (i >= 0 && /[A-Za-zÄÖÜäöüß.]/u.test(text[i])) i -= 1;
  const token = text.slice(i + 1, periodIndex).toLowerCase();
  if (ABBREVIATIONS.has(token)) return true;
  if (/^[a-zäöü]$/u.test(token)) return true;
  return false;
}

/** 取压成一行之后的第一句；没有句末标点时返回整段 */
export function firstSentence(text: string): string {
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === ELLIPSIS || ch === "。" || ch === "！" || ch === "？") {
      return text.slice(0, i + 1).trim();
    }
    if (ch !== "." && ch !== "!" && ch !== "?") continue;
    if (ch === "." && text[i + 1] === ".") continue;
    if (ch === "." && isAbbreviationOrDecimal(text, i)) continue;
    const next = text[i + 1];
    if (next === undefined || /\s/u.test(next)) {
      return text.slice(0, i + 1).trim();
    }
  }
  return text.trim();
}

function finishTitle(text: string, cutWords: boolean): string {
  let s = text.replace(/\s+/g, " ").trim();
  if (!s) return FALLBACK_ARTICLE_TITLE;

  const tooLong = s.length > DERIVED_TITLE_MAX_CHARS;
  if (!cutWords && !tooLong) return s;

  const budget = DERIVED_TITLE_MAX_CHARS - ELLIPSIS.length;
  if (s.length > budget) {
    let cut = s.slice(0, budget);
    const space = cut.lastIndexOf(" ");
    if (space >= 24) cut = cut.slice(0, space);
    s = cut.trim();
  }
  s = s.replace(/[\s,;:.!?，。！？、]+$/u, "");
  if (!s) return FALLBACK_ARTICLE_TITLE;
  if (s.endsWith(ELLIPSIS)) {
    return s.length <= DERIVED_TITLE_MAX_CHARS ? s : s.slice(0, DERIVED_TITLE_MAX_CHARS);
  }
  const withMark = `${s}${ELLIPSIS}`;
  return withMark.length <= DERIVED_TITLE_MAX_CHARS
    ? withMark
    : withMark.slice(0, DERIVED_TITLE_MAX_CHARS);
}

/**
 * 从正文生成标题。
 * 空白正文返回「未命名文章」。否则用第一句；超过 10 个词或 80 字时截断并加上 …。
 */
export function deriveTitle(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (!flat) return FALLBACK_ARTICLE_TITLE;

  const sentence = firstSentence(flat);
  const words = sentence.split(" ").filter(Boolean);
  const cutWords = words.length > DERIVED_TITLE_MAX_WORDS;
  const head = cutWords ? words.slice(0, DERIVED_TITLE_MAX_WORDS).join(" ") : sentence;
  return finishTitle(head, cutWords);
}

/** 保存时使用的标题：手填优先，否则从正文生成 */
export function resolveArticleTitle(title: string, body: string): string {
  const typed = title.trim();
  if (typed) return typed;
  return deriveTitle(body);
}
