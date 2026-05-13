import type { CefrLevel } from "@/lib/types";

/** 与 public.articles 对齐（客户端 select 常用字段） */
export type ArticleRow = {
  id: string;
  user_id: string;
  title: string | null;
  url: string | null;
  source_name: string | null;
  original_text: string | null;
  summary_zh: string | null;
  summary_de_simple: string | null;
  /** OpenAI 分析产生的阅读问题；PostgREST 返回 jsonb 解析结果（未选列时可能缺省） */
  reading_questions?: unknown;
  user_level_at_analysis: string | null;
  detected_article_level: string | null;
  topic: string | null;
  created_at: string;
  updated_at: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidArticleId(id: string): boolean {
  return UUID_RE.test(id.trim());
}

export function emptyToNull(s: string): string | null {
  const t = s.trim();
  return t.length > 0 ? t : null;
}

/** 将 `articles.reading_questions`（jsonb）规范为 string[] */
export function normalizeReadingQuestionsFromDb(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string");
  }
  return [];
}

export type NewArticlePayload = {
  user_id: string;
  title: string | null;
  url: string | null;
  source_name: string | null;
  original_text: string;
  user_level_at_analysis: CefrLevel;
};

/** 插入时显式置空的分析字段（DB 列可为 null） */
export function buildArticleInsertRow(payload: NewArticlePayload) {
  return {
    user_id: payload.user_id,
    title: payload.title,
    url: payload.url,
    source_name: payload.source_name,
    original_text: payload.original_text,
    user_level_at_analysis: payload.user_level_at_analysis,
    topic: null,
    summary_zh: null,
    summary_de_simple: null,
    detected_article_level: null,
  };
}
