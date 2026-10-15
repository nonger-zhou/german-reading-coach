import { germanLexicon } from "./germanLexicon";
import type { VocabLexicon } from "./lexicon";
import type { LearningWord, UserVocabProfile } from "./userVocabProfile";

/** 兼容旧引用：德语分词与专名判断现位于 germanLexicon.ts */
export { tokenizeGerman, looksLikeProperNameToken } from "./germanLexicon";
export type { ArticleToken } from "./lexicon";

export type CandidateWord = {
  /** 文中第一次出现的写法 */
  surface: string;
  /** 词频排名；undefined = 不在常用词表内（罕见词 / 复合词 / 专名） */
  rank: number | undefined;
  count: number;
  /** 疑似专名（全大写缩写，或大写且不在词表、也拆不成已知复合词） */
  maybeProperName: boolean;
};

/**
 * 从正文提取「比用户分界线更少见」的候选生词（按首次出现顺序）。
 * 已掌握 / 暂忽略的词（含常见屈折变形）不进候选。
 */
export function extractCandidateWords(
  text: string,
  profile: Pick<UserVocabProfile, "cutoff" | "knownKeys"> & { lexicon?: VocabLexicon },
): CandidateWord[] {
  const lex = profile.lexicon ?? germanLexicon;
  const tokens = lex.tokenize(text);
  /** 全文大小写信号（英语判断专名用；德语忽略）：小写出现过的词形、句中大写出现过的词形 */
  const lowercaseForms = new Set<string>();
  const midSentenceCapitalized = new Set<string>();
  for (const t of tokens) {
    const lower = t.surface.toLocaleLowerCase(lex.locale);
    if (t.surface === lower) lowercaseForms.add(lower);
    else if (!isSentenceStart(text, t.start)) midSentenceCapitalized.add(lower);
  }
  const byLower = new Map<string, CandidateWord>();
  for (const t of tokens) {
    const lower = t.surface.toLocaleLowerCase(lex.locale);
    if (lower.length < 3) continue;
    const seen = byLower.get(lower);
    if (seen) {
      seen.count += 1;
      continue;
    }
    if (lex.isKnownToken(lower, profile.knownKeys)) continue;
    const rank = lex.rankOfWord(lower);
    if (rank !== undefined && rank <= profile.cutoff) continue;
    byLower.set(lower, {
      surface: t.surface,
      rank,
      count: 1,
      maybeProperName: lex.looksLikeProperNameToken(t.surface, {
        appearsLowercaseInText: lowercaseForms.has(lower),
        capitalizedMidSentence: midSentenceCapitalized.has(lower),
      }),
    });
  }
  return [...byLower.values()];
}

/** 位置 start 前（跳过空白、引号、括号）是否为文首 / 换行 / 句末标点 */
function isSentenceStart(text: string, start: number): boolean {
  for (let i = start - 1; i >= 0; i--) {
    const c = text[i];
    if (c === "\n") return true;
    if (/[\s"'“”‘’«»„()[\]\-–—]/.test(c)) continue;
    return /[.!?:;…]/.test(c);
  }
  return true;
}

export type LearningWordInArticle = LearningWord & {
  /** 文中实际出现的连续片段（用于 surface_form 与高亮） */
  surfaceInText: string;
  start: number;
  end: number;
};

/**
 * 找出用户「学习中」且在正文出现的词。
 * 单词：按词形 + 常见屈折词尾匹配；多词表达：按 display_word / lemma 原文子串（不区分大小写）匹配。
 */
export function findLearningWordsInArticle(
  text: string,
  learningWords: ReadonlyArray<LearningWord>,
  lex: VocabLexicon = germanLexicon,
): LearningWordInArticle[] {
  const tokens = lex.tokenize(text);
  const lowerText = text.toLocaleLowerCase(lex.locale);
  const out: LearningWordInArticle[] = [];

  for (const lw of learningWords) {
    const keys = new Set(
      [lw.key, lex.matchKey(lw.row.display_word), lex.matchKey(lw.row.normalized_key)].filter(Boolean),
    );
    let hit: { start: number; end: number } | null = null;

    for (const key of keys) {
      if (/\s/.test(key)) {
        const idx = lowerText.indexOf(key);
        if (idx >= 0) {
          hit = { start: idx, end: idx + key.length };
          break;
        }
        continue;
      }
      const tok = tokens.find((t) => lex.tokenMatchesKey(t.surface.toLocaleLowerCase(lex.locale), key));
      if (tok) {
        hit = { start: tok.start, end: tok.end };
        break;
      }
    }

    if (hit) {
      out.push({ ...lw, surfaceInText: text.slice(hit.start, hit.end), ...hit });
    }
  }
  return out;
}

/** 截取 [start, end) 所在句子，作为补充条目的例句 */
export function sentenceAround(text: string, start: number, end: number): string {
  const before = text.slice(0, start);
  const sStart = Math.max(
    before.lastIndexOf(". "),
    before.lastIndexOf("! "),
    before.lastIndexOf("? "),
    before.lastIndexOf("\n"),
  );
  const after = text.slice(end);
  const m = after.search(/[.!?](\s|$)|\n/);
  const sEnd = m >= 0 ? end + m + 1 : text.length;
  return text.slice(sStart >= 0 ? sStart + 1 : 0, sEnd).trim();
}
