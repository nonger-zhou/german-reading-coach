/**
 * 一次性清理：删除全部「系统语法」、清空文章摘要字段。
 *
 * 需要 .env.local：
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * 运行：npm run db:cleanup
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SYSTEM_GRAMMAR_SOURCES = [
  "ai",
  "ai_mock",
  "ai_detected",
  "ai_detected_then_user_confirmed",
];

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !service) {
  console.error(
    "需要 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY（写在 .env.local）",
  );
  process.exit(1);
}

const sb = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function countGrammarBySource() {
  const counts = {};
  for (const source of SYSTEM_GRAMMAR_SOURCES) {
    const { count, error } = await sb
      .from("grammar_items")
      .select("id", { count: "exact", head: true })
      .eq("source", source);
    if (error) throw error;
    counts[source] = count ?? 0;
  }
  const { count: manualCount, error: manualErr } = await sb
    .from("grammar_items")
    .select("id", { count: "exact", head: true })
    .eq("source", "manual");
  if (manualErr) throw manualErr;
  counts.manual = manualCount ?? 0;
  return counts;
}

async function main() {
  console.log("清理前 grammar_items 计数（按 source）：");
  console.log(await countGrammarBySource());

  const { data: toDelete, error: listErr } = await sb
    .from("grammar_items")
    .select("id,source")
    .in("source", SYSTEM_GRAMMAR_SOURCES);
  if (listErr) throw listErr;

  const ids = (toDelete ?? []).map((r) => r.id);
  console.log(`将删除 ${ids.length} 条系统语法 grammar_items（occurrences 级联删除）`);

  if (ids.length > 0) {
    const chunk = 200;
    for (let i = 0; i < ids.length; i += chunk) {
      const slice = ids.slice(i, i + chunk);
      const { error: delErr } = await sb
        .from("grammar_items")
        .delete()
        .in("id", slice);
      if (delErr) throw delErr;
    }
  }

  const { data: articlesBefore, error: artCountErr } = await sb
    .from("articles")
    .select("id")
    .or("summary_zh.neq.,summary_de_simple.neq.");
  if (artCountErr) throw artCountErr;

  const { error: summaryErr } = await sb
    .from("articles")
    .update({ summary_zh: null, summary_de_simple: null })
    .not("id", "is", null);
  if (summaryErr) throw summaryErr;

  console.log(
    `已清空 articles.summary_zh / summary_de_simple（约 ${articlesBefore?.length ?? "?"} 篇曾有非空摘要）`,
  );

  console.log("清理后 grammar_items 计数（按 source）：");
  console.log(await countGrammarBySource());
  console.log("完成。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
