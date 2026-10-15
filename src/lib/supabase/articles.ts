import type { SupabaseClient } from "@supabase/supabase-js";
import type { CefrLevel } from "@/lib/types";
import {
  normalizeLearningLanguage,
  type LearningLanguage,
} from "@/lib/language/learningLanguage";

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
  /** 文章语言（010 迁移起）；未选列或旧数据按德语处理 */
  language?: string | null;
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
  /** 文章语言；缺省德语 */
  language?: LearningLanguage;
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
    language: normalizeLearningLanguage(payload.language),
    topic: null,
    summary_zh: null,
    summary_de_simple: null,
    detected_article_level: null,
  };
}

/**
 * 服务端：读取文章语言（以数据库为准）。
 * 查不到（mock 文章、列尚未迁移、无权限）时用 `fallback`，再回落德语。
 */
export async function resolveArticleLanguage(
  supabase: SupabaseClient,
  userId: string,
  articleId: string,
  fallback?: unknown,
): Promise<LearningLanguage> {
  if (isValidArticleId(articleId)) {
    const { data, error } = await supabase
      .from("articles")
      .select("language")
      .eq("id", articleId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!error && data && typeof data.language === "string") {
      return normalizeLearningLanguage(data.language);
    }
  }
  return normalizeLearningLanguage(fallback);
}
