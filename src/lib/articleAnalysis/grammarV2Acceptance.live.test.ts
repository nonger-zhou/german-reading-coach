/**
 * Grammar Analysis v2 行为验收（需 OPENAI_API_KEY，读 .env.local）。
 * 运行：npx vitest run src/lib/articleAnalysis/grammarV2Acceptance.live.test.ts --testTimeout=180000
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ARTICLE_ANALYSIS_JSON_SCHEMA } from "./articleAnalysisJsonSchema";
import { filterArticleAnalysisByArticleText } from "./filterAnalysisByArticleText";
import {
  buildOpenAIAnalysisUserContent,
  normalizeOpenAIArticleAnalysis,
  SYSTEM_PROMPT,
} from "./openaiArticleAnalysis";
import type { AnalyzedGrammarItem } from "./types";
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
const runLive = Boolean(apiKey) && process.env.GRAMMAR_V2_LIVE === "1";

type CaseSpec = {
  id: number;
  sentence: string;
  evaluate: (grammar: AnalyzedGrammarItem[]) => { pass: boolean; notes: string[] };
};

function itemsOfTypes(
  grammar: AnalyzedGrammarItem[],
  types: string[],
): AnalyzedGrammarItem[] {
  return grammar.filter((g) => types.includes(g.grammar_type));
}

function forbidTypes(
  grammar: AnalyzedGrammarItem[],
  types: string[],
): string | null {
  const bad = grammar.filter((g) => types.includes(g.grammar_type));
  if (!bad.length) return null;
  return `不应出现类型：${bad.map((g) => g.grammar_type).join(", ")}`;
}

const CASES: CaseSpec[] = [
  {
    id: 1,
    sentence: "Um elf Uhr muss ich Medikamente nehmen.",
    evaluate: (grammar) => {
      const notes: string[] = [];
      const forbid = forbidTypes(grammar, ["nebensatz", "infinitiv_um_zu"]);
      if (forbid) notes.push(forbid);
      const main = grammar.find((g) => g.grammar_type === "hauptsatz_v2");
      if (!main) notes.push("缺少 hauptsatz_v2");
      else {
        if (main.is_subordinate_clause !== false)
          notes.push(`is_subordinate_clause 应为 false`);
        if (main.finite_verb.toLowerCase() !== "muss")
          notes.push(`finite_verb 期望 muss，实际「${main.finite_verb}」`);
        if (main.finite_verb_position !== "second")
          notes.push(
            `finite_verb_position 期望 second，实际「${main.finite_verb_position}」`,
          );
      }
      return { pass: notes.length === 0, notes };
    },
  },
  {
    id: 2,
    sentence: "Um elf Uhr",
    evaluate: (grammar) => {
      const notes: string[] = [];
      const forbid = forbidTypes(grammar, ["nebensatz", "infinitiv_um_zu"]);
      if (forbid) notes.push(forbid);
      if (grammar.length === 0) {
        notes.push("无 grammar 条目（符合 v2：仅短语可不进 grammar）");
        return { pass: true, notes };
      }
      const ok = itemsOfTypes(grammar, [
        "temporalangabe",
        "praepositionalphrase",
      ]);
      if (!ok.length)
        notes.push(
          `有 grammar 但类型不符：${grammar.map((g) => g.grammar_type).join(", ")}`,
        );
      for (const g of ok) {
        if (g.is_subordinate_clause)
          notes.push(`${g.grammar_type}: is_subordinate_clause 应为 false`);
        if (
          g.finite_verb_position !== "none" &&
          g.finite_verb_position !== "unknown"
        )
          notes.push(
            `${g.grammar_type}: finite_verb_position 期望 none，实际 ${g.finite_verb_position}`,
          );
      }
      return {
        pass:
          !grammar.some((g) =>
            ["nebensatz", "infinitiv_um_zu"].includes(g.grammar_type),
          ) &&
          (grammar.length === 0 || ok.length > 0),
        notes,
      };
    },
  },
  {
    id: 3,
    sentence: "Heute gehe ich nach Zürich.",
    evaluate: (grammar) => {
      const notes: string[] = [];
      const main = grammar.find((g) => g.grammar_type === "hauptsatz_v2");
      if (!main) notes.push("缺少 hauptsatz_v2");
      else {
        if (main.is_subordinate_clause !== false)
          notes.push("is_subordinate_clause 应为 false");
        if (main.finite_verb.toLowerCase() !== "gehe")
          notes.push(`finite_verb 期望 gehe，实际「${main.finite_verb}」`);
        if (main.finite_verb_position !== "second")
          notes.push(
            `finite_verb_position 期望 second，实际「${main.finite_verb_position}」`,
          );
      }
      return { pass: notes.length === 0, notes };
    },
  },
  {
    id: 4,
    sentence: "Ich nehme Medikamente, weil ich krank bin.",
    evaluate: (grammar) => {
      const notes: string[] = [];
      const nb = grammar.find((g) => g.grammar_type === "nebensatz");
      if (!nb) notes.push("缺少 nebensatz");
      else {
        if (!nb.is_subordinate_clause)
          notes.push("nebensatz: is_subordinate_clause 应为 true");
        if (nb.finite_verb.toLowerCase() !== "bin")
          notes.push(`finite_verb 期望 bin，实际「${nb.finite_verb}」`);
        if (nb.finite_verb_position !== "final")
          notes.push(
            `finite_verb_position 期望 final，实际「${nb.finite_verb_position}」`,
          );
      }
      return { pass: notes.length === 0, notes };
    },
  },
  {
    id: 5,
    sentence: "Ich lerne Deutsch, um besser arbeiten zu können.",
    evaluate: (grammar) => {
      const notes: string[] = [];
      const forbid = forbidTypes(grammar, ["nebensatz"]);
      if (forbid) notes.push(forbid);
      const zu = grammar.find((g) => g.grammar_type === "infinitiv_um_zu");
      if (!zu) notes.push("缺少 infinitiv_um_zu");
      else if (zu.is_subordinate_clause)
        notes.push("infinitiv_um_zu: is_subordinate_clause 应为 false");
      return { pass: notes.length === 0, notes };
    },
  },
  {
    id: 6,
    sentence: "Der Mann steht dort.",
    evaluate: (grammar) => {
      const notes: string[] = [];
      const forbid = forbidTypes(grammar, ["relativsatz"]);
      if (forbid) notes.push(forbid);
      if (!grammar.find((g) => g.grammar_type === "hauptsatz_v2"))
        notes.push("缺少 hauptsatz_v2");
      return { pass: notes.length === 0, notes };
    },
  },
  {
    id: 7,
    sentence: "Der Mann, der dort steht, ist mein Lehrer.",
    evaluate: (grammar) => {
      const notes: string[] = [];
      const article = "Der Mann, der dort steht, ist mein Lehrer.";
      for (const g of grammar) {
        if (!article.includes(g.selected_text)) {
          notes.push(
            `selected_text 非原文连续子串：「${g.selected_text}」`,
          );
        }
      }
      const fake = grammar.find(
        (g) => g.selected_text === "Der Mann ist mein Lehrer.",
      );
      if (fake) notes.push("不应保留删减后的主句骨架 selected_text");
      const rel = grammar.find((g) => g.grammar_type === "relativsatz");
      if (!rel) notes.push("缺少 relativsatz");
      else if (!rel.is_subordinate_clause)
        notes.push("relativsatz: is_subordinate_clause 应为 true");
      return { pass: notes.length === 0, notes };
    },
  },
];

async function analyzeSentence(sentence: string): Promise<AnalyzedGrammarItem[]> {
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
          title: "Grammar v2 验收",
          originalText: sentence,
          userLevel: "B1",
        }),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: ARTICLE_CORE_ANALYSIS_JSON_SCHEMA,
    },
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("空响应");
  const normalized = normalizeOpenAIArticleAnalysis(JSON.parse(content));
  return filterArticleAnalysisByArticleText(normalized, sentence).analysis
    .grammar;
}

describe.runIf(runLive)("Grammar Analysis v2 live acceptance", () => {
  it(
    "runs all 7 sentences and prints report",
    async () => {
      const report: unknown[] = [];

      for (const spec of CASES) {
        const grammar = await analyzeSentence(spec.sentence);
        const { pass, notes } = spec.evaluate(grammar);
        report.push({
          id: spec.id,
          sentence: spec.sentence,
          pass,
          notes,
          grammar: grammar.map((g) => ({
            grammar_type: g.grammar_type,
            grammar_key: g.grammar_key,
            selected_text: g.selected_text,
            name_de: g.name_de,
            name_zh: g.name_zh,
            is_subordinate_clause: g.is_subordinate_clause,
            finite_verb: g.finite_verb,
            finite_verb_position: g.finite_verb_position,
          })),
        });
      }

      // eslint-disable-next-line no-console
      console.log(JSON.stringify(report, null, 2));

      const failed = report.filter(
        (r) => !(r as { pass: boolean }).pass,
      );
      expect(failed, `失败用例：${failed.length}`).toHaveLength(0);
    },
    180_000,
  );
});

describe.runIf(!runLive)("Grammar Analysis v2 live acceptance (skipped)", () => {
  it("skipped without OPENAI_API_KEY", () => {
    expect(true).toBe(true);
  });
});
