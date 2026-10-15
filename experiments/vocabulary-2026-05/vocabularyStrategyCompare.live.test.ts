/**
 * 本地对比：方案 2（gpt-4o 单次）vs 方案 3（mini 拆分 vocabulary）vs 基线（mini 单次）
 * 运行：$env:VOCAB_STRATEGY_COMPARE_LIVE='1'; npx vitest run --config vitest.live.config.ts src/lib/articleAnalysis/vocabularyStrategyCompare.live.test.ts --testTimeout=900000
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
const runLive =
  Boolean(apiKey) && process.env.VOCAB_STRATEGY_COMPARE_LIVE === "1";

function loadFixture(name: string): string {
  const p = resolve(process.cwd(), "scripts/fixtures", name);
  return existsSync(p) ? readFileSync(p, "utf8").trim() : "";
}

const STRATEGIES: VocabularyExperimentStrategy[] = [
  "mini_single",
  "gpt4o_single",
  "mini_split",
];

const CASES = [
  {
    label: "short-news",
    title: "Bundesregierung beschließt neue Klimaziele",
    file: "news-short-article.txt",
  },
  {
    label: "gaullismus",
    title: "Für einen europäischen Gaullismus",
    file: "gaullismus-article.txt",
  },
] as const;

function logReport(
  strategy: VocabularyExperimentStrategy,
  caseLabel: string,
  vocab: Awaited<ReturnType<typeof requestVocabularyForStrategy>>,
) {
  const counts = countVocabByBucket(vocab);
  const expr = countExpressionTypeVocabulary(vocab);
  const allNoun = isVocabularyAllNounLike(vocab);
  // eslint-disable-next-line no-console
  console.log(
    `\n[${caseLabel}] strategy=${strategy}`,
    formatVocabPosCounts(counts),
    `expressionTypes=${expr}`,
    `allNounLike=${allNoun}`,
    vocab.map((v) => ({
      pos: v.part_of_speech,
      surface: v.surface_form,
      lemma: v.lemma,
    })),
  );
}

describe.runIf(runLive)("vocabulary strategy compare (live)", () => {
  it("runs mini_single, gpt4o_single, mini_split on short + gaullismus fixtures", async () => {
    const openai = createServerOpenAIClient({
      apiKey: apiKey!,
      timeout: 180_000,
      maxRetries: 1,
    });

    const report: unknown[] = [];

    for (const c of CASES) {
      const text = loadFixture(c.file);
      expect(text.length).toBeGreaterThan(100);
      for (const strategy of STRATEGIES) {
        const vocab = await requestVocabularyForStrategy(openai, strategy, {
          title: c.title,
          originalText: text,
          userLevel: "B1",
        });
        expect(vocab.length).toBeGreaterThan(0);
        logReport(strategy, c.label, vocab);
        report.push({
          case: c.label,
          strategy,
          counts: countVocabByBucket(vocab),
          expressionTypes: countExpressionTypeVocabulary(vocab),
          allNounLike: isVocabularyAllNounLike(vocab),
          items: vocab.map((v) => ({
            pos: v.part_of_speech,
            surface: v.surface_form,
            lemma: v.lemma,
          })),
        });
      }
    }

    const outPath = resolve(
      process.cwd(),
      "experiments/vocabulary-2026-05/reports/vocabulary-strategy-compare-report.json",
    );
    writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
    // eslint-disable-next-line no-console
    console.log(`Report written: ${outPath}`);
  }, 900_000);
});

describe.runIf(!runLive)("vocabulary strategy compare (skipped)", () => {
  it("skipped without VOCAB_STRATEGY_COMPARE_LIVE=1 and OPENAI_API_KEY", () => {
    expect(true).toBe(true);
  });
});
