/**
 * 德语选词回归（英语扩展的护栏）。
 *
 * 快照 `__snapshots__/german-regression.json` 是在加入英语之前、用当时**未改动**的德语选词代码生成的。
 * 之后任何改动只要让德语的候选词、分界线、提示词附录或过滤结果有一点变化，这里就会失败。
 * 若确实是有意调整德语选词，须在 DEVELOPMENT_LOG 写明原因后再用 `vitest -u` 更新快照。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AnalyzedVocabularyItem } from "@/lib/articleAnalysis/types";
import type { CefrLevel } from "@/lib/types";
import { buildUserVocabProfile, type UserVocabRow } from "./userVocabProfile";
import { applyVocabularySelection, planVocabularySelection } from "./selectVocabulary";

const FIXTURES = [
  "autodiebe-schweiz-article.txt",
  "gaullismus-article.txt",
  "meghan-article.txt",
  "msc-oil-article.txt",
  "news-short-article.txt",
];
const LEVELS: CefrLevel[] = ["A2", "B1", "B2", "C1"];

function row(partial: Partial<UserVocabRow>): UserVocabRow {
  return {
    lemma: null,
    display_word: null,
    normalized_key: null,
    part_of_speech: null,
    mastery_status: "new",
    source: "manual",
    zh_meaning: null,
    simple_de_explanation: null,
    gender: null,
    level_estimate: null,
    ...partial,
  };
}

/** 一个典型词库：学习中、已掌握、暂忽略、多词表达，带冠词 / sich 的 lemma */
const LIBRARY: UserVocabRow[] = [
  row({ lemma: "die Polizei", normalized_key: "polizei", mastery_status: "learning" }),
  row({ lemma: "der Diebstahl", normalized_key: "diebstahl", mastery_status: "learning" }),
  row({ lemma: "sich erholen", normalized_key: "erholen", mastery_status: "familiar" }),
  row({ lemma: "die Regierung", normalized_key: "regierung", mastery_status: "mastered" }),
  row({ lemma: "allerdings", normalized_key: "allerdings", mastery_status: "mastered" }),
  row({ lemma: "erheblich", normalized_key: "erheblich", mastery_status: "ignored" }),
  row({ lemma: "in Kraft treten", normalized_key: "in kraft treten", mastery_status: "learning" }),
  row({ lemma: "der Präsident", normalized_key: "präsident", mastery_status: "mastered", source: "ai" }),
];

/** 模拟模型输出：把每个候选词 + 一些常用词 / 已掌握词都当作模型推荐，检验确定性过滤 */
function fakeModelVocabulary(
  candidates: ReadonlyArray<{ surface: string }>,
): AnalyzedVocabularyItem[] {
  const base = (surface: string, lemma = surface): AnalyzedVocabularyItem => ({
    surface_form: surface,
    lemma,
    normalized_key: lemma.toLowerCase(),
    part_of_speech: "noun",
    grammatical_gender: "na",
    level_estimate: "B2",
    zh_meaning: "释义",
    simple_de_explanation: "",
    example_sentence: "",
    reason_for_selection: "",
  });
  return [
    ...candidates.slice(0, 40).map((c) => base(c.surface)),
    base("Haus", "das Haus"),
    base("Regierung", "die Regierung"),
    base("allerdings"),
    base("Merkel"),
    { ...base("UNO"), zh_meaning: "联合国（组织名）" },
  ];
}

function runFixture(name: string, level: CefrLevel) {
  const text = readFileSync(join(process.cwd(), "scripts/fixtures", name), "utf8");
  const profile = buildUserVocabProfile(level, LIBRARY);
  const plan = planVocabularySelection(text, profile);
  const result = applyVocabularySelection(fakeModelVocabulary(plan.candidates), plan, profile, text);
  return {
    cutoff: profile.cutoff,
    cutoffNote: profile.cutoffNote,
    knownKeys: [...profile.knownKeys].sort(),
    learningKeys: [...profile.learningKeys].sort(),
    candidates: plan.candidates.map((c) => [c.surface, c.rank ?? null, c.count, c.maybeProperName]),
    learningInArticle: plan.learningInArticle.map((l) => [l.key, l.surfaceInText, l.start, l.end]),
    promptAppendix: plan.promptAppendix,
    kept: result.vocabulary.map((v) => [v.surface_form, v.lemma, v.example_sentence]),
    droppedKnown: result.droppedKnown,
    droppedTooCommon: result.droppedTooCommon,
    droppedProperNames: result.droppedProperNames,
    addedLearning: result.addedLearning,
  };
}

describe("German vocabulary selection is unchanged by the English extension", () => {
  it("matches the pre-English snapshot for every fixture and level", async () => {
    const out: Record<string, unknown> = {};
    for (const f of FIXTURES) {
      for (const level of LEVELS) {
        out[`${f} @ ${level}`] = runFixture(f, level);
      }
    }
    await expect(JSON.stringify(out, null, 1)).toMatchFileSnapshot(
      "./__snapshots__/german-regression.json",
    );
  });
});
