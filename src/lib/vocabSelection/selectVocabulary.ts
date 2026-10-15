import type { AnalyzedVocabularyItem } from "@/lib/articleAnalysis/types";
import type { CefrLevel } from "@/lib/types";
import { parseGrammaticalGender } from "@/lib/vocabulary/grammaticalGender";
import { isSingleWord, rankOfWord, vocabMatchKey } from "./frequency";
import {
  extractCandidateWords,
  findLearningWordsInArticle,
  sentenceAround,
  type CandidateWord,
  type LearningWordInArticle,
} from "./articleCandidates";
import type { UserVocabProfile } from "./userVocabProfile";

/** 送进 prompt 的候选词上限（超长文防止 prompt 失控；罕见词优先） */
export const MAX_CANDIDATES_IN_PROMPT = 400;

export type VocabSelectionPlan = {
  candidates: CandidateWord[];
  learningInArticle: LearningWordInArticle[];
  promptAppendix: string;
};

function rankLabel(rank: number | undefined): string {
  return rank === undefined ? "罕见" : String(rank);
}

/** 程序侧准备：候选生词 + 文中出现的学习中词，并生成给模型的说明段 */
export function planVocabularySelection(
  text: string,
  profile: UserVocabProfile,
): VocabSelectionPlan {
  let candidates = extractCandidateWords(text, profile);
  if (candidates.length > MAX_CANDIDATES_IN_PROMPT) {
    candidates = [...candidates]
      .sort((a, b) => (b.rank ?? Infinity) - (a.rank ?? Infinity))
      .slice(0, MAX_CANDIDATES_IN_PROMPT);
  }
  const learningInArticle = findLearningWordsInArticle(text, profile.learningWords);

  const lines: string[] = [];
  lines.push("【用户词汇画像（程序计算，优先于你对 userLevel 的主观判断）】");
  lines.push(
    `- 用户水平 ${profile.level}。按词频估计：词频排名前 ${profile.cutoff} 的常用词，用户**已经认识**，不要推荐（除非出现在下方「必须推荐」里）。`,
  );
  lines.push(
    "- 单个词的推荐**只能**从下方【候选生词】中选（可还原为词典形输出 lemma）；候选里的人名、地名、机构名、媒体名跳过，其余凡是影响读懂文章的都要输出。",
  );
  lines.push(
    "- 动词、形容词、副词、连接词与名词**同等重要**，不要只挑名词；例如 allerdings、einräumen、erheblich 这类词对理解往往比主题名词更关键。",
  );
  lines.push(
    "- 多词表达（可分动词的句中形式、固定搭配、习语）：只要整体意思不能从单词直接推出，就可以推荐，即使其中每个单词都很常用。",
  );
  lines.push(
    "- **不设条数上限**：确实不认识的都推荐。vocabulary 数组按「对读懂这篇文章的重要程度」从高到低排列，最关键的放最前面。",
  );

  if (learningInArticle.length) {
    lines.push("");
    lines.push(
      "【必须推荐】用户词库中「学习中」且出现在正文的词，每个都必须输出一条（surface_form 用正文中的实际片段，lemma 用词典形）：",
    );
    for (const lw of learningInArticle) {
      lines.push(`${lw.row.lemma || lw.key}\t文中：${lw.surfaceInText}`);
    }
  }

  lines.push("");
  lines.push("【候选生词】每行：文中词形\t词频排名（「罕见」= 不在常用 8 万词内）");
  if (candidates.length) {
    for (const c of candidates) lines.push(`${c.surface}\t${rankLabel(c.rank)}`);
  } else {
    lines.push("（无：本文单词对该用户都较常用，只推荐必须推荐的词和意思不透明的多词表达）");
  }

  return { candidates, learningInArticle, promptAppendix: lines.join("\n") };
}

export type VocabSelectionResult = {
  vocabulary: AnalyzedVocabularyItem[];
  droppedKnown: string[];
  droppedTooCommon: string[];
  addedLearning: string[];
};

function itemKeys(item: AnalyzedVocabularyItem): string[] {
  const keys = new Set<string>();
  for (const raw of [item.lemma, item.normalized_key, item.surface_form]) {
    const k = vocabMatchKey(raw);
    if (k) keys.add(k);
  }
  return [...keys];
}

/** 单词条目的最常用排名（lemma / surface 取较常用者）；多词表达返回 undefined */
function itemRank(item: AnalyzedVocabularyItem): number | undefined {
  const lemmaKey = vocabMatchKey(item.lemma);
  if (!isSingleWord(lemmaKey)) return undefined;
  let best = rankOfWord(lemmaKey);
  const surfKey = vocabMatchKey(item.surface_form);
  if (isSingleWord(surfKey)) {
    const r = rankOfWord(surfKey);
    if (r !== undefined && (best === undefined || r < best)) best = r;
  }
  return best;
}

function learningItemFromRow(
  lw: LearningWordInArticle,
  text: string,
  level: CefrLevel,
): AnalyzedVocabularyItem {
  const row = lw.row;
  const lemma = (row.lemma || row.display_word || lw.surfaceInText).trim();
  const lev = (row.level_estimate ?? "").trim().toUpperCase();
  const levelEstimate = (["A1", "A2", "B1", "B2", "C1", "C2"].includes(lev) ? lev : level) as CefrLevel;
  return {
    surface_form: lw.surfaceInText,
    lemma,
    normalized_key: (row.normalized_key || lemma).trim().toLowerCase(),
    part_of_speech: row.part_of_speech ?? "",
    grammatical_gender: parseGrammaticalGender(row.gender ?? "na"),
    level_estimate: levelEstimate,
    zh_meaning: row.zh_meaning ?? "",
    simple_de_explanation: row.simple_de_explanation ?? "",
    example_sentence: sentenceAround(text, lw.start, lw.end),
    reason_for_selection: "你词库中「学习中」的词，本文再次出现。",
  };
}

/**
 * 模型输出后的确定性过滤（规则与用户确认一致）：
 * 1. 学习中的词：一定保留；模型漏掉的从词库补上；
 * 2. 已掌握 / 暂忽略：剔除；
 * 3. 其余单词：词频排名 ≤ 分界线（用户已认识）的剔除；多词表达保留。
 * 保留模型给出的重要性排序。
 */
export function applyVocabularySelection(
  vocabulary: ReadonlyArray<AnalyzedVocabularyItem>,
  plan: VocabSelectionPlan,
  profile: UserVocabProfile,
  text: string,
): VocabSelectionResult {
  const kept: AnalyzedVocabularyItem[] = [];
  const droppedKnown: string[] = [];
  const droppedTooCommon: string[] = [];
  const keptKeys = new Set<string>();

  for (const item of vocabulary) {
    const keys = itemKeys(item);
    if (keys.some((k) => keptKeys.has(k))) continue;
    const isLearning = keys.some((k) => profile.learningKeys.has(k));
    if (!isLearning) {
      if (keys.some((k) => profile.knownKeys.has(k))) {
        droppedKnown.push(item.lemma || item.surface_form);
        continue;
      }
      const r = itemRank(item);
      if (r !== undefined && r <= profile.cutoff) {
        droppedTooCommon.push(item.lemma || item.surface_form);
        continue;
      }
    }
    kept.push(item);
    keys.forEach((k) => keptKeys.add(k));
  }

  const addedLearning: string[] = [];
  for (const lw of plan.learningInArticle) {
    const covered =
      keptKeys.has(lw.key) ||
      keptKeys.has(vocabMatchKey(lw.surfaceInText)) ||
      keptKeys.has(vocabMatchKey(lw.row.display_word));
    if (covered) continue;
    kept.push(learningItemFromRow(lw, text, profile.level));
    keptKeys.add(lw.key);
    addedLearning.push(lw.row.lemma || lw.key);
  }

  return { vocabulary: kept, droppedKnown, droppedTooCommon, addedLearning };
}
