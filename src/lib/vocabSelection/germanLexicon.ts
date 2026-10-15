/**
 * 德语选词的语言知识。分词、词形匹配、复合词与专名判断的代码**原样**从 articleCandidates.ts 移来
 * （英语扩展前的实现，逐行未改），只在末尾组装成 VocabLexicon。德语行为由
 * germanRegression.test.ts 的快照保证不变。
 */
import { rankOfWord, vocabMatchKey } from "./frequency";
import type { ArticleToken, VocabLexicon } from "./lexicon";

const WORD_RE = /[A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)*/g;

/** 词形匹配时允许的屈折词尾（学习中词在文中以变形出现时也能认出来） */
const MATCH_SUFFIXES = ["", "e", "en", "n", "s", "es", "er", "em", "ern", "st", "t", "et", "te", "ten"];

export function tokenizeGerman(text: string): ArticleToken[] {
  const out: ArticleToken[] = [];
  for (const m of text.matchAll(WORD_RE)) {
    const start = m.index ?? 0;
    out.push({ surface: m[0], start, end: start + m[0].length });
  }
  return out;
}

/**
 * 复合词判断：能拆成 2–3 段都认识的词（允许连接成分 s / es / n / en / e），
 * 如 Untersuchungs|haft、Kanonen|boot|politik。人名如 Gianluigi 拆不出来。
 */
const FUGEN = ["", "s", "es", "n", "en", "e"];

function isKnownPart(part: string): boolean {
  return part.length >= 3 && rankOfWord(part) !== undefined;
}

function looksLikeCompoundOfKnownWords(lower: string, depth = 0): boolean {
  if (depth > 2) return false;
  for (let i = 3; i <= lower.length - 3; i++) {
    const head = lower.slice(0, i);
    const tail = lower.slice(i);
    const tailOk =
      isKnownPart(tail) || (depth < 2 && looksLikeCompoundOfKnownWords(tail, depth + 1));
    if (!tailOk) continue;
    for (const f of FUGEN) {
      if (f && !head.endsWith(f)) continue;
      const stem = f ? head.slice(0, -f.length) : head;
      if (isKnownPart(stem)) return true;
    }
  }
  return false;
}

export function looksLikeProperNameToken(surface: string): boolean {
  if (surface.length >= 2 && surface === surface.toUpperCase() && /[A-ZÄÖÜ]/.test(surface)) {
    return true;
  }
  if (!/^[A-ZÄÖÜ]/.test(surface)) return false;
  const lower = surface.toLocaleLowerCase("de-DE");
  if (rankOfWord(lower) !== undefined) return false;
  return !looksLikeCompoundOfKnownWords(lower);
}

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
 * 各等级默认「已认识」分界线（词频排名）：排名 ≤ 分界线的单词默认视为用户已认识。
 * 依据合并词频表实测校准，例如 Regierung≈656、Krise≈7100、Maßnahme≈10400、Umfrage≈20600。
 */
export const GERMAN_LEVEL_FREQUENCY_CUTOFF = {
  A1: 2_000,
  A2: 4_000,
  B1: 8_000,
  B2: 14_000,
  C1: 22_000,
  C2: 32_000,
} as const;

export const germanLexicon: VocabLexicon = {
  language: "de",
  locale: "de-DE",
  levelCutoff: GERMAN_LEVEL_FREQUENCY_CUTOFF,
  tokenize: tokenizeGerman,
  rankOfWord,
  matchKey: vocabMatchKey,
  isKnownToken: (tokenLower, knownKeys) => isKnownToken(tokenLower, knownKeys as Set<string>),
  tokenMatchesKey,
  /** 德语名词都大写，「文中也有小写」不能说明不是专名，故不使用第二个参数 */
  looksLikeProperNameToken: (surface) => looksLikeProperNameToken(surface),
  prompt: {
    partsOfSpeechLine:
      "- 动词、形容词、副词、连接词与名词**同等重要**，不要只挑名词；例如 allerdings、einräumen、erheblich 这类词对理解往往比主题名词更关键。",
    multiWordLine:
      "- 多词表达（可分动词的句中形式、固定搭配、习语）：只要整体意思不能从单词直接推出，就可以推荐，即使其中每个单词都很常用。",
    candidatesHeader:
      "【候选生词】每行：文中词形\t词频排名（「罕见」= 不在常用 8 万词内）；标「疑似专名」的多为人名、地名、机构、政党、品牌，确认是专名就跳过，只有本身是普通词汇（如 Eidgenossenschaft）才推荐",
  },
};
