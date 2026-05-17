/**
 * vocabulary prompt 验收（回退后诊断）：仅看 raw vocabulary POS，打日志；不因分布 fail（模型波动，人工对比）。
 * 运行：$env:VOCAB_PROMPT_ACCEPTANCE_LIVE='1'; npx vitest run --config vitest.live.config.ts src/lib/articleAnalysis/vocabularyPromptAcceptance.live.test.ts --testTimeout=600000
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ARTICLE_ANALYSIS_JSON_SCHEMA } from "./articleAnalysisJsonSchema";
import {
  buildOpenAIAnalysisUserContent,
  normalizeOpenAIArticleAnalysis,
  SYSTEM_PROMPT,
} from "./openaiArticleAnalysis";
import {
  countExpressionTypeVocabulary,
  countVocabByBucket,
  formatVocabPosCounts,
  isVocabularyAllNounLike,
  nonNounSurfaceFormsMissingFromArticle,
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
const runLive = Boolean(apiKey) && process.env.VOCAB_PROMPT_ACCEPTANCE_LIVE === "1";

function loadFixture(name: string): string {
  const p = resolve(process.cwd(), "scripts/fixtures", name);
  return existsSync(p) ? readFileSync(p, "utf8").trim() : "";
}

async function requestRawVocabulary(params: {
  title: string;
  text: string;
  userLevel: "B1" | "B2";
}) {
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
          title: params.title,
          originalText: params.text,
          userLevel: params.userLevel,
        }),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: ARTICLE_ANALYSIS_JSON_SCHEMA,
    },
  });
  const content = completion.choices[0]?.message?.content;
  expect(content).toBeTruthy();
  return normalizeOpenAIArticleAnalysis(JSON.parse(content!)).vocabulary;
}

function logPosReport(
  label: string,
  vocab: Awaited<ReturnType<typeof requestRawVocabulary>>,
  articlePlain: string,
) {
  const counts = countVocabByBucket(vocab);
  const exprCount = countExpressionTypeVocabulary(vocab);
  const allNoun = isVocabularyAllNounLike(vocab);
  const missingSurfaces = nonNounSurfaceFormsMissingFromArticle(
    vocab,
    articlePlain,
  );
  // eslint-disable-next-line no-console
  console.log(
    label,
    formatVocabPosCounts(counts),
    `expressionTypes=${exprCount}`,
    `allNounLike=${allNoun}`,
    "missingNonNounSurfaces=",
    missingSurfaces,
    vocab.map((v) => ({
      pos: v.part_of_speech,
      surface: v.surface_form,
      lemma: v.lemma,
    })),
  );
}

describe.runIf(runLive)("vocabulary prompt acceptance (raw POS diagnostic)", () => {
  const gaullismus = loadFixture("gaullismus-article.txt");
  const mscOil = loadFixture("msc-oil-article.txt");

  it("A. Gaullismus — log part_of_speech distribution", async () => {
    expect(gaullismus.length).toBeGreaterThan(2500);
    const vocab = await requestRawVocabulary({
      title: "Für einen europäischen Gaullismus",
      text: gaullismus,
      userLevel: "B1",
    });
    logPosReport("[A Gaullismus]", vocab, gaullismus);
    expect(vocab.length).toBeGreaterThan(0);
  }, 300_000);

  it("B. MSC fixture — log part_of_speech distribution", async () => {
    expect(mscOil.length).toBeGreaterThan(500);
    const vocab = await requestRawVocabulary({
      title: "Mitten im Iran-Krieg stösst MSC in den Ölhandel vor",
      text: mscOil,
      userLevel: "B1",
    });
    logPosReport("[B MSC]", vocab, mscOil);
    expect(vocab.length).toBeGreaterThan(0);
  }, 300_000);
});

describe.runIf(!runLive)("vocabulary prompt acceptance (skipped)", () => {
  it("skipped without VOCAB_PROMPT_ACCEPTANCE_LIVE=1 and OPENAI_API_KEY", () => {
    expect(true).toBe(true);
  });
});
