/**
 * 非生产实验：极简 vocabulary-only（A/B 风格 B） vs 生产整文 SYSTEM_PROMPT。
 * 不改 route / 不改 schema 文件 / 不改保存逻辑。
 *
 * 运行（需 OPENAI_API_KEY，建议 TLS）：
 *   $env:NODE_OPTIONS='--use-system-ca'
 *   $env:VOCAB_ONLY_VS_PROD_LIVE='1'
 *   npx vitest run --config vitest.live.config.ts src/lib/articleAnalysis/vocabularyOnlyVsProductionExperiment.live.test.ts --testTimeout=600000
 *
 * 报告：scripts/vocabulary-only-vs-production-experiment-report.json
 *
 * Meghan：若存在 scripts/fixtures/meghan-article.txt（或 meghan-who.txt）则纳入；否则跳过并在报告中注明。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ARTICLE_ANALYSIS_JSON_SCHEMA } from "./articleAnalysisJsonSchema";
import { VOCABULARY_ONLY_JSON_SCHEMA } from "./articleAnalysisVocabularySchema";
import {
  buildOpenAIAnalysisUserContent,
  normalizeOpenAIArticleAnalysis,
  SYSTEM_PROMPT,
  truncateForOpenAIAnalysis,
} from "./openaiArticleAnalysis";
import { EXPERIMENTAL_MINIMAL_B_VOCAB_ONLY_SYSTEM } from "./experimentalVocabularyOnlyMinimalPrompt";
import { normalizeOpenAIVocabularyOnly } from "./openaiVocabularyOnlyAnalysis";
import type { AnalyzedVocabularyItem } from "./types";
import { findBestTextOccurrence } from "@/lib/articleReadingModel";
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
  Boolean(apiKey) && process.env.VOCAB_ONLY_VS_PROD_LIVE === "1";

type DetailedPos = {
  total: number;
  noun: number;
  compound_noun: number;
  verb: number;
  verb_phrase: number;
  separable_verb: number;
  collocation: number;
  fixed_expression: number;
  adjective: number;
  adverb: number;
  connector: number;
  other: number;
};

function countDetailedPos(
  items: ReadonlyArray<Pick<AnalyzedVocabularyItem, "part_of_speech">>,
): DetailedPos {
  const out: DetailedPos = {
    total: items.length,
    noun: 0,
    compound_noun: 0,
    verb: 0,
    verb_phrase: 0,
    separable_verb: 0,
    collocation: 0,
    fixed_expression: 0,
    adjective: 0,
    adverb: 0,
    connector: 0,
    other: 0,
  };
  for (const it of items) {
    const p = it.part_of_speech.trim().toLowerCase();
    /** 模型偶发自由文案，归入 verb_phrase 便于与 schema 枚举对齐 */
    if (
      p.includes("verb-preposition") ||
      p.includes("verb_preposition") ||
      p.includes("preposition combination")
    ) {
      out.verb_phrase += 1;
      continue;
    }
    if (p === "noun") out.noun += 1;
    else if (p === "compound_noun") out.compound_noun += 1;
    else if (p === "verb") out.verb += 1;
    else if (p === "verb_phrase") out.verb_phrase += 1;
    else if (p === "separable_verb") out.separable_verb += 1;
    else if (p === "collocation") out.collocation += 1;
    else if (p === "fixed_expression") out.fixed_expression += 1;
    else if (p === "adjective" || p === "adj") out.adjective += 1;
    else if (p === "adverb") out.adverb += 1;
    else if (
      p === "connector" ||
      p === "conjunction" ||
      p.includes("konjunktion") ||
      p.includes("bindewort")
    )
      out.connector += 1;
    else out.other += 1;
  }
  return out;
}

function surfaceFormMatchStats(
  items: ReadonlyArray<Pick<AnalyzedVocabularyItem, "surface_form">>,
  articlePlain: string,
): {
  matchedCount: number;
  total: number;
  allMatched: boolean;
  missing_surface_forms: string[];
} {
  const missing: string[] = [];
  let matched = 0;
  for (const it of items) {
    const s = it.surface_form.trim();
    if (!s) {
      missing.push("(empty)");
      continue;
    }
    if (s.includes("…") || s.includes("...")) {
      missing.push(s);
      continue;
    }
    if (findBestTextOccurrence(articlePlain, s, 0)) matched += 1;
    else missing.push(s);
  }
  return {
    matchedCount: matched,
    total: items.length,
    allMatched: missing.length === 0,
    missing_surface_forms: missing,
  };
}

type FixtureRow = {
  id: string;
  file: string;
  title: string;
};

function discoverMeghanFixture(): FixtureRow | null {
  const dir = resolve(process.cwd(), "scripts/fixtures");
  const candidates = ["meghan-article.txt", "meghan-who.txt", "meghan.txt"];
  for (const f of candidates) {
    const p = resolve(dir, f);
    if (existsSync(p) && readFileSync(p, "utf8").trim().length > 80) {
      return {
        id: "meghan",
        file: f,
        title:
          "In schwarzem Hosenanzug: Herzogin Meghan trat in Genf für eine Herzensangelegenheit auf",
      };
    }
  }
  return null;
}

function loadFixture(file: string): string {
  const p = resolve(process.cwd(), "scripts/fixtures", file);
  return existsSync(p) ? readFileSync(p, "utf8").trim() : "";
}

async function runProductionVocab(
  openai: ReturnType<typeof createServerOpenAIClient>,
  params: { title: string; originalText: string; userLevel: "B1" },
): Promise<AnalyzedVocabularyItem[]> {
  const { text } = truncateForOpenAIAnalysis(params.originalText);
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: buildOpenAIAnalysisUserContent({
          title: params.title,
          originalText: text,
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
  if (!content) throw new Error("production: empty completion");
  return normalizeOpenAIArticleAnalysis(JSON.parse(content)).vocabulary;
}

async function runMinimalBVocabOnly(
  openai: ReturnType<typeof createServerOpenAIClient>,
  params: { title: string; originalText: string; userLevel: "B1" },
): Promise<AnalyzedVocabularyItem[]> {
  const { text } = truncateForOpenAIAnalysis(params.originalText);
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [
      { role: "system", content: EXPERIMENTAL_MINIMAL_B_VOCAB_ONLY_SYSTEM },
      {
        role: "user",
        content: buildOpenAIAnalysisUserContent({
          title: params.title,
          originalText: text,
          userLevel: params.userLevel,
        }),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: VOCABULARY_ONLY_JSON_SCHEMA,
    },
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("minimal B: empty completion");
  return normalizeOpenAIVocabularyOnly(JSON.parse(content));
}

describe.runIf(runLive)(
  "vocabulary-only (minimal B) vs production full SYSTEM_PROMPT",
  () => {
    it("runs fixtures and writes experiment report", async () => {
      const baseFixtures: FixtureRow[] = [
        {
          id: "news-short",
          file: "news-short-article.txt",
          title: "Bundesregierung beschließt neue Klimaziele",
        },
        {
          id: "gaullismus",
          file: "gaullismus-article.txt",
          title: "Für einen europäischen Gaullismus",
        },
        {
          id: "msc-oil",
          file: "msc-oil-article.txt",
          title: "Mitten im Iran-Krieg stösst MSC in den Ölhandel vor",
        },
      ];
      const meghan = discoverMeghanFixture();
      const fixtures = meghan ? [...baseFixtures, meghan] : baseFixtures;

      const openai = createServerOpenAIClient({
        apiKey: apiKey!,
        timeout: 180_000,
        maxRetries: 1,
      });

      const report: {
        runAt: string;
        model: string;
        meghan_fixture: "included" | "skipped_no_file";
        production_prompt_marker: string;
        minimal_b_prompt_excerpt: string;
        articles: Array<{
          id: string;
          file: string;
          charCount: number;
          truncated: boolean;
          production: {
            vocabulary_count: number;
            pos: DetailedPos;
            surface_form_in_text: ReturnType<typeof surfaceFormMatchStats>;
            sample: Array<
              Pick<
                AnalyzedVocabularyItem,
                "surface_form" | "lemma" | "part_of_speech"
              >
            >;
          };
          minimal_b_vocab_only: {
            vocabulary_count: number;
            pos: DetailedPos;
            surface_form_in_text: ReturnType<typeof surfaceFormMatchStats>;
            sample: Array<
              Pick<
                AnalyzedVocabularyItem,
                "surface_form" | "lemma" | "part_of_speech"
              >
            >;
          };
          comparison_notes: string[];
        }>;
      } = {
        runAt: new Date().toISOString(),
        model: "gpt-4o-mini",
        meghan_fixture: meghan ? "included" : "skipped_no_file",
        production_prompt_marker: "reading-learning value",
        minimal_b_prompt_excerpt: EXPERIMENTAL_MINIMAL_B_VOCAB_ONLY_SYSTEM.slice(
          0,
          120,
        ),
        articles: [],
      };

      for (const spec of fixtures) {
        const fullText = loadFixture(spec.file);
        expect(
          fullText.length,
          `${spec.file} missing or too short`,
        ).toBeGreaterThan(50);
        const { text, truncated } = truncateForOpenAIAnalysis(fullText);

        const [prodVocab, minimalVocab] = await Promise.all([
          runProductionVocab(openai, {
            title: spec.title,
            originalText: fullText,
            userLevel: "B1",
          }),
          runMinimalBVocabOnly(openai, {
            title: spec.title,
            originalText: fullText,
            userLevel: "B1",
          }),
        ]);

        const prodPos = countDetailedPos(prodVocab);
        const minPos = countDetailedPos(minimalVocab);
        const prodNonNoun =
          prodPos.verb +
          prodPos.verb_phrase +
          prodPos.separable_verb +
          prodPos.collocation +
          prodPos.fixed_expression +
          prodPos.adjective +
          prodPos.adverb +
          prodPos.connector +
          prodPos.other;
        const minNonNoun =
          minPos.verb +
          minPos.verb_phrase +
          minPos.separable_verb +
          minPos.collocation +
          minPos.fixed_expression +
          minPos.adjective +
          minPos.adverb +
          minPos.connector +
          minPos.other;

        const notes: string[] = [];
        if (minNonNoun > prodNonNoun)
          notes.push(
            `minimal_b 非名词类条数更多（${minNonNoun} vs ${prodNonNoun}）`,
          );
        else if (minNonNoun < prodNonNoun)
          notes.push(
            `production 非名词类条数更多（${prodNonNoun} vs ${minNonNoun}）`,
          );
        else notes.push("非名词类条数相同");

        if (
          prodPos.noun + prodPos.compound_noun === prodPos.total &&
          prodPos.total >= 2
        )
          notes.push("production：本 run 为全名词类");
        if (
          minPos.noun + minPos.compound_noun === minPos.total &&
          minPos.total >= 2
        )
          notes.push("minimal_b：本 run 为全名词类");

        report.articles.push({
          id: spec.id,
          file: spec.file,
          charCount: text.length,
          truncated,
          production: {
            vocabulary_count: prodVocab.length,
            pos: prodPos,
            surface_form_in_text: surfaceFormMatchStats(prodVocab, text),
            sample: prodVocab.slice(0, 12).map((v) => ({
              surface_form: v.surface_form,
              lemma: v.lemma,
              part_of_speech: v.part_of_speech,
            })),
          },
          minimal_b_vocab_only: {
            vocabulary_count: minimalVocab.length,
            pos: minPos,
            surface_form_in_text: surfaceFormMatchStats(minimalVocab, text),
            sample: minimalVocab.slice(0, 12).map((v) => ({
              surface_form: v.surface_form,
              lemma: v.lemma,
              part_of_speech: v.part_of_speech,
            })),
          },
          comparison_notes: notes,
        });

        // eslint-disable-next-line no-console
        console.log(
          spec.id,
          "prod",
          prodVocab.length,
          "non-noun-ish",
          prodNonNoun,
          "| minimalB",
          minimalVocab.length,
          "non-noun-ish",
          minNonNoun,
        );
      }

      const scriptsDir = resolve(process.cwd(), "scripts");
      if (!existsSync(scriptsDir)) mkdirSync(scriptsDir, { recursive: true });
      const outPath = resolve(
        scriptsDir,
        "vocabulary-only-vs-production-experiment-report.json",
      );
      writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      // eslint-disable-next-line no-console
      console.log("Wrote", outPath);

      expect(report.articles.length).toBeGreaterThanOrEqual(3);
    }, 600_000);
  },
);

describe.runIf(!runLive)(
  "vocabulary-only vs production experiment (skipped)",
  () => {
    it("skipped without VOCAB_ONLY_VS_PROD_LIVE=1 and OPENAI_API_KEY", () => {
      expect(true).toBe(true);
    });
  },
);
