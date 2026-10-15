import { rankOfWord, vocabMatchKey } from "./frequency";
import type { LearningWord, UserVocabProfile } from "./userVocabProfile";

const WORD_RE = /[A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)*/g;

/** 词形匹配时允许的屈折词尾（学习中词在文中以变形出现时也能认出来） */
const MATCH_SUFFIXES = ["", "e", "en", "n", "s", "es", "er", "em", "ern", "st", "t", "et", "te", "ten"];

export type ArticleToken = {
  surface: string;
  start: number;
  end: number;
};

export function tokenizeGerman(text: string): ArticleToken[] {
  const out: ArticleToken[] = [];
  for (const m of text.matchAll(WORD_RE)) {
    const start = m.index ?? 0;
    out.push({ surface: m[0], start, end: start + m[0].length });
  }
  return out;
}

export type CandidateWord = {
  /** 文中第一次出现的写法 */
  surface: string;
  /** 词频排名；undefined = 不在常用词表内（罕见词 / 复合词 / 专名） */
  rank: number | undefined;
  count: number;
};

function tokenMatchesKey(tokenLower: string, key: string): boolean {
  if (!tokenLower.startsWith(key)) return false;
  return MATCH_SUFFIXES.includes(tokenLower.slice(key.length));
}

function isKnownToken(tokenLower: string, knownKeys: Set<string>): boolean {
  if (knownKeys.has(tokenLower)) return true;
  for (const suf of MATCH_SUFFIXES) {
    if (suf && tokenLower.endsWith(suf) && knownKeys.has(tokenLower.slice(0, -suf.length))) {
      return true;
    }
  }
  return false;
}

/**
 * 从正文提取「比用户分界线更少见」的候选生词（按首次出现顺序）。
 * 已掌握 / 暂忽略的词（含常见屈折变形）不进候选。
 */
export function extractCandidateWords(
  text: string,
  profile: Pick<UserVocabProfile, "cutoff" | "knownKeys">,
): CandidateWord[] {
  const byLower = new Map<string, CandidateWord>();
  for (const t of tokenizeGerman(text)) {
    const lower = t.surface.toLocaleLowerCase("de-DE");
    if (lower.length < 3) continue;
    const seen = byLower.get(lower);
    if (seen) {
      seen.count += 1;
      continue;
    }
    if (isKnownToken(lower, profile.knownKeys)) continue;
    const rank = rankOfWord(lower);
    if (rank !== undefined && rank <= profile.cutoff) continue;
    byLower.set(lower, { surface: t.surface, rank, count: 1 });
  }
  return [...byLower.values()];
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
): LearningWordInArticle[] {
  const tokens = tokenizeGerman(text);
  const lowerText = text.toLocaleLowerCase("de-DE");
  const out: LearningWordInArticle[] = [];

  for (const lw of learningWords) {
    const keys = new Set(
      [lw.key, vocabMatchKey(lw.row.display_word), vocabMatchKey(lw.row.normalized_key)].filter(Boolean),
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
      const tok = tokens.find((t) => tokenMatchesKey(t.surface.toLocaleLowerCase("de-DE"), key));
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
