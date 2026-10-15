/**
 * 实验假设对照：整文内 vocabulary 段 → 极简 B vs 拆分第二次调用 + 极简 B。
 * 附带生产整文 Reset v1 作参照。非生产，不入库。
 *
 *   $env:NODE_OPTIONS='--use-system-ca'
 *   $env:VOCAB_HYPOTHESIS_LIVE='1'
 *   npm run vocab-hypothesis:try
 *
 * 报告：scripts/vocabulary-hypothesis-compare-report.json
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
const runLive = Boolean(apiKey) && process.env.VOCAB_HYPOTHESIS_LIVE === "1";

/** 两条假设 + 生产参照 */
const STRATEGIES: VocabularyExperimentStrategy[] = [
  "mini_single",
  "mini_single_full_minimal_b_vocab",
  "mini_split_minimal_b",
];

const STRATEGY_LABELS: Record<(typeof STRATEGIES)[number], string> = {
  mini_single: "A0_production_reset_v1_full_single",
  mini_single_full_minimal_b_vocab: "H1_full_article_vocab_section_minimal_b",
  mini_split_minimal_b: "H2_split_second_call_minimal_b",
};

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
  {
    label: "autodiebe",
    title: "Die Schweiz ist das neue Paradies für Autodiebe",
    file: "autodiebe-schweiz-article.txt",
  },
] as const;

function loadFixture(name: string): string {
  const p = resolve(process.cwd(), "scripts/fixtures", name);
  return existsSync(p) ? readFileSync(p, "utf8").trim() : "";
}

type RunRow = {
  strategy: string;
  count: number;
  counts: ReturnType<typeof countVocabByBucket>;
  expressionTypes: number;
  allNounLike: boolean;
  verbScore: number;
  items: Array<{
    pos: string;
    surface: string;
    lemma: string;
    zh?: string;
  }>;
};

function verbScore(counts: ReturnType<typeof countVocabByBucket>): number {
  return counts.verb + counts.phrase;
}

describe.runIf(runLive)("vocabulary hypothesis compare (live)", () => {
  it("H1 full minimal B vocab section vs H2 split minimal B", async () => {
    const openai = createServerOpenAIClient({
      apiKey: apiKey!,
      timeout: 180_000,
      maxRetries: 1,
    });

    const cases: unknown[] = [];
    const wins: Record<string, { h1: number; h2: number; tie: number }> = {
      verbScore: { h1: 0, h2: 0, tie: 0 },
      notAllNoun: { h1: 0, h2: 0, tie: 0 },
    };

    for (const c of CASES) {
      const text = loadFixture(c.file);
      expect(text.length).toBeGreaterThan(80);

      const runs: RunRow[] = [];

      for (const strategy of STRATEGIES) {
        const label = STRATEGY_LABELS[strategy];
        // eslint-disable-next-line no-console
        console.log(`\n[${c.label}] ${label} ...`);
        const vocab = await requestVocabularyForStrategy(openai, strategy, {
          title: c.title,
          originalText: text,
          userLevel: "B1",
        });
        expect(vocab.length).toBeGreaterThan(0);
        const counts = countVocabByBucket(vocab);
        const row: RunRow = {
          strategy: label,
          count: vocab.length,
          counts,
          expressionTypes: countExpressionTypeVocabulary(vocab),
          allNounLike: isVocabularyAllNounLike(vocab),
          verbScore: verbScore(counts),
          items: vocab.map((v) => ({
            pos: v.part_of_speech,
            surface: v.surface_form,
            lemma: v.lemma,
            zh: v.zh_meaning,
          })),
        };
        runs.push(row);
        // eslint-disable-next-line no-console
        console.log(
          formatVocabPosCounts(counts),
          `allNoun=${row.allNounLike}`,
          `verbScore=${row.verbScore}`,
        );
      }

      const h1 = runs.find((r) => r.strategy === STRATEGY_LABELS.mini_single_full_minimal_b_vocab)!;
      const h2 = runs.find((r) => r.strategy === STRATEGY_LABELS.mini_split_minimal_b)!;

      const vs = (metric: "verbScore" | "notAllNoun") => {
        const a = metric === "verbScore" ? h1.verbScore : h1.allNounLike ? 0 : 1;
        const b = metric === "verbScore" ? h2.verbScore : h2.allNounLike ? 0 : 1;
        if (a > b) wins[metric].h1 += 1;
        else if (b > a) wins[metric].h2 += 1;
        else wins[metric].tie += 1;
      };
      vs("verbScore");
      vs("notAllNoun");

      cases.push({
        case: c.label,
        charCount: text.length,
        runs,
        h1_vs_h2: {
          verbScore: { h1: h1.verbScore, h2: h2.verbScore },
          allNounLike: { h1: h1.allNounLike, h2: h2.allNounLike },
        },
      });
    }

    const report = {
      generatedAt: new Date().toISOString(),
      model: "gpt-4o-mini",
      userLevel: "B1",
      hypotheses: {
        H1: "整文单次：vocabulary 段换极简 B，仍含 Grammar v2（mini_single_full_minimal_b_vocab）",
        H2: "拆分并行：第二次调用极简 B vocabulary-only（mini_split_minimal_b）",
        A0: "生产整文 Reset v1（mini_single）",
      },
      head_to_head_h1_vs_h2: {
        verbScore_wins: wins.verbScore,
        notAllNoun_wins: wins.notAllNoun,
        note: "verbScore = verb bucket + phrase bucket; notAllNoun = !allNounLike",
      },
      cases,
    };

    const outPath = resolve(
      process.cwd(),
      "scripts/vocabulary-hypothesis-compare-report.json",
    );
    writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
    // eslint-disable-next-line no-console
    console.log("\n=== H1 vs H2 (across fixtures) ===");
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(wins, null, 2));
    // eslint-disable-next-line no-console
    console.log(`Report: ${outPath}`);
  }, 900_000);
});

describe.runIf(!runLive)("vocabulary hypothesis compare (skipped)", () => {
  it("needs VOCAB_HYPOTHESIS_LIVE=1", () => {
    expect(true).toBe(true);
  });
});
