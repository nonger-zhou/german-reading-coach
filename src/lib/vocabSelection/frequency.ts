import { GERMAN_FREQUENCY_WORDS } from "./germanFrequencyData";

/** 词形 → 排名（1 = 最常用）；首次使用时构建，服务端常驻复用 */
let rankMap: Map<string, number> | null = null;

function getRankMap(): Map<string, number> {
  if (rankMap) return rankMap;
  const m = new Map<string, number>();
  const lines = GERMAN_FREQUENCY_WORDS.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const w = lines[i];
    if (w && !m.has(w)) m.set(w, i + 1);
  }
  rankMap = m;
  return m;
}

/** 词频表收录条数；不在表内的词视为「罕见」 */
export function frequencyListSize(): number {
  return getRankMap().size;
}

/** 常见屈折词尾：查不到原词时去掉词尾再查（verhandlungen → verhandlung） */
const INFLECTION_SUFFIXES = [
  "ern",
  "en",
  "em",
  "er",
  "es",
  "et",
  "st",
  "te",
  "n",
  "e",
  "s",
  "t",
];

/**
 * 单个德语词形的词频排名；查不到返回 undefined（罕见词/复合词/专名）。
 * 会尝试去掉常见屈折词尾，取能查到的最常用排名。
 */
export function rankOfWord(word: string): number | undefined {
  const w = word.trim().toLocaleLowerCase("de-DE");
  if (!w || /\s/.test(w)) return undefined;
  const direct = rankOfWordExact(w);
  /** 瑞士德语不用 ß（ausser / stösst / massgeblich）：查不到时按 ss → ß 再查 */
  if (!w.includes("ss")) return direct;
  const swiss = rankOfWordExact(w.replace(/ss/g, "ß"));
  if (swiss === undefined) return direct;
  return direct === undefined ? swiss : Math.min(direct, swiss);
}

function rankOfWordExact(w: string): number | undefined {
  const map = getRankMap();
  let best = map.get(w);
  for (const suf of INFLECTION_SUFFIXES) {
    if (w.length - suf.length < 3 || !w.endsWith(suf)) continue;
    const r = map.get(w.slice(0, -suf.length));
    if (r !== undefined && (best === undefined || r < best)) best = r;
  }
  return best;
}

const ARTICLE_PREFIX = /^(der|die|das|den|dem|des)\s+/;
const REFLEXIVE = /^(sich|\(sich\))\s+|\s+(sich|\(sich\))$/g;

/**
 * 统一比对键：小写、折叠空白、去掉开头冠词与 sich。
 * 用于「已掌握 / 学习中」判断，不再依赖模型生成的 normalized_key 与词性完全一致。
 */
export function vocabMatchKey(raw: string | null | undefined): string {
  return (raw ?? "")
    .trim()
    .toLocaleLowerCase("de-DE")
    .replace(/\s+/g, " ")
    .replace(ARTICLE_PREFIX, "")
    .replace(REFLEXIVE, "")
    .trim();
}

/** 是否为单个词（不含空格）；多词表达不按词频过滤 */
export function isSingleWord(key: string): boolean {
  return key.length > 0 && !/\s/.test(key);
}
