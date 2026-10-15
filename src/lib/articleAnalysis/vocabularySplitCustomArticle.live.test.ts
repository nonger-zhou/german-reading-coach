/**
 * 本地：对**你自己准备的一篇德文正文**跑 vocabulary 分析（含两次拆分）。
 * 不改生产 route / 不入库。
 *
 * 1. 把正文存成 UTF-8 文本，例如 scripts/fixtures/my-article.txt
 * 2. 确保 .env.local 里有 OPENAI_API_KEY
 *
 * PowerShell 示例：
 *   $env:NODE_OPTIONS='--use-system-ca'
 *   $env:VOCAB_SPLIT_LIVE='1'
 *   $env:VOCAB_SPLIT_FILE='scripts/fixtures/my-article.txt'
 *   $env:VOCAB_SPLIT_TITLE='可选：文章标题'
 *   $env:VOCAB_SPLIT_LEVEL='B1'
 *   npm run vocab-split:try
 *
 * 只跑拆分（省一次 API，不写生产对比）：
 *   $env:VOCAB_SPLIT_STRATEGIES='mini_split_reset_vocab,mini_split_minimal_b'
 *
 * 报告：scripts/vocabulary-split-custom-report.json
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  requestVocabularyForStrategy,
  type VocabularyExperimentStrategy,
} from "./articleAnalysisExperiments";
import {
  countExpressionTypeVocabulary,
  countVocabByBucket,
  formatVocabPosCounts,
  isVocabularyAllNounLike,
} from "./vocabularyRegressionDiagnostic";
import { createServerOpenAIClient } from "../openai/createServerOpenAIClient";

function loadEnvLocal(): void {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

const apiKey = process.env.OPENAI_API_KEY?.trim();
const splitFile = process.env.VOCAB_SPLIT_FILE?.trim();
const runLive =
  Boolean(apiKey) &&
  process.env.VOCAB_SPLIT_LIVE === "1" &&
  Boolean(splitFile);

const DEFAULT_STRATEGIES: VocabularyExperimentStrategy[] = [
  "mini_single",
  "mini_split_reset_vocab",
  "mini_split_minimal_b",
];

const STRATEGY_LABELS: Record<VocabularyExperimentStrategy, string> = {
  mini_single: "production_single_call",
  gpt4o_single: "gpt4o_single",
  mini_split: "split_reset_vocab_legacy_alias",
  mini_split_reset_vocab: "split_second_call_reset_vocab",
  mini_split_minimal_b: "split_second_call_minimal_b",
  mini_vocab_only_reset: "vocab_only_single_no_grammar_reset_v1",
  mini_vocab_only_minimal_b: "vocab_only_single_no_grammar_minimal_b",
};

function parseStrategies(): VocabularyExperimentStrategy[] {
  const raw = process.env.VOCAB_SPLIT_STRATEGIES?.trim();
  if (!raw) return DEFAULT_STRATEGIES;
  const allowed = new Set<VocabularyExperimentStrategy>([
    "mini_single",
    "mini_split_reset_vocab",
    "mini_split_minimal_b",
    "mini_split",
    "gpt4o_single",
    "mini_vocab_only_reset",
    "mini_vocab_only_minimal_b",
  ]);
  const picked = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is VocabularyExperimentStrategy =>
      allowed.has(s as VocabularyExperimentStrategy),
    );
  return picked.length > 0 ? picked : DEFAULT_STRATEGIES;
}

describe.runIf(runLive)("vocabulary split custom article (live)", () => {
  it("analyzes VOCAB_SPLIT_FILE with selected strategies", async () => {
    const filePath = resolve(process.cwd(), splitFile!);
    expect(existsSync(filePath)).toBe(true);
    const originalText = readFileSync(filePath, "utf8").trim();
    expect(originalText.length).toBeGreaterThan(80);

    const title =
      process.env.VOCAB_SPLIT_TITLE?.trim() ||
      filePath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, "") ||
      "Custom article";
    const userLevel = process.env.VOCAB_SPLIT_LEVEL?.trim() || "B1";
    const strategies = parseStrategies();

    const openai = createServerOpenAIClient({
      apiKey: apiKey!,
      timeout: 180_000,
      maxRetries: 1,
    });

    const runs: unknown[] = [];

    for (const strategy of strategies) {
      // eslint-disable-next-line no-console
      console.log(`\nRunning ${STRATEGY_LABELS[strategy]}...`);
      const vocab = await requestVocabularyForStrategy(openai, strategy, {
        title,
        originalText,
        userLevel,
      });
      expect(vocab.length).toBeGreaterThan(0);
      const counts = countVocabByBucket(vocab);
      // eslint-disable-next-line no-console
      console.log(
        STRATEGY_LABELS[strategy],
        formatVocabPosCounts(counts),
        `expressionTypes=${countExpressionTypeVocabulary(vocab)}`,
        `allNounLike=${isVocabularyAllNounLike(vocab)}`,
      );
      for (const v of vocab) {
        // eslint-disable-next-line no-console
        console.log(`  [${v.part_of_speech}] ${v.surface_form} → ${v.lemma}`);
      }
      runs.push({
        strategy: STRATEGY_LABELS[strategy],
        count: vocab.length,
        counts,
        expressionTypes: countExpressionTypeVocabulary(vocab),
        allNounLike: isVocabularyAllNounLike(vocab),
        items: vocab.map((v) => ({
          pos: v.part_of_speech,
          surface: v.surface_form,
          lemma: v.lemma,
          zh: v.zh_meaning,
        })),
      });
    }

    const report = {
      generatedAt: new Date().toISOString(),
      file: splitFile,
      title,
      userLevel,
      charCount: originalText.length,
      strategies: strategies.map((s) => STRATEGY_LABELS[s]),
      runs,
    };

    const outPath = resolve(
      process.cwd(),
      "scripts/vocabulary-split-custom-report.json",
    );
    writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
    // eslint-disable-next-line no-console
    console.log(`\nReport written: ${outPath}`);
  }, 600_000);
});

describe.runIf(!runLive)("vocabulary split custom article (skipped)", () => {
  it("needs VOCAB_SPLIT_LIVE=1, OPENAI_API_KEY, VOCAB_SPLIT_FILE", () => {
    if (!apiKey) {
      // eslint-disable-next-line no-console
      console.log("跳过：未设置 OPENAI_API_KEY（.env.local）");
    } else if (process.env.VOCAB_SPLIT_LIVE !== "1") {
      // eslint-disable-next-line no-console
      console.log("跳过：请设置 VOCAB_SPLIT_LIVE=1");
    } else if (!splitFile) {
      // eslint-disable-next-line no-console
      console.log("跳过：请设置 VOCAB_SPLIT_FILE=scripts/fixtures/你的文章.txt");
    }
    expect(true).toBe(true);
  });
});
