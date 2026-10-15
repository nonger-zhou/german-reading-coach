/**
 * 德语 / 英语数据隔离：词库画像、写入去重、语法过滤、复习排期都只针对当前语言。
 * 用一个记录调用的假 Supabase 客户端验证查询条件，不连真实数据库。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_LEARNING_LANGUAGE,
  normalizeLearningLanguage,
} from "@/lib/language/learningLanguage";
import {
  fetchVocabularyMasteredIgnoredKeysForArticleAnalysis,
  fetchVocabularyProfileRowsForArticleAnalysis,
  persistManualVocabularyItem,
} from "@/lib/supabase/vocabulary";
import {
  fetchGrammarMasteredIgnoredKeysForArticleAnalysis,
  persistManualGrammarItem,
} from "@/lib/supabase/grammar";
import { buildArticleInsertRow, resolveArticleLanguage } from "@/lib/supabase/articles";
import {
  loadReviewState,
  pruneReviewState,
  reviewStorageKey,
  saveReviewState,
} from "@/lib/review/reviewQueue";
import type { ArticleGrammarItem, ArticleVocabItem } from "@/lib/articleReadingTypes";

type Call = { table: string; op: string; filters: Array<[string, string, unknown]>; payload?: unknown };

/** 可链式调用的假 Supabase：记录每次查询的表、操作、过滤条件；按表返回预设数据 */
function fakeSupabase(responses: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  let idCounter = 0;
  const from = (table: string) => {
    const call: Call = { table, op: "select", filters: [] };
    calls.push(call);
    const result = () => {
      if (call.op === "insert") {
        idCounter += 1;
        return { data: { id: `${table}-new-${idCounter}` }, error: null };
      }
      if (call.op === "update" || call.op === "delete") return { data: null, error: null };
      const preset = responses[table];
      return { data: preset ?? [], error: null };
    };
    const builder: Record<string, unknown> = {};
    const chain = (name: string) => (...args: unknown[]) => {
      if (name === "eq" || name === "neq" || name === "in" || name === "gte") {
        call.filters.push([name, String(args[0]), args[1]]);
      }
      return builder;
    };
    for (const m of ["select", "eq", "neq", "in", "gte", "order", "range", "limit"]) {
      builder[m] = chain(m);
    }
    builder.insert = (payload: unknown) => {
      call.op = "insert";
      call.payload = payload;
      return builder;
    };
    builder.update = (payload: unknown) => {
      call.op = "update";
      call.payload = payload;
      return builder;
    };
    builder.delete = () => {
      call.op = "delete";
      return builder;
    };
    builder.single = async () => result();
    builder.maybeSingle = async () => {
      const r = result();
      const d = Array.isArray(r.data) ? (r.data[0] ?? null) : r.data;
      return { data: d, error: null };
    };
    builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result()).then(resolve, reject);
    return builder;
  };
  return { client: { from } as unknown as SupabaseClient, calls };
}

function languageFilter(call: Call): unknown {
  return call.filters.find(([op, col]) => op === "eq" && col === "language")?.[2];
}

const ARTICLE_TEXT = "The die is cast. Der Würfel ist gefallen.";

function vocabItem(overrides: Partial<ArticleVocabItem> = {}): ArticleVocabItem {
  return {
    id: "ui-1",
    display_word: "die",
    lemma: "die",
    normalized_key: "die",
    part_of_speech: "noun",
    zh_meaning: "骰子",
    simple_de_explanation: "a small cube with dots",
    mastery_status: "learning",
    source: "manual",
    occurrences: [],
    ...overrides,
  } as ArticleVocabItem;
}

describe("learning language basics", () => {
  it("unknown / missing values fall back to German", () => {
    expect(DEFAULT_LEARNING_LANGUAGE).toBe("de");
    expect(normalizeLearningLanguage(undefined)).toBe("de");
    expect(normalizeLearningLanguage(null)).toBe("de");
    expect(normalizeLearningLanguage("fr")).toBe("de");
    expect(normalizeLearningLanguage("en")).toBe("en");
  });

  it("new articles default to German; English only when asked", () => {
    const base = {
      user_id: "u",
      title: "t",
      url: null,
      source_name: null,
      original_text: "x",
      user_level_at_analysis: "B1" as const,
    };
    expect(buildArticleInsertRow(base).language).toBe("de");
    expect(buildArticleInsertRow({ ...base, language: "en" }).language).toBe("en");
  });
});

describe("article analysis reads only the current language's library", () => {
  it("vocabulary profile query filters by language (default German)", async () => {
    const de = fakeSupabase();
    await fetchVocabularyProfileRowsForArticleAnalysis(de.client, "u1");
    expect(languageFilter(de.calls[0])).toBe("de");

    const en = fakeSupabase();
    await fetchVocabularyProfileRowsForArticleAnalysis(en.client, "u1", "en");
    expect(languageFilter(en.calls[0])).toBe("en");
  });

  it("mastered / ignored keys and grammar filters are per language", async () => {
    const v = fakeSupabase();
    await fetchVocabularyMasteredIgnoredKeysForArticleAnalysis(v.client, "u1", "en");
    expect(languageFilter(v.calls[0])).toBe("en");

    const g = fakeSupabase();
    await fetchGrammarMasteredIgnoredKeysForArticleAnalysis(g.client, "u1", "en");
    expect(languageFilter(g.calls[0])).toBe("en");

    const gDe = fakeSupabase();
    await fetchGrammarMasteredIgnoredKeysForArticleAnalysis(gDe.client, "u1");
    expect(languageFilter(gDe.calls[0])).toBe("de");
  });

  it("article language comes from the database, falling back to the request, then German", async () => {
    const id = "11111111-2222-3333-4444-555555555555";
    const stored = fakeSupabase({ articles: [{ language: "en" }] });
    expect(await resolveArticleLanguage(stored.client, "u1", id, "de")).toBe("en");

    const missing = fakeSupabase({ articles: [] });
    expect(await resolveArticleLanguage(missing.client, "u1", id, "en")).toBe("en");
    expect(await resolveArticleLanguage(missing.client, "u1", "mock", undefined)).toBe("de");
  });
});

describe("saving words never merges German and English entries", () => {
  it("English 'die' is looked up and inserted as English, not merged into German 'die'", async () => {
    const { client, calls } = fakeSupabase();
    await persistManualVocabularyItem(client, {
      userId: "u1",
      articleId: "a1",
      articlePlain: ARTICLE_TEXT,
      item: vocabItem(),
      language: "en",
    });
    const lookup = calls.find((c) => c.table === "vocabulary_items" && c.op === "select");
    expect(lookup && languageFilter(lookup)).toBe("en");
    const insert = calls.find((c) => c.table === "vocabulary_items" && c.op === "insert");
    expect((insert?.payload as { language?: string }).language).toBe("en");
  });

  it("without a language the save path stays German (old behaviour)", async () => {
    const { client, calls } = fakeSupabase();
    await persistManualVocabularyItem(client, {
      userId: "u1",
      articleId: "a1",
      articlePlain: ARTICLE_TEXT,
      item: vocabItem({ lemma: "der Würfel", display_word: "Würfel", normalized_key: "würfel" }),
    });
    const lookup = calls.find((c) => c.table === "vocabulary_items" && c.op === "select");
    expect(lookup && languageFilter(lookup)).toBe("de");
    const insert = calls.find((c) => c.table === "vocabulary_items" && c.op === "insert");
    expect((insert?.payload as { language?: string }).language).toBe("de");
  });

  it("grammar items are keyed per language too", async () => {
    const { client, calls } = fakeSupabase();
    const item = {
      id: "g-ui",
      name_de: "present perfect",
      name_zh: "现在完成时",
      normalized_key: "has been",
      explanation_zh: "",
      mastery_status: "learning",
      source: "manual",
      occurrences: [],
    } as unknown as ArticleGrammarItem;
    await persistManualGrammarItem(client, {
      userId: "u1",
      articleId: "a1",
      articlePlain: "It has been a long day.",
      item,
      language: "en",
    });
    const lookup = calls.find((c) => c.table === "grammar_items" && c.op === "select");
    expect(lookup && languageFilter(lookup)).toBe("en");
    const insert = calls.find((c) => c.table === "grammar_items" && c.op === "insert");
    expect((insert?.payload as { language?: string }).language).toBe("en");
  });
});

describe("review schedule is stored per language", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("German keeps the original key so existing progress survives", () => {
    expect(reviewStorageKey("u1")).toBe("grc.review.v1.u1");
    expect(reviewStorageKey("u1", "de")).toBe("grc.review.v1.u1");
    expect(reviewStorageKey("u1", "en")).toBe("grc.review.v1.en.u1");
  });

  it("an English review session (which prunes) leaves German progress untouched", () => {
    const dueLater = new Date(Date.now() + 86_400_000).toISOString();
    // 已有的德语进度（旧 key）
    store.set("grc.review.v1.u1", JSON.stringify({ "de-word": { box: 3, due: dueLater } }));

    // 英语复习：加载 → 只保留英语学习中的词 → 保存
    const enState = pruneReviewState(loadReviewState("u1", "en"), new Set(["en-word"]));
    saveReviewState("u1", { ...enState, "en-word": { box: 1, due: dueLater } }, "en");

    expect(loadReviewState("u1", "de")).toEqual({ "de-word": { box: 3, due: dueLater } });
    expect(loadReviewState("u1", "en")).toEqual({ "en-word": { box: 1, due: dueLater } });
  });
});
