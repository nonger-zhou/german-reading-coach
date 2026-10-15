/**
 * 审计词库中 AI 推荐词汇的词性分布与时间线；支持多账号合并。
 *
 * .env.local（跑完删除密钥行）：
 *   SUPABASE_SERVICE_ROLE_KEY=...   → 一次扫全库（两账户最省事）
 *   SUPABASE_AUDIT_USER_JWT=...     → 账户 A（先注册）
 *   SUPABASE_AUDIT_USER_JWT_2=...   → 账户 B（后注册）
 *
 * npm.cmd run audit:ai-vocab-pos
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

function collectUserJwts() {
  const tokens = [];
  const primary = process.env.SUPABASE_AUDIT_USER_JWT?.trim();
  if (primary) tokens.push({ label: "account_1", jwt: primary });
  for (let n = 2; n <= 5; n++) {
    const t = process.env[`SUPABASE_AUDIT_USER_JWT_${n}`]?.trim();
    if (t) tokens.push({ label: `account_${n}`, jwt: t });
  }
  return tokens;
}

if (!url || !anon) {
  console.error("需要 NEXT_PUBLIC_SUPABASE_URL 与 NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

function bucketPos(pos) {
  const raw = (pos ?? "").trim();
  const k = raw.toLowerCase();
  if (
    k === "noun" ||
    k === "compound_noun" ||
    k.includes("substantiv") ||
    raw === "名词" ||
    raw === "名词短语"
  )
    return "noun";
  if (
    k === "verb" ||
    k === "separable_verb" ||
    k === "verb_phrase" ||
    k.startsWith("verb") ||
    raw === "动词"
  )
    return "verb";
  if (k === "adjective" || k === "adj" || raw === "形容词") return "adjective";
  if (k === "adverb" || raw === "副词") return "adverb";
  if (
    k === "phrase" ||
    k === "collocation" ||
    k === "fixed_expression" ||
    k.includes("phrase")
  )
    return "phrase";
  return "other";
}

function isAllNounLike(items) {
  if (items.length < 2) return false;
  return items.every((it) => bucketPos(it.part_of_speech) === "noun");
}

function createSupabaseForJwt(jwt) {
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

function createSupabaseService() {
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchAllRows(client, table, select, pageSize = 1000) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await client
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function resolveAccountLabel(client, fallback) {
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return fallback;
  const u = data.user;
  return u.email ? u.email : `${fallback}:${u.id.slice(0, 8)}`;
}

function buildArticleRows(accountLabel, aiItems, occurrences, articles) {
  const articleById = new Map(articles.map((a) => [a.id, a]));
  const occByItem = new Map();
  for (const o of occurrences) {
    if (!occByItem.has(o.vocabulary_item_id))
      occByItem.set(o.vocabulary_item_id, []);
    occByItem.get(o.vocabulary_item_id).push(o);
  }

  const byArticle = new Map();
  for (const it of aiItems) {
    const occs = occByItem.get(it.id) ?? [];
    const articleIds = [
      ...new Set(occs.map((o) => o.article_id).filter(Boolean)),
    ];
    const targets = articleIds.length > 0 ? articleIds : ["__no_article__"];
    for (const aid of targets) {
      if (!byArticle.has(aid)) byArticle.set(aid, []);
      byArticle.get(aid).push(it);
    }
  }

  const articleRows = [];
  for (const [articleId, vocab] of byArticle) {
    const art = articleById.get(articleId);
    const buckets = {
      noun: 0,
      verb: 0,
      adjective: 0,
      adverb: 0,
      phrase: 0,
      other: 0,
    };
    for (const it of vocab) buckets[bucketPos(it.part_of_speech)] += 1;
    const ts =
      art?.created_at ??
      vocab.map((v) => v.created_at).sort()[0] ??
      null;
    articleRows.push({
      account: accountLabel,
      article_id: articleId,
      title: art?.title ?? "(无文章关联)",
      article_created_at: art?.created_at ?? null,
      timeline_at: ts,
      vocab_count: vocab.length,
      buckets,
      all_noun_like: isAllNounLike(vocab),
      has_verb: buckets.verb > 0,
      has_phrase: buckets.phrase > 0,
      source_mix: [...new Set(vocab.map((v) => v.source))],
      sample: vocab.slice(0, 6).map((v) => ({
        pos: v.part_of_speech,
        lemma: v.lemma,
        bucket: bucketPos(v.part_of_speech),
      })),
    });
  }

  articleRows.sort(
    (a, b) =>
      new Date(a.timeline_at || 0).getTime() -
      new Date(b.timeline_at || 0).getTime(),
  );
  return articleRows;
}

function perItemDistribution(aiItems) {
  const d = { total: aiItems.length, noun: 0, verb: 0, phrase: 0, other: 0 };
  for (const it of aiItems) {
    const b = bucketPos(it.part_of_speech);
    if (b === "noun") d.noun += 1;
    else if (b === "verb") d.verb += 1;
    else if (b === "phrase") d.phrase += 1;
    else d.other += 1;
  }
  return d;
}

async function auditFromRows(accountLabel, items, occurrences, articles) {
  const aiItems = items.filter((r) => {
    const s = (r.source ?? "").toLowerCase();
    return s === "ai" || s === "ai_mock";
  });
  const articleRows = buildArticleRows(
    accountLabel,
    aiItems,
    occurrences,
    articles,
  );
  return {
    account: accountLabel,
    totals: {
      vocabulary_items_all: items.length,
      ai_vocabulary_items: aiItems.length,
      articles_with_ai_vocab: articleRows.filter(
        (r) => r.article_id !== "__no_article__",
      ).length,
    },
    per_item_pos_distribution: perItemDistribution(aiItems),
    articles_chronological: articleRows,
  };
}

async function auditWithJwt(label, jwt) {
  const client = createSupabaseForJwt(jwt);
  const accountLabel = await resolveAccountLabel(client, label);
  const items = await fetchAllRows(
    client,
    "vocabulary_items",
    "id,user_id,lemma,display_word,part_of_speech,source,created_at,normalized_key",
  );
  const occurrences = await fetchAllRows(
    client,
    "vocabulary_occurrences",
    "id,vocabulary_item_id,article_id,source,created_at,user_id",
  );
  const articles = await fetchAllRows(
    client,
    "articles",
    "id,title,created_at,user_id",
  );
  return auditFromRows(accountLabel, items, occurrences, articles);
}

async function auditAllUsersWithServiceRole() {
  const client = createSupabaseService();
  const [items, occurrences, articles, profiles] = await Promise.all([
    fetchAllRows(
      client,
      "vocabulary_items",
      "id,user_id,lemma,display_word,part_of_speech,source,created_at,normalized_key",
    ),
    fetchAllRows(
      client,
      "vocabulary_occurrences",
      "id,vocabulary_item_id,article_id,source,created_at,user_id",
    ),
    fetchAllRows(client, "articles", "id,title,created_at,user_id"),
    fetchAllRows(client, "profiles", "id,email"),
  ]);

  const emailByUser = new Map(profiles.map((p) => [p.id, p.email]));

  const userIds = [
    ...new Set(
      items
        .filter((r) => {
          const s = (r.source ?? "").toLowerCase();
          return (s === "ai" || s === "ai_mock") && r.user_id;
        })
        .map((r) => r.user_id),
    ),
  ];

  const reports = [];
  for (const uid of userIds) {
    const label = emailByUser.get(uid) ?? `user_${uid.slice(0, 8)}`;
    reports.push(
      await auditFromRows(
        label,
        items.filter((r) => r.user_id === uid),
        occurrences.filter((r) => r.user_id === uid),
        articles.filter((r) => r.user_id === uid),
      ),
    );
  }
  return reports;
}

function mergeReports(accountReports, authMode) {
  const articles_chronological = accountReports
    .flatMap((r) => r.articles_chronological)
    .sort(
      (a, b) =>
        new Date(a.timeline_at || 0).getTime() -
        new Date(b.timeline_at || 0).getTime(),
    );

  const byMonth = new Map();
  for (const row of articles_chronological) {
    const d = row.timeline_at ? new Date(row.timeline_at) : null;
    const key = d
      ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
      : "unknown";
    if (!byMonth.has(key)) {
      byMonth.set(key, {
        month: key,
        articles: 0,
        all_noun_articles: 0,
        with_verb_articles: 0,
        total_vocab: 0,
        bucket_sum: { noun: 0, verb: 0, phrase: 0, other: 0 },
        by_account: {},
      });
    }
    const m = byMonth.get(key);
    m.articles += 1;
    if (row.all_noun_like) m.all_noun_articles += 1;
    if (row.has_verb) m.with_verb_articles += 1;
    m.total_vocab += row.vocab_count;
    m.bucket_sum.noun += row.buckets.noun;
    m.bucket_sum.verb += row.buckets.verb;
    m.bucket_sum.phrase += row.buckets.phrase;
    m.bucket_sum.other +=
      row.buckets.adjective + row.buckets.adverb + row.buckets.other;
    if (!m.by_account[row.account]) {
      m.by_account[row.account] = { articles: 0, all_noun: 0, with_verb: 0 };
    }
    m.by_account[row.account].articles += 1;
    if (row.all_noun_like) m.by_account[row.account].all_noun += 1;
    if (row.has_verb) m.by_account[row.account].with_verb += 1;
  }

  const month_timeline = [...byMonth.values()].sort((a, b) =>
    a.month.localeCompare(b.month),
  );

  const firstAllNoun = articles_chronological.find((r) => r.all_noun_like);

  const totals_merged = accountReports.reduce(
    (acc, r) => ({
      vocabulary_items_all:
        acc.vocabulary_items_all + r.totals.vocabulary_items_all,
      ai_vocabulary_items:
        acc.ai_vocabulary_items + r.totals.ai_vocabulary_items,
      articles_with_ai_vocab:
        acc.articles_with_ai_vocab + r.totals.articles_with_ai_vocab,
    }),
    {
      vocabulary_items_all: 0,
      ai_vocabulary_items: 0,
      articles_with_ai_vocab: 0,
    },
  );

  const per_item_pos_distribution_merged = accountReports.reduce(
    (acc, r) => {
      const p = r.per_item_pos_distribution;
      return {
        total: acc.total + p.total,
        noun: acc.noun + p.noun,
        verb: acc.verb + p.verb,
        phrase: acc.phrase + p.phrase,
        other: acc.other + p.other,
      };
    },
    { total: 0, noun: 0, verb: 0, phrase: 0, other: 0 },
  );

  return {
    generatedAt: new Date().toISOString(),
    auth_mode: authMode,
    accounts: accountReports.map((r) => ({
      account: r.account,
      totals: r.totals,
      per_item_pos_distribution: r.per_item_pos_distribution,
    })),
    totals_merged,
    per_item_pos_distribution_merged,
    month_timeline,
    inference: {
      first_all_noun_article_merged: firstAllNoun
        ? {
            account: firstAllNoun.account,
            timeline_at: firstAllNoun.timeline_at,
            title: firstAllNoun.title,
            vocab_count: firstAllNoun.vocab_count,
          }
        : null,
      note: "all_noun_like：≥2 条且均为名词类（含中文「名词」）",
    },
    articles_chronological,
  };
}

async function main() {
  let accountReports = [];
  let authMode = "none";

  if (service) {
    authMode = "service_role_all_users";
    console.log("模式：SUPABASE_SERVICE_ROLE_KEY（全库所有用户）");
    accountReports = await auditAllUsersWithServiceRole();
  } else {
    const jwts = collectUserJwts();
    if (jwts.length === 0) {
      console.error(
        "请配置 SUPABASE_SERVICE_ROLE_KEY，或 SUPABASE_AUDIT_USER_JWT + SUPABASE_AUDIT_USER_JWT_2",
      );
      process.exit(1);
    }
    authMode =
      jwts.length === 1 ? "user_jwt_single" : `user_jwt_${jwts.length}_accounts`;
    for (const { label, jwt } of jwts) {
      console.log(`模式：JWT → ${label}`);
      accountReports.push(await auditWithJwt(label, jwt));
    }
  }

  if (accountReports.every((r) => r.totals.ai_vocabulary_items === 0)) {
    console.warn("未读到任何 AI 词条，请检查登录账户或密钥");
  }

  const report = mergeReports(accountReports, authMode);
  const outPath = resolve(
    process.cwd(),
    "scripts/ai-vocabulary-pos-timeline-report.json",
  );
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log("\n=== 合并汇总 ===");
  console.log(JSON.stringify(report.totals_merged, null, 2));
  console.log("\n=== 分账户 ===");
  for (const a of report.accounts) {
    console.log(
      `${a.account} | AI=${a.totals.ai_vocabulary_items} | 文章=${a.totals.articles_with_ai_vocab} | noun/verb=${a.per_item_pos_distribution.noun}/${a.per_item_pos_distribution.verb}`,
    );
  }
  console.log("\n=== 逐月（合并，含 by_account）===");
  for (const m of report.month_timeline) {
    console.log(
      `${m.month} | 文章=${m.articles} | 全名词=${m.all_noun_articles} | 含动词=${m.with_verb_articles}`,
      JSON.stringify(m.by_account),
    );
  }
  if (report.inference.first_all_noun_article_merged) {
    console.log("\n最早全名词文章（合并时间线）:");
    console.log(JSON.stringify(report.inference.first_all_noun_article_merged, null, 2));
  }
  console.log(`\n报告: ${outPath}`);
  console.log(
    "\n请删除 .env.local 中的 SUPABASE_AUDIT_USER_JWT、SUPABASE_AUDIT_USER_JWT_2、SUPABASE_SERVICE_ROLE_KEY",
  );
}

main().catch((e) => {
  if (e?.code === "42501" || String(e?.message ?? "").includes("permission denied")) {
    console.error("\n权限不足：请使用 service_role 或有效 JWT。\n");
  } else {
    console.error(e);
  }
  process.exit(1);
});
