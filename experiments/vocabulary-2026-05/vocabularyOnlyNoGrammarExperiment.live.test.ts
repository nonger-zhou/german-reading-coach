/**
 * 本地：零语法 — 仅 vocabulary 单次调用 vs 生产整文（含 Grammar v2）。
 * 用于判断「词性偏名词」是否由语法段 prompt 引起。
 *
 * 默认正文：scripts/fixtures/autodiebe-schweiz-article.txt
 *
 * PowerShell：
 *   $env:NODE_OPTIONS='--use-system-ca'
 *   $env:VOCAB_ONLY_NO_GRAMMAR_LIVE='1'
 *   npm run vocab-only-no-grammar:try
 *
 * 自选文件：
 *   $env:VOCAB_SPLIT_FILE='scripts/fixtures/my.txt'
 *
 * 报告：experiments/vocabulary-2026-05/reports/vocabulary-only-no-grammar-report.json
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
  Boolean(apiKey) && process.env.VOCAB_ONLY_NO_GRAMMAR_LIVE === "1";

const DEFAULT_FILE = "scripts/fixtures/autodiebe-schweiz-article.txt";
const DEFAULT_TITLE =
  "Die Schweiz ist das neue Paradies für Autodiebe – jetzt rüsten die Luxusgaragisten auf";

const STRATEGIES: VocabularyExperimentStrategy[] = [
  "mini_single",
  "mini_vocab_only_reset",
  "mini_vocab_only_minimal_b",
];

const STRATEGY_LABELS: Record<VocabularyExperimentStrategy, string> = {
  mini_single: "production_full_prompt_with_grammar",
  gpt4o_single: "gpt4o_single",
  mini_split: "split_legacy",
  mini_split_reset_vocab: "split_second_call_reset_vocab",
  mini_split_minimal_b: "split_second_call_minimal_b",
  mini_vocab_only_reset: "vocab_only_single_no_grammar_reset_v1",
  mini_vocab_only_minimal_b: "vocab_only_single_no_grammar_minimal_b",
};

describe.runIf(runLive)("vocabulary only no grammar (live)", () => {
  it("compares full production vs vocabulary-only single call", async () => {
    const fileRel = process.env.VOCAB_SPLIT_FILE?.trim() || DEFAULT_FILE;
    const filePath = resolve(process.cwd(), fileRel);
    expect(existsSync(filePath)).toBe(true);
    const originalText = readFileSync(filePath, "utf8").trim();
    expect(originalText.length).toBeGreaterThan(80);

    const title = process.env.VOCAB_SPLIT_TITLE?.trim() || DEFAULT_TITLE;
    const userLevel = process.env.VOCAB_SPLIT_LEVEL?.trim() || "B1";

    const openai = createServerOpenAIClient({
      apiKey: apiKey!,
      timeout: 180_000,
      maxRetries: 1,
    });

    const runs: unknown[] = [];

    for (const strategy of STRATEGIES) {
      const label = STRATEGY_LABELS[strategy];
      // eslint-disable-next-line no-console
      console.log(`\n=== ${label} ===`);
      const vocab = await requestVocabularyForStrategy(openai, strategy, {
        title,
        originalText,
        userLevel,
      });
      expect(vocab.length).toBeGreaterThan(0);
      const counts = countVocabByBucket(vocab);
      // eslint-disable-next-line no-console
      console.log(
        formatVocabPosCounts(counts),
        `expressionTypes=${countExpressionTypeVocabulary(vocab)}`,
        `allNounLike=${isVocabularyAllNounLike(vocab)}`,
      );
      for (const v of vocab) {
        // eslint-disable-next-line no-console
        console.log(`  [${v.part_of_speech}] ${v.surface_form} → ${v.lemma} | ${v.zh_meaning}`);
      }
      runs.push({
        strategy: label,
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
      hypothesis:
        "If vocab_only (no grammar) is mixed-POS but production_full is noun-heavy, grammar prompt likely competes with vocabulary.",
      file: fileRel,
      title,
      userLevel,
      charCount: originalText.length,
      strategies: STRATEGIES.map((s) => STRATEGY_LABELS[s]),
      runs,
    };

    const outPath = resolve(
      process.cwd(),
      "experiments/vocabulary-2026-05/reports/vocabulary-only-no-grammar-report.json",
    );
    writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
    // eslint-disable-next-line no-console
    console.log(`\nReport: ${outPath}`);
  }, 600_000);
});

describe.runIf(!runLive)("vocabulary only no grammar (skipped)", () => {
  it("needs VOCAB_ONLY_NO_GRAMMAR_LIVE=1 and OPENAI_API_KEY", () => {
    expect(true).toBe(true);
  });
});
