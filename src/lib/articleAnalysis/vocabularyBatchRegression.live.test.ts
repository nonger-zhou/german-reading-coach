/**
 * Reset v1 批量回归：对 fixtures 用生产 SYSTEM_PROMPT 重跑 vocabulary POS 分布。
 * 运行：$env:NODE_OPTIONS='--use-system-ca'; $env:VOCAB_BATCH_LIVE='1'; npx vitest run --config vitest.live.config.ts src/lib/articleAnalysis/vocabularyBatchRegression.live.test.ts --testTimeout=600000
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ARTICLE_ANALYSIS_JSON_SCHEMA } from "./articleAnalysisJsonSchema";
import {
  buildOpenAIAnalysisUserContent,
  normalizeOpenAIArticleAnalysis,
  SYSTEM_PROMPT,
} from "./openaiArticleAnalysis";
import {
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
const runLive = Boolean(apiKey) && process.env.VOCAB_BATCH_LIVE === "1";

const FIXTURES: Array<{
  id: string;
  file: string;
  title: string;
  userLevel: "B1" | "B2";
}> = [
  {
    id: "news-short",
    file: "news-short-article.txt",
    title: "Bundesregierung beschließt neue Klimaziele",
    userLevel: "B1",
  },
  {
    id: "gaullismus",
    file: "gaullismus-article.txt",
    title: "Für einen europäischen Gaullismus",
    userLevel: "B1",
  },
  {
    id: "msc-oil",
    file: "msc-oil-article.txt",
    title: "Mitten im Iran-Krieg stösst MSC in den Ölhandel vor",
    userLevel: "B1",
  },
];

function loadFixture(name: string): string {
  const p = resolve(process.cwd(), "scripts/fixtures", name);
  return existsSync(p) ? readFileSync(p, "utf8").trim() : "";
}

async function analyzeFixture(spec: (typeof FIXTURES)[0]) {
  const text = loadFixture(spec.file);
  const openai = createServerOpenAIClient({
    apiKey: apiKey!,
    timeout: 180_000,
    maxRetries: 1,
  });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: buildOpenAIAnalysisUserContent({
          title: spec.title,
          originalText: text,
          userLevel: spec.userLevel,
        }),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: ARTICLE_ANALYSIS_JSON_SCHEMA,
    },
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("空响应");
  const analysis = normalizeOpenAIArticleAnalysis(JSON.parse(content));
  const vocab = analysis.vocabulary;
  const counts = countVocabByBucket(vocab);
  return {
    id: spec.id,
    file: spec.file,
    charCount: text.length,
    grammarCount: analysis.grammar.length,
    vocabulary: vocab.map((v) => ({
      surface_form: v.surface_form,
      lemma: v.lemma,
      part_of_speech: v.part_of_speech,
      grammatical_gender: v.grammatical_gender,
    })),
    counts,
    posSummary: formatVocabPosCounts(counts),
    allNounLike: isVocabularyAllNounLike(vocab),
    promptHasResetMarkers:
      SYSTEM_PROMPT.includes("reading-learning value") &&
      SYSTEM_PROMPT.includes("balanced mix") &&
      !SYSTEM_PROMPT.includes("【名词：冠词与复数】"),
  };
}

describe.runIf(runLive)("vocabulary batch regression (production prompt)", () => {
  it("runs all fixtures and writes report", async () => {
    const report: {
      runAt: string;
      model: string;
      promptResetWired: boolean;
      results: Awaited<ReturnType<typeof analyzeFixture>>[];
    } = {
      runAt: new Date().toISOString(),
      model: "gpt-4o-mini",
      promptResetWired:
        SYSTEM_PROMPT.includes("reading-learning value") &&
        !SYSTEM_PROMPT.includes("【名词：冠词与复数】"),
      results: [],
    };

    for (const spec of FIXTURES) {
      const text = loadFixture(spec.file);
      expect(text.length, spec.file).toBeGreaterThan(50);
      const row = await analyzeFixture(spec);
      report.results.push(row);
      // eslint-disable-next-line no-console
      console.log(
        `[${row.id}]`,
        row.posSummary,
        `allNoun=${row.allNounLike}`,
        `grammar=${row.grammarCount}`,
      );
    }

    const scriptsDir = resolve(process.cwd(), "scripts");
    if (!existsSync(scriptsDir)) mkdirSync(scriptsDir, { recursive: true });
    const outPath = resolve(
      scriptsDir,
      "vocabulary-reset-batch-report.json",
    );
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    // eslint-disable-next-line no-console
    console.log("Wrote", outPath);

    expect(report.promptResetWired).toBe(true);
    expect(report.results.length).toBe(FIXTURES.length);
  }, 600_000);
});

describe.runIf(!runLive)("vocabulary batch regression (skipped)", () => {
  it("skipped without VOCAB_BATCH_LIVE=1 and OPENAI_API_KEY", () => {
    expect(true).toBe(true);
  });
});
