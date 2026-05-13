/** AI / DB 统一使用的名词语法性（非名词类词条用 na） */
export type VocabGrammaticalGender = "na" | "m" | "f" | "n" | "unclear";

const GENDER_SET = new Set<string>(["na", "m", "f", "n", "unclear"]);

export function parseGrammaticalGender(raw: unknown): VocabGrammaticalGender {
  if (typeof raw !== "string") return "na";
  const k = raw.trim().toLowerCase();
  return GENDER_SET.has(k) ? (k as VocabGrammaticalGender) : "na";
}

export function isNounLikePartOfSpeech(raw: string | null | undefined): boolean {
  const k = (raw ?? "").trim().toLowerCase();
  if (!k || k === "—" || k === "-") return false;
  return (
    k === "noun" ||
    k === "compound_noun" ||
    k === "substantiv" ||
    k === "nomen" ||
    k.startsWith("subst") ||
    k.includes("substantiv") ||
    k.includes("名词") ||
    k.includes("nomen")
  );
}

/** lemma 是否以规范德语词典冠词开头（用于在 DB gender 缺失时推断展示） */
export function lemmaStartsWithGermanArticle(
  lemma: string | null | undefined,
): boolean {
  return /^\s*(der|die|das)\b/i.test(lemma ?? "");
}

/** 从 lemma 首冠词推断语法性；无冠词前缀时返回 na */
export function inferGrammaticalGenderFromLemmaArticle(
  lemma: string | null | undefined,
): VocabGrammaticalGender {
  const m = /^\s*(der|die|das)\b/i.exec(lemma ?? "");
  if (!m?.[1]) return "na";
  const a = m[1].toLowerCase();
  if (a === "der") return "m";
  if (a === "die") return "f";
  if (a === "das") return "n";
  return "na";
}

/** DB 字段优先；否则用 lemma 冠词推断 */
export function effectiveGrammaticalGender(
  lemma: string | null | undefined,
  stored: VocabGrammaticalGender | string | null | undefined,
): VocabGrammaticalGender {
  const g = parseGrammaticalGender(stored);
  if (g === "m" || g === "f" || g === "n" || g === "unclear") return g;
  return inferGrammaticalGenderFromLemmaArticle(lemma);
}

/**
 * 是否在词汇卡上展示「名词性」一行：显式 m/f/n/unclear、像名词的词类、或 lemma 带 der/die/das。
 * 避免仅因 part_of_speech 标成 phrase 等就隐藏已写入的性别。
 */
export function shouldShowGrammaticalGenderRow(
  partOfSpeech: string | null | undefined,
  lemma: string | null | undefined,
  stored: VocabGrammaticalGender | string | null | undefined,
): boolean {
  const g = parseGrammaticalGender(stored);
  if (g === "m" || g === "f" || g === "n" || g === "unclear") return true;
  if (lemmaStartsWithGermanArticle(lemma)) return true;
  return isNounLikePartOfSpeech(partOfSpeech);
}

/** 阅读页 / 列表统一用：优先 DB，其次 lemma 冠词 */
export function displayGrammaticalGenderLabelZh(
  lemma: string | null | undefined,
  stored: VocabGrammaticalGender | string | null | undefined,
): string {
  return grammaticalGenderLabelZh(effectiveGrammaticalGender(lemma, stored));
}

/** 去掉开头的 der/die/das（大小写不敏感），避免与自动补全的定冠词重复 */
export function stripLeadingDefiniteArticle(
  phrase: string | null | undefined,
): string {
  return (phrase ?? "").replace(/^\s*(der|die|das)\s+/i, "").trim();
}

/**
 * 词汇卡德语主标题：lemma 已带 der/die/das 则原样返回；
 * 若有效语法性为 m/f/n 且 lemma 非不定冠词开头，则拼「定冠词 + 词典形（lemma 空时退回 surface）」。
 */
export function vocabularyHeadwordDe(
  surfaceForm: string | null | undefined,
  lemma: string | null | undefined,
  storedGender: VocabGrammaticalGender | string | null | undefined,
): string {
  const surf = (surfaceForm ?? "").trim();
  const lem = (lemma ?? "").trim();
  const fallback = lem || surf;
  if (!fallback) return "";

  if (lemmaStartsWithGermanArticle(lem)) return lem;
  if (/^\s*(ein|eine|einen|einem|einer|eines)\b/i.test(lem)) return lem || fallback;

  const eff = effectiveGrammaticalGender(lem, storedGender);
  const article =
    eff === "m" ? "der" : eff === "f" ? "die" : eff === "n" ? "das" : null;
  if (!article) return fallback;

  const baseSource = lem || surf;
  const stripped = stripLeadingDefiniteArticle(baseSource);
  const core = stripped || baseSource;
  return `${article} ${core}`;
}

/** 主标题是否已以 der/die/das 开头（与 {@link vocabularyHeadwordDe} 一致），用于避免副标题重复「名词性：阳性（der）」等。 */
export function vocabHeadwordShowsLeadingDefiniteArticle(
  surfaceForm: string | null | undefined,
  lemma: string | null | undefined,
  storedGender: VocabGrammaticalGender | string | null | undefined,
): boolean {
  if (lemmaStartsWithGermanArticle(surfaceForm)) return true;
  if (lemmaStartsWithGermanArticle(lemma)) return true;
  const h = vocabularyHeadwordDe(surfaceForm, lemma, storedGender).trim();
  return /^(der|die|das)\b/i.test(h);
}

/**
 * 是否在副标题/列表中展示「名词性：…」说明：
 * 在 {@link shouldShowGrammaticalGenderRow} 为真时，若主标题已带定冠词则不再重复阴阳中性；
 * **`unclear`** 且标题无定冠词时仍展示「名词性未标注或不确定」。
 */
export function shouldShowGrammaticalGenderSubtitle(
  partOfSpeech: string | null | undefined,
  lemma: string | null | undefined,
  stored: VocabGrammaticalGender | string | null | undefined,
  surfaceForm: string | null | undefined,
): boolean {
  if (!shouldShowGrammaticalGenderRow(partOfSpeech, lemma, stored)) return false;
  if (vocabHeadwordShowsLeadingDefiniteArticle(surfaceForm, lemma, stored))
    return false;
  return true;
}

/** 中文 + 德语冠词，用于阅读页与 AI 预览 */
export function grammaticalGenderLabelZh(
  gender: VocabGrammaticalGender | string | null | undefined,
): string {
  const g = parseGrammaticalGender(gender);
  switch (g) {
    case "m":
      return "阳性（der）";
    case "f":
      return "阴性（die）";
    case "n":
      return "中性（das）";
    case "unclear":
      return "名词性未标注或不确定";
    default:
      return "—";
  }
}
