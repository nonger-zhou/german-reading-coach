/**
 * 本地对比：生产单次整文 vs 第二次 vocabulary 调用（core 与 vocabulary 并行）。
 *
 * 运行：
 *   $env:NODE_OPTIONS='--use-system-ca'
 *   $env:VOCAB_SECOND_CALL_LIVE='1'
 *   npx vitest run --config vitest.live.config.ts src/lib/articleAnalysis/vocabularySecondCallExperiment.live.test.ts --testTimeout=900000
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
  Boolean(apiKey) && process.env.VOCAB_SECOND_CALL_LIVE === "1";

function loadFixture(name: string): string {
  const p = resolve(process.cwd(), "scripts/fixtures", name);
  return existsSync(p) ? readFileSync(p, "utf8").trim() : "";
}

/** 生产等价：单次整文 prompt */
const STRATEGY_PRODUCTION_SINGLE: VocabularyExperimentStrategy = "mini_single";
/** 第二次调用：Reset v1 vocabulary-only（与 VOCABULARY_ONLY_SYSTEM_PROMPT 同源） */
const STRATEGY_SPLIT_RESET: VocabularyExperimentStrategy =
  "mini_split_reset_vocab";
/** 第二次调用：极简 B vocabulary-only */
const STRATEGY_SPLIT_MINIMAL_B: VocabularyExperimentStrategy =
  "mini_split_minimal_b";

const STRATEGIES: VocabularyExperimentStrategy[] = [
  STRATEGY_PRODUCTION_SINGLE,
  STRATEGY_SPLIT_RESET,
  STRATEGY_SPLIT_MINIMAL_B,
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
  {
    label: "msc-oil",
    title: "Mitten im Iran-Krieg stösst MSC in den Ölhandel vor",
    file: "msc-oil-article.txt",
  },
  {
    label: "meghan",
    title:
      "In schwarzem Hosenanzug: Herzogin Meghan trat in Genf für eine Herzensangelegenheit auf",
    file: "meghan-article.txt",
  },
] as const;

const STRATEGY_LABELS: Record<VocabularyExperimentStrategy, string> = {
  mini_single: "production_single_call",
  gpt4o_single: "gpt4o_single",
  mini_split: "split_reset_vocab_legacy_alias",
  mini_split_reset_vocab: "split_second_call_reset_vocab",
  mini_split_minimal_b: "split_second_call_minimal_b",
  mini_vocab_only_reset: "vocab_only_single_no_grammar_reset_v1",
  mini_vocab_only_minimal_b: "vocab_only_single_no_grammar_minimal_b",
};

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
    `\n[${caseLabel}] ${STRATEGY_LABELS[strategy]}`,
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

describe.runIf(runLive)("vocabulary second call experiment (live)", () => {
  it("compares production single vs split second-call (reset + minimal B)", async () => {
    const openai = createServerOpenAIClient({
      apiKey: apiKey!,
      timeout: 180_000,
      maxRetries: 1,
    });

    const report: {
      generatedAt: string;
      strategies: string[];
      cases: unknown[];
    } = {
      generatedAt: new Date().toISOString(),
      strategies: STRATEGIES.map((s) => STRATEGY_LABELS[s]),
      cases: [],
    };

    for (const c of CASES) {
      const text = loadFixture(c.file);
      expect(text.length).toBeGreaterThan(100);
      const caseRow: {
        case: string;
        title: string;
        charCount: number;
        runs: unknown[];
      } = {
        case: c.label,
        title: c.title,
        charCount: text.length,
        runs: [],
      };

      for (const strategy of STRATEGIES) {
        const vocab = await requestVocabularyForStrategy(openai, strategy, {
          title: c.title,
          originalText: text,
          userLevel: "B1",
        });
        expect(vocab.length).toBeGreaterThan(0);
        logReport(strategy, c.label, vocab);
        caseRow.runs.push({
          strategy: STRATEGY_LABELS[strategy],
          count: vocab.length,
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

      report.cases.push(caseRow);
    }

    const outPath = resolve(
      process.cwd(),
      "experiments/vocabulary-2026-05/reports/vocabulary-second-call-experiment-report.json",
    );
    writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
    // eslint-disable-next-line no-console
    console.log(`\nReport written: ${outPath}`);
  }, 900_000);
});

describe.runIf(!runLive)("vocabulary second call experiment (skipped)", () => {
  it("skipped without VOCAB_SECOND_CALL_LIVE=1 and OPENAI_API_KEY", () => {
    expect(true).toBe(true);
  });
});
