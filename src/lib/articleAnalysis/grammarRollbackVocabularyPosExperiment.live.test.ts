/**
 * 非生产实验：Grammar v2 之前（git 8fee112）整文 prompt vs 当前生产 SYSTEM_PROMPT。
 * 目的：验证「去掉 Grammar v2 长规则后 vocabulary 是否更易出现动词/搭配」。
 * 不改 route / 不改 schema 文件 / 不改生产 SYSTEM_PROMPT。
 *
 * 运行：
 *   $env:NODE_OPTIONS='--use-system-ca'
 *   $env:GRAMMAR_ROLLBACK_VOCAB_LIVE='1'
 *   npx vitest run --config vitest.live.config.ts src/lib/articleAnalysis/grammarRollbackVocabularyPosExperiment.live.test.ts --testTimeout=600000
 *
 * 报告：scripts/grammar-rollback-vocabulary-pos-report.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ARTICLE_ANALYSIS_JSON_SCHEMA } from "./articleAnalysisJsonSchema";
import {
  buildOpenAIAnalysisUserContent,
  normalizeOpenAIArticleAnalysis,
  SYSTEM_PROMPT_LEGACY,
  truncateForOpenAIAnalysis,
} from "./openaiArticleAnalysis";
import { PRE_GRAMMAR_V2_SYSTEM_PROMPT } from "./preGrammarV2ExperimentPrompt";
import type { AnalyzedVocabularyItem } from "./types";
import { isVocabularyAllNounLike } from "./vocabularyRegressionDiagnostic";
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
  Boolean(apiKey) && process.env.GRAMMAR_ROLLBACK_VOCAB_LIVE === "1";

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
      p.includes("konjunktion")
    )
      out.connector += 1;
    else out.other += 1;
  }
  return out;
}

function nonNounCount(pos: DetailedPos): number {
  return (
    pos.verb +
    pos.verb_phrase +
    pos.separable_verb +
    pos.collocation +
    pos.fixed_expression +
    pos.adjective +
    pos.adverb +
    pos.connector +
    pos.other
  );
}

type FixtureRow = { id: string; file: string; title: string };

function discoverFixtures(): FixtureRow[] {
  const base: FixtureRow[] = [
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
  const dir = resolve(process.cwd(), "scripts/fixtures");
  for (const f of ["meghan-article.txt", "meghan-who.txt"]) {
    const p = resolve(dir, f);
    if (existsSync(p) && readFileSync(p, "utf8").trim().length > 80) {
      base.push({
        id: "meghan",
        file: f,
        title:
          "In schwarzem Hosenanzug: Herzogin Meghan trat in Genf für eine Herzensangelegenheit auf",
      });
      break;
    }
  }
  return base;
}

function loadFixture(file: string): string {
  const p = resolve(process.cwd(), "scripts/fixtures", file);
  return existsSync(p) ? readFileSync(p, "utf8").trim() : "";
}

async function runFullArticleAnalysis(
  openai: ReturnType<typeof createServerOpenAIClient>,
  systemPrompt: string,
  params: { title: string; originalText: string; userLevel: "B1" },
) {
  const { text } = truncateForOpenAIAnalysis(params.originalText);
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [
      { role: "system", content: systemPrompt },
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
  if (!content) throw new Error("empty completion");
  const analysis = normalizeOpenAIArticleAnalysis(JSON.parse(content));
  return { analysis, text };
}

describe.runIf(runLive)(
  "pre-Grammar-v2 prompt vs production (vocabulary POS)",
  () => {
    it("runs fixtures and writes report", async () => {
      const fixtures = discoverFixtures();
      const openai = createServerOpenAIClient({
        apiKey: apiKey!,
        timeout: 180_000,
        maxRetries: 1,
      });

      const report: {
        runAt: string;
        model: string;
        note: string;
        production_has_grammar_v2: boolean;
        pre_prompt_source: string;
        articles: Array<{
          id: string;
          file: string;
          charCount: number;
          production: {
            vocabulary_count: number;
            grammar_count: number;
            pos: DetailedPos;
            all_noun_like: boolean;
            sample: Array<{
              surface_form: string;
              lemma: string;
              part_of_speech: string;
            }>;
          };
          pre_grammar_v2: {
            vocabulary_count: number;
            grammar_count: number;
            pos: DetailedPos;
            all_noun_like: boolean;
            sample: Array<{
              surface_form: string;
              lemma: string;
              part_of_speech: string;
            }>;
          };
          comparison_notes: string[];
        }>;
      } = {
        runAt: new Date().toISOString(),
        model: "gpt-4o-mini",
        note: "同一 json_schema（当前生产）；仅 system prompt 不同。pre = git 8fee112 整文 prompt（Grammar v2 之前，语法最多 8 条 + 广义词汇段）。",
        production_has_grammar_v2: SYSTEM_PROMPT_LEGACY.includes(
          "Grammar Analysis v2",
        ),
        pre_prompt_source: "git 8fee112:openaiArticleAnalysis.ts",
        articles: [],
      };

      for (const spec of fixtures) {
        const fullText = loadFixture(spec.file);
        expect(fullText.length, spec.file).toBeGreaterThan(50);

        const [prod, pre] = await Promise.all([
          runFullArticleAnalysis(openai, SYSTEM_PROMPT_LEGACY, {
            title: spec.title,
            originalText: fullText,
            userLevel: "B1",
          }),
          runFullArticleAnalysis(openai, PRE_GRAMMAR_V2_SYSTEM_PROMPT, {
            title: spec.title,
            originalText: fullText,
            userLevel: "B1",
          }),
        ]);

        const prodPos = countDetailedPos(prod.analysis.vocabulary);
        const prePos = countDetailedPos(pre.analysis.vocabulary);
        const notes: string[] = [];

        const prodNon = nonNounCount(prodPos);
        const preNon = nonNounCount(prePos);
        if (preNon > prodNon)
          notes.push(
            `pre_grammar_v2 非名词更多（${preNon} vs ${prodNon}）`,
          );
        else if (preNon < prodNon)
          notes.push(
            `production 非名词更多（${prodNon} vs ${preNon}）`,
          );
        else notes.push("非名词条数相同");

        if (isVocabularyAllNounLike(prod.analysis.vocabulary))
          notes.push("production：全名词类");
        if (isVocabularyAllNounLike(pre.analysis.vocabulary))
          notes.push("pre_grammar_v2：全名词类");

        report.articles.push({
          id: spec.id,
          file: spec.file,
          charCount: prod.text.length,
          production: {
            vocabulary_count: prod.analysis.vocabulary.length,
            grammar_count: prod.analysis.grammar.length,
            pos: prodPos,
            all_noun_like: isVocabularyAllNounLike(prod.analysis.vocabulary),
            sample: prod.analysis.vocabulary.slice(0, 12).map((v) => ({
              surface_form: v.surface_form,
              lemma: v.lemma,
              part_of_speech: v.part_of_speech,
            })),
          },
          pre_grammar_v2: {
            vocabulary_count: pre.analysis.vocabulary.length,
            grammar_count: pre.analysis.grammar.length,
            pos: prePos,
            all_noun_like: isVocabularyAllNounLike(pre.analysis.vocabulary),
            sample: pre.analysis.vocabulary.slice(0, 12).map((v) => ({
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
          "prod vocab",
          prod.analysis.vocabulary.length,
          "non-noun",
          prodNon,
          "grammar",
          prod.analysis.grammar.length,
          "| pre",
          pre.analysis.vocabulary.length,
          "non-noun",
          preNon,
          "grammar",
          pre.analysis.grammar.length,
        );
      }

      const outPath = resolve(
        process.cwd(),
        "scripts/grammar-rollback-vocabulary-pos-report.json",
      );
      writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      // eslint-disable-next-line no-console
      console.log("Wrote", outPath);

      expect(report.production_has_grammar_v2).toBe(true);
      expect(report.articles.length).toBeGreaterThanOrEqual(3);
    }, 600_000);
  },
);

describe.runIf(!runLive)("grammar rollback vocab experiment (skipped)", () => {
  it("skipped without GRAMMAR_ROLLBACK_VOCAB_LIVE=1", () => {
    expect(true).toBe(true);
  });
});
