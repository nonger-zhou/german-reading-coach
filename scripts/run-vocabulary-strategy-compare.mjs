/**
 * 本地一次性对比并写入 JSON 报告（需 .env.local 中 OPENAI_API_KEY）
 * node scripts/run-vocabulary-strategy-compare.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function loadEnvLocal() {
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
if (!apiKey) {
  console.error("缺少 OPENAI_API_KEY（.env.local）");
  process.exit(1);
}

// 通过 tsx 加载 TS 模块
const { register } = await import("tsx/esm/api").catch(() => ({}));
if (register) register();

const { createServerOpenAIClient } = await import(
  "../src/lib/openai/createServerOpenAIClient.ts"
);
const { requestVocabularyForStrategy } = await import(
  "../src/lib/articleAnalysis/articleAnalysisExperiments.ts"
);
const {
  countExpressionTypeVocabulary,
  countVocabByBucket,
  isVocabularyAllNounLike,
} = await import(
  "../src/lib/articleAnalysis/vocabularyRegressionDiagnostic.ts"
);

const STRATEGIES = ["mini_single", "gpt4o_single", "mini_split"];
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
];

const openai = createServerOpenAIClient({
  apiKey,
  timeout: 180_000,
  maxRetries: 1,
});

const report = [];

for (const c of CASES) {
  const text = readFileSync(
    resolve(process.cwd(), "scripts/fixtures", c.file),
    "utf8",
  ).trim();
  for (const strategy of STRATEGIES) {
    console.log(`Running ${c.label} / ${strategy}...`);
    const vocab = await requestVocabularyForStrategy(openai, strategy, {
      title: c.title,
      originalText: text,
      userLevel: "B1",
    });
    const counts = countVocabByBucket(vocab);
    report.push({
      case: c.label,
      strategy,
      counts,
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
  "scripts/vocabulary-strategy-compare-report.json",
);
writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
console.log(`Wrote ${outPath}`);
console.log(JSON.stringify(report, null, 2));
