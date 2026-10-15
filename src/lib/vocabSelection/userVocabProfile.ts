import type { CefrLevel } from "@/lib/types";
import { isSingleWord, rankOfWord, vocabMatchKey } from "./frequency";

/**
 * 各等级默认「已认识」分界线（词频排名）：排名 ≤ 分界线的单词默认视为用户已认识。
 * 依据合并词频表实测校准，例如 Regierung≈656、Krise≈7100、Maßnahme≈10400、Umfrage≈20600。
 */
export const LEVEL_FREQUENCY_CUTOFF: Record<CefrLevel, number> = {
  A1: 2_000,
  A2: 4_000,
  B1: 8_000,
  B2: 14_000,
  C1: 22_000,
  C2: 32_000,
};

/** 自适应分界线需要的最少样本数（太少不调整，避免被个别词带偏） */
export const MIN_SAMPLES_TO_LOWER = 10;
export const MIN_SAMPLES_TO_RAISE = 20;

export type UserVocabRow = {
  lemma: string | null;
  display_word: string | null;
  normalized_key: string | null;
  part_of_speech: string | null;
  mastery_status: string | null;
  source: string | null;
  zh_meaning: string | null;
  simple_de_explanation: string | null;
  gender: string | null;
  level_estimate: string | null;
};

export type LearningWord = {
  key: string;
  row: UserVocabRow;
};

export type UserVocabProfile = {
  level: CefrLevel;
  /** 等级默认分界线 */
  levelCutoff: number;
  /** 结合用户标记自动校准后的分界线 */
  cutoff: number;
  /** 校准说明（写入日志 / warning） */
  cutoffNote: string;
  /** 已掌握 / 暂忽略（且没有同词的「学习中」记录）的比对键 */
  knownKeys: Set<string>;
  /** 学习中（new / learning / familiar）的词：只要出现在文中就必须推荐 */
  learningWords: LearningWord[];
  learningKeys: Set<string>;
};

function isMasteredOrIgnored(status: string | null | undefined): boolean {
  return status === "mastered" || status === "ignored";
}

function rowKeys(row: UserVocabRow): string[] {
  const keys = new Set<string>();
  for (const raw of [row.lemma, row.normalized_key, row.display_word]) {
    const k = vocabMatchKey(raw);
    if (k) keys.add(k);
  }
  return [...keys];
}

function rowRank(row: UserVocabRow): number | undefined {
  let best: number | undefined;
  for (const k of rowKeys(row)) {
    if (!isSingleWord(k)) continue;
    const r = rankOfWord(k);
    if (r !== undefined && (best === undefined || r < best)) best = r;
  }
  return best;
}

function quantile(sorted: number[], q: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
  return sorted[idx];
}

/**
 * 自适应分界线：
 * - 用户**手动**标出（学习中）的单词里，若不少比分界线还常用 → 分界线定高了，往下调到这些词排名的 25% 分位；
 * - 否则，若用户标「已掌握」的单词里有足够多比分界线更少见 → 往上调到这些词排名的 25% 分位；
 * - 调整范围限定在等级默认值的 0.5–2 倍。
 * 宁可多推（下调优先）：用户要求「多推荐没问题，只要确实不懂」。
 */
export function computeAdaptiveCutoff(
  levelCutoff: number,
  rows: ReadonlyArray<UserVocabRow>,
): { cutoff: number; note: string } {
  const minCut = Math.round(levelCutoff * 0.5);
  const maxCut = Math.round(levelCutoff * 2);

  const manualLearningRanks: number[] = [];
  const masteredRanks: number[] = [];
  for (const row of rows) {
    const r = rowRank(row);
    if (r === undefined) continue;
    if (isMasteredOrIgnored(row.mastery_status)) {
      if (row.mastery_status === "mastered") masteredRanks.push(r);
    } else if (row.source === "manual") {
      manualLearningRanks.push(r);
    }
  }
  manualLearningRanks.sort((a, b) => a - b);
  masteredRanks.sort((a, b) => a - b);

  const learningBelow = manualLearningRanks.filter((r) => r <= levelCutoff);
  if (
    manualLearningRanks.length >= MIN_SAMPLES_TO_LOWER &&
    learningBelow.length >= Math.ceil(manualLearningRanks.length * 0.25)
  ) {
    const target = Math.max(minCut, quantile(manualLearningRanks, 0.25));
    if (target < levelCutoff) {
      return {
        cutoff: target,
        note: `分界线下调：手动标记的 ${manualLearningRanks.length} 个学习中单词里有 ${learningBelow.length} 个比默认分界线更常用`,
      };
    }
  }

  const masteredAbove = masteredRanks.filter((r) => r > levelCutoff);
  if (masteredAbove.length >= MIN_SAMPLES_TO_RAISE) {
    const target = Math.min(maxCut, quantile(masteredAbove, 0.25));
    if (target > levelCutoff) {
      return {
        cutoff: target,
        note: `分界线上调：已掌握单词里有 ${masteredAbove.length} 个比默认分界线更少见`,
      };
    }
  }

  return { cutoff: levelCutoff, note: "使用等级默认分界线" };
}

export function buildUserVocabProfile(
  level: CefrLevel,
  rows: ReadonlyArray<UserVocabRow>,
): UserVocabProfile {
  const levelCutoff = LEVEL_FREQUENCY_CUTOFF[level];
  const { cutoff, note } = computeAdaptiveCutoff(levelCutoff, rows);

  const learningKeys = new Set<string>();
  const learningWords: LearningWord[] = [];
  const masteredKeys = new Set<string>();

  for (const row of rows) {
    const keys = rowKeys(row);
    if (!keys.length) continue;
    if (isMasteredOrIgnored(row.mastery_status)) {
      keys.forEach((k) => masteredKeys.add(k));
    } else {
      const main = vocabMatchKey(row.lemma) || keys[0];
      if (!learningKeys.has(main)) learningWords.push({ key: main, row });
      keys.forEach((k) => learningKeys.add(k));
    }
  }

  /** 同一个词既有已掌握又有学习中记录（不同词性等）时，学习中优先 */
  const knownKeys = new Set([...masteredKeys].filter((k) => !learningKeys.has(k)));

  return {
    level,
    levelCutoff,
    cutoff,
    cutoffNote: note,
    knownKeys,
    learningWords,
    learningKeys,
  };
}
