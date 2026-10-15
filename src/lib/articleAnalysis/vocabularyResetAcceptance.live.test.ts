/**
 * Vocabulary Prompt Reset v1 验收：news-short-article 不应再全名词。
 * 运行：$env:VOCAB_RESET_ACCEPTANCE_LIVE='1'; npx vitest run --config vitest.live.config.ts src/lib/articleAnalysis/vocabularyResetAcceptance.live.test.ts --testTimeout=180000
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
  Boolean(apiKey) && process.env.VOCAB_RESET_ACCEPTANCE_LIVE === "1";

function loadFixture(name: string): string {
  const p = resolve(process.cwd(), "scripts/fixtures", name);
  return existsSync(p) ? readFileSync(p, "utf8").trim() : "";
}

describe.runIf(runLive)("vocabulary reset v1 acceptance", () => {
  it("news-short-article: mixed POS, not all nouns", async () => {
    const text = loadFixture("news-short-article.txt");
    expect(text.length).toBeGreaterThan(100);

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
            title: "Bundesregierung beschließt neue Klimaziele",
            originalText: text,
            userLevel: "B1",
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
    const vocab = normalizeOpenAIArticleAnalysis(JSON.parse(content!))
      .vocabulary;
    const counts = countVocabByBucket(vocab);
    // eslint-disable-next-line no-console
    console.log(
      "[vocab reset v1]",
      formatVocabPosCounts(counts),
      vocab.map((v) => ({
        pos: v.part_of_speech,
        surface: v.surface_form,
        lemma: v.lemma,
      })),
    );

    expect(vocab.length).toBeGreaterThanOrEqual(3);
    expect(isVocabularyAllNounLike(vocab)).toBe(false);
    const nonNoun =
      counts.verb + counts.phrase + counts.adjective + counts.adverb;
    expect(nonNoun).toBeGreaterThanOrEqual(1);
    expect(counts.noun).toBeGreaterThanOrEqual(1);
  }, 180_000);
});

describe.runIf(!runLive)("vocabulary reset v1 acceptance (skipped)", () => {
  it("skipped without VOCAB_RESET_ACCEPTANCE_LIVE=1 and OPENAI_API_KEY", () => {
    expect(true).toBe(true);
  });
});
