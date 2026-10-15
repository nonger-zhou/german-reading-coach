/**
 * 英语选词的语言知识：分词、词频、词形还原、专名判断与提示词示例。
 * 选词规则与德语相同（见 selectVocabulary.ts），这里只提供英语本身的差异：
 * - 词形变化少但不规则多：规则词尾（-s/-es/-ies、-ed/-ied、-ing、-er/-est）+ 常用不规则词表；
 * - 英式 / 美式拼写（colour / color、organise / organize、centre / center）视为同一词；
 * - 名词不大写：大写且文中从未小写出现、又不在词表里的才疑似专名；
 * - 连字符复合词（long-term）按各部分中最少见的那个排名，各部分都认识就不算生词。
 */
import type { CefrLevel } from "@/lib/types";
import { ENGLISH_FREQUENCY_WORDS } from "./englishFrequencyData";
import type { ArticleToken, ProperNameContext, VocabLexicon } from "./lexicon";

const LOCALE = "en-US";

/**
 * 各等级默认「已认识」分界线（词频排名，按词形计）。按 PRD §1.5.3 对照表的词汇量、用代表词实测标定：
 * - A2（高考约 3500 词）：weather≈2600、borrow≈3400、holiday≈3400
 * - B1（四级约 4500 词）：environment≈2100、improve≈3300、pollution≈7800
 * - B2（六级 / 考研约 5500–6000 词）：consequence≈7400、inevitable≈8900、reluctant≈12000、assess≈12400
 * - C1（专八约 13000 词）：unprecedented≈12700、scrutiny≈15900、undermine≈18900、mitigate≈21800、entrenched≈25900
 * - C2：ubiquitous≈24200、idiosyncratic≈36500
 * 词表按词形计数、且含人名地名，所以排名大于对照表的词汇量；用户标记后会自动校准（0.5–2 倍）。
 */
export const ENGLISH_LEVEL_FREQUENCY_CUTOFF: Record<CefrLevel, number> = {
  A1: 2_500,
  A2: 5_000,
  B1: 8_000,
  B2: 13_000,
  C1: 25_000,
  C2: 40_000,
};

let rankMap: Map<string, number> | null = null;

function getRankMap(): Map<string, number> {
  if (rankMap) return rankMap;
  const m = new Map<string, number>();
  const lines = ENGLISH_FREQUENCY_WORDS.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const w = lines[i];
    if (w && !m.has(w)) m.set(w, i + 1);
  }
  rankMap = m;
  return m;
}

/** 常用不规则形式 → 原形（只收会影响判断的高频词） */
const IRREGULAR: Record<string, string> = {
  // 动词
  was: "be", were: "be", been: "be", is: "be", are: "be", am: "be",
  had: "have", has: "have", did: "do", does: "do", done: "do",
  went: "go", gone: "go", goes: "go", made: "make", said: "say", says: "say",
  took: "take", taken: "take", came: "come", saw: "see", seen: "see",
  knew: "know", known: "know", got: "get", gotten: "get", gave: "give", given: "give",
  found: "find", thought: "think", told: "tell", became: "become", left: "leave",
  felt: "feel", brought: "bring", began: "begin", begun: "begin", kept: "keep",
  held: "hold", wrote: "write", written: "write", stood: "stand", heard: "hear",
  meant: "mean", met: "meet", ran: "run", paid: "pay", sat: "sit", spoke: "speak",
  spoken: "speak", led: "lead", grew: "grow", grown: "grow", lost: "lose",
  fell: "fall", fallen: "fall", sent: "send", built: "build", understood: "understand",
  drew: "draw", drawn: "draw", broke: "break", broken: "break", spent: "spend",
  rose: "rise", risen: "rise", drove: "drive", driven: "drive", bought: "buy",
  wore: "wear", worn: "wear", chose: "choose", chosen: "choose", sought: "seek",
  threw: "throw", thrown: "throw", caught: "catch", dealt: "deal", won: "win",
  fought: "fight", taught: "teach", sold: "sell", struck: "strike", hid: "hide",
  hidden: "hide", shook: "shake", shaken: "shake", froze: "freeze", frozen: "freeze",
  forgave: "forgive", forgiven: "forgive", withdrew: "withdraw", withdrawn: "withdraw",
  undertook: "undertake", undertaken: "undertake", overcame: "overcome",
  forbade: "forbid", forbidden: "forbid", bore: "bear", borne: "bear",
  swore: "swear", sworn: "swear", tore: "tear", torn: "tear", bound: "bind",
  sank: "sink", sunk: "sink", sprang: "spring", sprung: "spring", fled: "flee",
  slid: "slide", stuck: "stick", stung: "sting", swept: "sweep", wept: "weep",
  dug: "dig", fed: "feed", bred: "breed", bled: "bleed", lent: "lend", bent: "bend",
  // 名词复数
  men: "man", women: "woman", children: "child", people: "person", feet: "foot",
  teeth: "tooth", mice: "mouse", geese: "goose", crises: "crisis", analyses: "analysis",
  theses: "thesis", hypotheses: "hypothesis", phenomena: "phenomenon", criteria: "criterion",
  data: "datum", media: "medium",
  // 形容词比较级
  better: "good", best: "good", worse: "bad", worst: "bad", further: "far",
  farther: "far", furthest: "far", less: "little", least: "little", more: "much", most: "much",
};

const VOWELS = "aeiou";

function isDoubledConsonantEnd(stem: string): boolean {
  const n = stem.length;
  return n >= 3 && stem[n - 1] === stem[n - 2] && !VOWELS.includes(stem[n - 1]) && stem[n - 1] !== "s";
}

/** 英式 → 美式拼写变体（只做最常见的几类） */
function spellingVariants(w: string): string[] {
  const out: string[] = [];
  if (w.length >= 6 && /our/.test(w)) out.push(w.replace(/our(s|ed|ing|ite|ites|able|ably|ful)?$/, "or$1"));
  if (/is(e|es|ed|ing|ation|ations|er|ers)$/.test(w)) out.push(w.replace(/is(e|es|ed|ing|ation|ations|er|ers)$/, "iz$1"));
  if (/ys(e|es|ed|ing)$/.test(w)) out.push(w.replace(/ys(e|es|ed|ing)$/, "yz$1"));
  if (/tre(s)?$/.test(w)) out.push(w.replace(/tre(s)?$/, "ter$1"));
  if (/ll(ed|ing|er|ers)$/.test(w)) out.push(w.replace(/ll(ed|ing|er|ers)$/, "l$1"));
  if (/ogue(s)?$/.test(w)) out.push(w.replace(/ogue(s)?$/, "og$1"));
  if (/ence$/.test(w) && /(def|off|lic|pret)ence$/.test(w)) out.push(w.replace(/ence$/, "ense"));
  return out.filter((v) => v !== w);
}

/** 统一撇号、去掉所有格 's，缩写只取撇号前部分（don't → don） */
function stripApostrophe(w: string): string {
  const s = w.replace(/’/g, "'");
  if (s.endsWith("'s")) return s.slice(0, -2);
  if (s.endsWith("s'")) return s.slice(0, -1);
  const i = s.indexOf("'");
  return i > 0 ? s.slice(0, i) : s;
}

/**
 * 词形 → 可能的原形（含自身），分两组：
 * - `reliable`：屈折变化（-s/-ed/不规则/拼写变体），排名取最常用者；
 * - `risky`：-ing、-er、-est 可能其实是另一个名词（herring、banner、lager），只在该词形本身不在词表里时才用。
 *   若词表里有对应的「兄弟形式」证明确是动词 / 形容词变化（borrowing ↔ borrowed、bigger ↔ biggest），
 *   则归入 reliable（banner 没有 bannest，lager 没有 lagest，herring 没有 herred）。
 */
function lemmaCandidates(word: string): { reliable: string[]; risky: string[] } {
  const w = stripApostrophe(word.toLocaleLowerCase(LOCALE));
  const reliable = new Set<string>([w]);
  const risky = new Set<string>();
  const add = (set: Set<string>, stem: string) => {
    if (stem.length >= 3) set.add(stem);
  };
  const irr = IRREGULAR[w];
  if (irr) reliable.add(irr);

  // 复数 / 第三人称
  if (w.endsWith("ies") && w.length > 4) add(reliable, w.slice(0, -3) + "y");
  else if (w.endsWith("ves") && w.length > 4) {
    add(reliable, w.slice(0, -3) + "f");
    add(reliable, w.slice(0, -3) + "fe");
  }
  if (/(ss|x|z|ch|sh|o)es$/.test(w)) add(reliable, w.slice(0, -2));
  if (w.endsWith("s") && !/(ss|us|is|ous)$/.test(w)) add(reliable, w.slice(0, -1));

  // 过去式 / 过去分词
  if (w.endsWith("ied") && w.length > 4) add(reliable, w.slice(0, -3) + "y");
  else if (w.endsWith("ed")) {
    const stem = w.slice(0, -2);
    add(reliable, stem);
    add(reliable, stem + "e");
    if (isDoubledConsonantEnd(stem)) add(reliable, stem.slice(0, -1));
  }

  const map = getRankMap();

  // 现在分词 / 动名词
  if (w.endsWith("ing") && w.length > 5) {
    const target = map.has(w.slice(0, -3) + "ed") ? reliable : risky;
    if (w.endsWith("ying")) add(target, w.slice(0, -4) + "ie");
    const stem = w.slice(0, -3);
    add(target, stem);
    add(target, stem + "e");
    if (isDoubledConsonantEnd(stem)) add(target, stem.slice(0, -1));
  }

  // 比较级 / 最高级
  const sibling = w.endsWith("est") ? w.slice(0, -3) + "er" : w.endsWith("er") ? w.slice(0, -2) + "est" : "";
  const cmpTarget = sibling && map.has(sibling) ? reliable : risky;
  if (w.endsWith("ier") || w.endsWith("iest")) add(cmpTarget, w.replace(/i(er|est)$/, "y"));
  else if (w.endsWith("er") || w.endsWith("est")) {
    const stem = w.replace(/(er|est)$/, "");
    add(cmpTarget, stem);
    add(cmpTarget, stem + "e");
    if (isDoubledConsonantEnd(stem)) add(cmpTarget, stem.slice(0, -1));
  }

  for (const set of [reliable, risky]) {
    for (const c of [...set]) for (const v of spellingVariants(c)) set.add(v);
  }
  return { reliable: [...reliable], risky: [...risky] };
}

function rankOfSingleWord(word: string): number | undefined {
  const map = getRankMap();
  const { reliable, risky } = lemmaCandidates(word);
  let best: number | undefined;
  for (const c of reliable) {
    const r = map.get(c);
    if (r !== undefined && (best === undefined || r < best)) best = r;
  }
  if (best === undefined) {
    for (const c of risky) {
      const r = map.get(c);
      if (r !== undefined && (best === undefined || r < best)) best = r;
    }
  }
  return best;
}

/**
 * 单个英语词形的词频排名；查不到返回 undefined（罕见词 / 专名）。
 * 连字符复合词：各部分都在词表里时取最少见部分的排名（long-term 视为常用），否则 undefined。
 */
export function rankOfEnglishWord(word: string): number | undefined {
  const w = word.trim().toLocaleLowerCase(LOCALE);
  if (!w || /\s/.test(w)) return undefined;
  if (w.includes("-")) {
    const parts = w.split("-").filter(Boolean);
    if (!parts.length) return undefined;
    let worst = 0;
    for (const p of parts) {
      const r = p.length < 3 ? (getRankMap().get(p) ?? 1) : rankOfSingleWord(p);
      if (r === undefined) return undefined;
      worst = Math.max(worst, r);
    }
    return worst;
  }
  return rankOfSingleWord(w);
}

const WORD_RE = /[A-Za-z]+(?:['’][A-Za-z]+)*(?:-[A-Za-z]+(?:['’][A-Za-z]+)*)*/g;

export function tokenizeEnglish(text: string): ArticleToken[] {
  const out: ArticleToken[] = [];
  for (const m of text.matchAll(WORD_RE)) {
    const start = m.index ?? 0;
    out.push({ surface: m[0], start, end: start + m[0].length });
  }
  return out;
}

const LEADING_FUNCTION_WORD = /^(to|the|a|an)\s+/;
const PLACEHOLDERS = /\s*\((sth|sb|something|somebody|someone|oneself)\)|\s+(sth|sb|something|somebody|someone|oneself)$/g;

/**
 * 英语比对键：小写、统一撇号、折叠空白，去掉开头的 to / the / a / an、括号里的 sth / sb 占位。
 * "to carry out" / "carry out (sth)" / "Carry out" → "carry out"。
 */
export function englishMatchKey(raw: string | null | undefined): string {
  return (raw ?? "")
    .trim()
    .toLocaleLowerCase(LOCALE)
    .replace(/’/g, "'")
    .replace(/\s+/g, " ")
    .replace(LEADING_FUNCTION_WORD, "")
    .replace(PLACEHOLDERS, "")
    .trim();
}

/** 词形匹配只用可靠的还原（banner 不算 ban 的变形） */
function formsOf(tokenLower: string): string[] {
  return lemmaCandidates(tokenLower).reliable;
}

function isKnownEnglishToken(tokenLower: string, knownKeys: ReadonlySet<string>): boolean {
  return formsOf(tokenLower).some((f) => knownKeys.has(f));
}

function englishTokenMatchesKey(tokenLower: string, key: string): boolean {
  return formsOf(tokenLower).includes(key);
}

/**
 * 疑似专名（只对候选生词调用，即比分界线少见的词）：
 * - 全大写缩写（NATO、BBC）；
 * - 首字母大写、文中从未以小写出现，并且「在句中大写出现过」（Starmer、Kyiv，即使在词表里）
 *   或「不在词表里」。句首大写的普通词（文中别处有小写）不算。
 */
export function looksLikeEnglishProperName(surface: string, ctx: ProperNameContext): boolean {
  if (surface.length >= 2 && surface === surface.toUpperCase() && /[A-Z]/.test(surface)) return true;
  if (!/^[A-Z]/.test(surface)) return false;
  if (ctx.appearsLowercaseInText) return false;
  if (ctx.capitalizedMidSentence) return true;
  return rankOfEnglishWord(surface) === undefined;
}

export const englishLexicon: VocabLexicon = {
  language: "en",
  locale: LOCALE,
  levelCutoff: ENGLISH_LEVEL_FREQUENCY_CUTOFF,
  tokenize: tokenizeEnglish,
  rankOfWord: rankOfEnglishWord,
  matchKey: englishMatchKey,
  isKnownToken: isKnownEnglishToken,
  tokenMatchesKey: englishTokenMatchesKey,
  looksLikeProperNameToken: looksLikeEnglishProperName,
  prompt: {
    partsOfSpeechLine:
      "- 动词、形容词、副词、连接词与名词**同等重要**，不要只挑名词；例如 albeit、concede、substantial、nonetheless 这类词对理解往往比主题名词更关键。",
    multiWordLine:
      "- 多词表达（phrasal verbs 如 rule out / carry out / step down、固定搭配、习语、介词搭配如 in the wake of）：只要整体意思不能从单词直接推出，就可以推荐，即使其中每个单词都很常用。",
    candidatesHeader:
      "【候选生词】每行：文中词形\t词频排名（「罕见」= 不在常用 8 万词内）；标「疑似专名」的多为人名、地名、机构、政党、品牌，确认是专名就跳过，只有本身是普通词汇（如 Commonwealth、Parliament）才推荐",
  },
};
