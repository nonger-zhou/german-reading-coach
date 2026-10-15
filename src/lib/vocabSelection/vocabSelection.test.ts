import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AnalyzedVocabularyItem } from "@/lib/articleAnalysis/types";
import { rankOfWord, vocabMatchKey } from "./frequency";
import {
  buildUserVocabProfile,
  computeAdaptiveCutoff,
  LEVEL_FREQUENCY_CUTOFF,
  type UserVocabRow,
} from "./userVocabProfile";
import { extractCandidateWords, findLearningWordsInArticle } from "./articleCandidates";
import { applyVocabularySelection, planVocabularySelection } from "./selectVocabulary";

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

function item(partial: Partial<AnalyzedVocabularyItem>): AnalyzedVocabularyItem {
  return {
    surface_form: "",
    lemma: "",
    normalized_key: "",
    part_of_speech: "noun",
    grammatical_gender: "na",
    level_estimate: "B2",
    zh_meaning: "",
    simple_de_explanation: "",
    example_sentence: "",
    reason_for_selection: "",
    ...partial,
  };
}

describe("frequency", () => {
  it("常用词排名靠前，罕见词靠后或不在表内", () => {
    expect(rankOfWord("haus")!).toBeLessThan(1000);
    expect(rankOfWord("Regierung")!).toBeLessThan(LEVEL_FREQUENCY_CUTOFF.B1);
    expect(rankOfWord("einräumen") ?? Infinity).toBeGreaterThan(LEVEL_FREQUENCY_CUTOFF.B1);
  });

  it("屈折变形回退到原形排名", () => {
    expect(rankOfWord("verhandlungen")!).toBeLessThanOrEqual(rankOfWord("verhandlung")!);
  });

  it("瑞士写法 ss 与 ß 同等对待", () => {
    expect(rankOfWord("ausser")).toBe(rankOfWord("außer"));
    expect(rankOfWord("massgeblich")).toBe(rankOfWord("maßgeblich"));
  });

  it("比对键去掉冠词、sich、大小写差异", () => {
    expect(vocabMatchKey("das Mandat")).toBe("mandat");
    expect(vocabMatchKey("  Die   Entscheidung ")).toBe("entscheidung");
    expect(vocabMatchKey("sich abzeichnen")).toBe("abzeichnen");
  });
});

describe("已掌握 / 学习中规则", () => {
  it("同一个词写法不同（带冠词、词性不同）也能识别为已掌握", () => {
    const profile = buildUserVocabProfile("B1", [
      row({ lemma: "das Mandat", normalized_key: "das mandat", part_of_speech: "noun", mastery_status: "mastered" }),
    ]);
    const plan = planVocabularySelection("Er legte sein Mandat nieder.", profile);
    const res = applyVocabularySelection(
      [item({ surface_form: "Mandat", lemma: "Mandat", normalized_key: "mandat", part_of_speech: "compound_noun" })],
      plan,
      profile,
      "Er legte sein Mandat nieder.",
    );
    expect(res.vocabulary).toHaveLength(0);
    expect(res.droppedKnown).toEqual(["Mandat"]);
  });

  it("学习中的词即使很常用也必须推荐；模型漏掉时从词库补上", () => {
    const text = "Die Regierung hat das Gesetz geändert.";
    const profile = buildUserVocabProfile("B1", [
      row({ lemma: "die Regierung", normalized_key: "die regierung", mastery_status: "learning", zh_meaning: "政府" }),
    ]);
    const plan = planVocabularySelection(text, profile);
    expect(plan.learningInArticle.map((l) => l.surfaceInText)).toEqual(["Regierung"]);
    const res = applyVocabularySelection([], plan, profile, text);
    expect(res.vocabulary).toHaveLength(1);
    expect(res.vocabulary[0].surface_form).toBe("Regierung");
    expect(res.vocabulary[0].zh_meaning).toBe("政府");
    expect(res.addedLearning).toEqual(["die Regierung"]);
  });

  it("学习中的词以变形出现也能认出", () => {
    const found = findLearningWordsInArticle("Die Verhandlungen dauern an.", [
      { key: "verhandlung", row: row({ lemma: "die Verhandlung" }) },
    ]);
    expect(found[0]?.surfaceInText).toBe("Verhandlungen");
  });

  it("同一词既有已掌握又有学习中记录时，学习中优先", () => {
    const profile = buildUserVocabProfile("B1", [
      row({ lemma: "Ziel", part_of_speech: "noun", mastery_status: "mastered" }),
      row({ lemma: "Ziel", part_of_speech: "", mastery_status: "learning" }),
    ]);
    expect(profile.knownKeys.has("ziel")).toBe(false);
    expect(profile.learningKeys.has("ziel")).toBe(true);
  });
});

describe("按分界线过滤", () => {
  it("比分界线常用的单词剔除，罕见词和多词表达保留", () => {
    const text = "Er räumte allerdings ein, dass die Lage unter Druck geraten sei.";
    const profile = buildUserVocabProfile("B1", []);
    const plan = planVocabularySelection(text, profile);
    const res = applyVocabularySelection(
      [
        item({ surface_form: "räumte … ein", lemma: "einräumen", part_of_speech: "separable_verb" }),
        item({ surface_form: "allerdings", lemma: "allerdings", part_of_speech: "adverb" }),
        item({ surface_form: "unter Druck geraten", lemma: "unter Druck geraten", part_of_speech: "fixed_expression" }),
      ],
      plan,
      profile,
      text,
    );
    expect(res.vocabulary.map((v) => v.lemma)).toEqual(["einräumen", "unter Druck geraten"]);
    expect(res.droppedTooCommon).toEqual(["allerdings"]);
  });

  it("候选词不含常用词与已掌握词", () => {
    const text = "Die Regierung will die Hürde senken und zudem Maßnahmen erwägen.";
    const profile = buildUserVocabProfile("B1", [
      row({ lemma: "die Hürde", mastery_status: "mastered" }),
    ]);
    const words = extractCandidateWords(text, profile).map((c) => c.surface.toLowerCase());
    expect(words).toContain("erwägen");
    expect(words).not.toContain("regierung");
    expect(words).not.toContain("hürde");
  });

  it("真实长文：候选词覆盖动词/形容词，不只是名词", () => {
    const text = readFileSync(join(process.cwd(), "scripts/fixtures/gaullismus-article.txt"), "utf8");
    const plan = planVocabularySelection(text, buildUserVocabProfile("B1", []));
    const lower = plan.candidates.filter((c) => c.surface[0] === c.surface[0].toLowerCase());
    expect(plan.candidates.length).toBeGreaterThan(20);
    expect(lower.length).toBeGreaterThan(5);
  });
});

describe("自适应分界线", () => {
  const base = LEVEL_FREQUENCY_CUTOFF.B1;
  it("样本不足时用等级默认值", () => {
    expect(computeAdaptiveCutoff(base, []).cutoff).toBe(base);
  });

  it("手动标出的学习中单词很多都比分界线常用 → 下调", () => {
    const common = ["krise", "behörde", "verhandlung", "abstimmung", "eindeutig", "vorerst", "erheblich", "gemeinde", "steuer", "anteil", "wirtschaft", "bevölkerung"];
    const rows = common.map((w) => row({ lemma: w, mastery_status: "learning", source: "manual" }));
    const { cutoff } = computeAdaptiveCutoff(base, rows);
    expect(cutoff).toBeLessThan(base);
    expect(cutoff).toBeGreaterThanOrEqual(base * 0.5);
  });

  it("AI 推荐保存的学习中词不参与下调（未必真不认识）", () => {
    const rows = Array.from({ length: 30 }, () => row({ lemma: "krise", mastery_status: "new", source: "ai" }));
    expect(computeAdaptiveCutoff(base, rows).cutoff).toBe(base);
  });
});
