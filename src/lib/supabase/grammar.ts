import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ArticleGrammarItem,
  GrammarOccurrence,
} from "@/lib/articleReadingTypes";
import { validateGrammarLabel } from "@/lib/grammar/labelValidation";
import { extractSentence } from "@/lib/articleReadingModel";
import type { MasteryStatus } from "@/lib/types";
import { formatSupabaseOrUnknownError } from "@/lib/supabase/errors";

const DB_SOURCE_MANUAL = "manual";
const DB_SOURCE_AI_MOCK = "ai_mock";
const DB_SOURCE_AI = "ai";

export function mapDbGrammarSourceToArticle(
  source: string | null,
): ArticleGrammarItem["source"] {
  if (source === DB_SOURCE_MANUAL) return "user_added";
  if (source === DB_SOURCE_AI_MOCK) return "ai_mock";
  if (source === DB_SOURCE_AI) return "ai";
  if (source === "ai_detected") return "ai_detected";
  if (source === "ai_detected_then_user_confirmed")
    return "ai_detected_then_user_confirmed";
  return "user_added";
}

function mapOccSource(s: string | null): GrammarOccurrence["source"] {
  if (
    s === "ai_detected" ||
    s === DB_SOURCE_AI_MOCK ||
    s === DB_SOURCE_AI
  ) {
    return "ai_detected";
  }
  return "user_added";
}

function clampMastery(s: string | null): MasteryStatus {
  const v = (s ?? "new").toLowerCase();
  if (
    v === "mastered" ||
    v === "ignored" ||
    v === "learning" ||
    v === "familiar"
  ) {
    return v as MasteryStatus;
  }
  return "new";
}

function isMissingDeepNoteColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; message?: unknown };
  const message = typeof e.message === "string" ? e.message : "";
  return (
    e.code === "42703" ||
    message.includes("user_deep_note") ||
    message.includes("user_deep_note_updated_at")
  );
}

type GrammarItemRow = {
  id: string;
  grammar_key: string;
  normalized_key: string;
  name_de: string | null;
  name_zh: string | null;
  explanation_zh: string | null;
  explanation_de_simple: string | null;
  level_estimate: string | null;
  mastery_status: string | null;
  source: string | null;
  needs_ai_enrichment: boolean | null;
  user_deep_note?: string | null;
  user_deep_note_updated_at?: string | null;
};

type GrammarOccurrenceRow = {
  id: string;
  grammar_item_id: string;
  selected_text: string | null;
  sentence: string | null;
  start_offset: number | null;
  end_offset: number | null;
  fallback_match_text: string | null;
  source: string | null;
};

const GRAMMAR_MASTERED_IGNORED_PAGE = 1000;

/**
 * 整文分析：拉取当前用户总语法库中 **已掌握 / 暂忽略** 的
 * `grammar_key` + `normalized_key`（分页全量，顺序稳定）。
 */
export async function fetchGrammarMasteredIgnoredKeysForArticleAnalysis(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  rows: Array<{ grammar_key: string | null; normalized_key: string | null }>;
  error: string | null;
}> {
  const rows: Array<{
    grammar_key: string | null;
    normalized_key: string | null;
  }> = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("grammar_items")
      .select("grammar_key, normalized_key")
      .eq("user_id", userId)
      .in("mastery_status", ["mastered", "ignored"])
      .order("id", { ascending: true })
      .range(from, from + GRAMMAR_MASTERED_IGNORED_PAGE - 1);
    if (error) {
      return { rows: [], error: formatSupabaseOrUnknownError(error) };
    }
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < GRAMMAR_MASTERED_IGNORED_PAGE) break;
    from += GRAMMAR_MASTERED_IGNORED_PAGE;
  }
  return { rows, error: null };
}

export async function fetchArticleManualGrammar(
  supabase: SupabaseClient,
  articleId: string,
): Promise<ArticleGrammarItem[]> {
  const { data: occRows, error: occErr } = await supabase
    .from("grammar_occurrences")
    .select(
      "id,grammar_item_id,selected_text,sentence,start_offset,end_offset,fallback_match_text,source",
    )
    .eq("article_id", articleId);

  if (occErr) throw occErr;
  if (!occRows?.length) return [];

  const itemIds = [
    ...new Set(
      (occRows as GrammarOccurrenceRow[]).map((r) => r.grammar_item_id),
    ),
  ];

  const itemSelectWithDeepNote =
    "id,grammar_key,normalized_key,name_de,name_zh,explanation_zh,explanation_de_simple,level_estimate,mastery_status,source,needs_ai_enrichment,user_deep_note,user_deep_note_updated_at";
  const itemSelectBase =
    "id,grammar_key,normalized_key,name_de,name_zh,explanation_zh,explanation_de_simple,level_estimate,mastery_status,source,needs_ai_enrichment";

  const initialItemsResult = await supabase
    .from("grammar_items")
    .select(itemSelectWithDeepNote)
    .in("id", itemIds)
    .in("source", [DB_SOURCE_MANUAL, DB_SOURCE_AI_MOCK, DB_SOURCE_AI]);
  let itemRows: unknown[] | null = initialItemsResult.data;
  let itemErr: unknown = initialItemsResult.error;

  if (itemErr && isMissingDeepNoteColumn(itemErr)) {
    const fallback = await supabase
      .from("grammar_items")
      .select(itemSelectBase)
      .in("id", itemIds)
      .in("source", [DB_SOURCE_MANUAL, DB_SOURCE_AI_MOCK, DB_SOURCE_AI]);
    itemRows = fallback.data;
    itemErr = fallback.error;
  }

  if (itemErr) throw itemErr;
  const items = (itemRows ?? []) as GrammarItemRow[];
  if (!items.length) return [];

  const manualIds = new Set(items.map((i) => i.id));

  const occByItem = new Map<string, GrammarOccurrenceRow[]>();
  for (const o of occRows as GrammarOccurrenceRow[]) {
    if (!manualIds.has(o.grammar_item_id)) continue;
    const list = occByItem.get(o.grammar_item_id) ?? [];
    list.push(o);
    occByItem.set(o.grammar_item_id, list);
  }

  const out: ArticleGrammarItem[] = [];

  for (const row of items) {
    const occs = occByItem.get(row.id);
    if (!occs?.length) continue;

    const surface =
      row.name_de ?? occs[0]?.selected_text ?? occs[0]?.fallback_match_text ?? "";

    const occurrences: GrammarOccurrence[] = occs.map((o) => ({
      id: o.id,
      surface_form: o.selected_text ?? o.fallback_match_text ?? "",
      sentence: o.sentence ?? "",
      start_offset: o.start_offset ?? undefined,
      end_offset: o.end_offset ?? undefined,
      fallbackMatchText: o.fallback_match_text ?? o.selected_text ?? "",
      source: mapOccSource(o.source),
    }));

    const firstSentence = occurrences[0]?.sentence ?? "";
    const firstSurface = occurrences[0]?.surface_form ?? "";
    const validated = validateGrammarLabel(
      {
        name_de: row.name_de ?? "Grammar",
        name_zh: row.name_zh ?? "语法点",
        explanation_zh: row.explanation_zh ?? "待 AI 补充",
        explanation_de_simple:
          row.explanation_de_simple ?? "Wird später ergänzt.",
      },
      {
        sentence: firstSentence,
        selectedText: firstSurface,
      },
    );

    out.push({
      id: `grammar-${row.id}`,
      dbItemId: row.id,
      persisted: true,
      grammar_key: row.grammar_key,
      normalized_key: row.normalized_key,
      name_de: validated.name_de || surface,
      name_zh: validated.name_zh || "用户标记的语法问题",
      explanation_zh: validated.fixed_expression
        ? `${validated.explanation_zh}\n固定表达：${validated.fixed_expression}（某人缺少某物 / 某方面不足）`
        : validated.explanation_zh,
      explanation_de_simple: validated.explanation_de_simple ?? undefined,
      level_estimate: row.level_estimate ?? undefined,
      mastery_status: clampMastery(row.mastery_status),
      source: mapDbGrammarSourceToArticle(row.source),
      needs_ai_enrichment: row.needs_ai_enrichment ?? false,
      user_deep_note: row.user_deep_note,
      user_deep_note_updated_at: row.user_deep_note_updated_at,
      occurrences,
    });
  }

  return out;
}

export async function persistManualGrammarItem(
  supabase: SupabaseClient,
  params: {
    userId: string;
    articleId: string;
    articlePlain: string;
    item: ArticleGrammarItem;
  },
): Promise<{ item: ArticleGrammarItem | null; error: string | null }> {
  const { userId, articleId, articlePlain, item } = params;
  const nk = item.normalized_key;
  const gkey = nk;
  const dbSource =
    item.source === "ai_mock"
      ? DB_SOURCE_AI_MOCK
      : item.source === "ai"
        ? DB_SOURCE_AI
        : DB_SOURCE_MANUAL;
  const defaultNeedsAi =
    item.source === "ai_mock" || item.source === "ai" ? false : true;

  try {
    const { data: existingRow, error: findErr } = await supabase
      .from("grammar_items")
      .select("id,mastery_status")
      .eq("user_id", userId)
      .eq("grammar_key", gkey)
      .eq("normalized_key", nk)
      .maybeSingle();

    if (findErr) throw findErr;

    let grammarItemId: string;

    if (existingRow) {
      grammarItemId = existingRow.id as string;
      const { error: upErr } = await supabase
        .from("grammar_items")
        .update({
          last_seen_at: new Date().toISOString(),
          name_de: item.name_de,
          explanation_zh: item.explanation_zh,
          explanation_de_simple:
            item.explanation_de_simple ?? "Wird später ergänzt.",
          level_estimate: item.level_estimate ?? null,
          /** 与旧 Mock（ai_mock）同键合并时，真实 AI 保存须升级为 ai，并同步名称文案 */
          ...(item.source === "ai"
            ? {
                source: DB_SOURCE_AI,
                needs_ai_enrichment: false,
                name_zh: item.name_zh,
              }
            : {}),
        })
        .eq("id", grammarItemId)
        .eq("user_id", userId);

      if (upErr) throw upErr;
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("grammar_items")
        .insert({
          user_id: userId,
          grammar_key: gkey,
          normalized_key: nk,
          name_de: item.name_de,
          name_zh: item.name_zh,
          explanation_zh: item.explanation_zh ?? "待 AI 补充",
          explanation_de_simple:
            item.explanation_de_simple ?? "Wird später ergänzt.",
          mastery_status: item.mastery_status,
          source: dbSource,
          needs_ai_enrichment: defaultNeedsAi,
          level_estimate: item.level_estimate ?? null,
          last_seen_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insErr) throw insErr;
      grammarItemId = inserted!.id as string;
    }

    const nextOccurrences: GrammarOccurrence[] = [];

    for (const occ of item.occurrences) {
      const start = occ.start_offset;
      const end = occ.end_offset;
      const fallback = occ.fallbackMatchText || occ.surface_form;

      let existingId: string | null = null;

      if (start !== undefined && end !== undefined) {
        const { data: hit } = await supabase
          .from("grammar_occurrences")
          .select("id")
          .eq("article_id", articleId)
          .eq("grammar_item_id", grammarItemId)
          .eq("start_offset", start)
          .eq("end_offset", end)
          .maybeSingle();
        existingId = (hit?.id as string) ?? null;
      }

      const sentence =
        occ.sentence ||
        (start !== undefined && end !== undefined
          ? extractSentence(articlePlain, start, end)
          : "（未定位原文，手动添加）");

      if (existingId) {
        nextOccurrences.push({
          ...occ,
          id: existingId,
          sentence,
        });
        continue;
      }

      const { data: occIns, error: occErr } = await supabase
        .from("grammar_occurrences")
        .insert({
          user_id: userId,
          grammar_item_id: grammarItemId,
          article_id: articleId,
          selected_text: occ.surface_form,
          sentence,
          start_offset: start ?? null,
          end_offset: end ?? null,
          fallback_match_text: fallback,
          source: dbSource,
        })
        .select("id")
        .single();

      if (occErr) throw occErr;

      nextOccurrences.push({
        ...occ,
        id: occIns!.id as string,
        sentence,
      });
    }

    const updatedItem: ArticleGrammarItem = {
      ...item,
      id: item.id,
      dbItemId: grammarItemId,
      persisted: true,
      grammar_key: gkey,
      normalized_key: nk,
      occurrences: nextOccurrences,
    };

    return { item: updatedItem, error: null };
  } catch (e: unknown) {
    return { item: null, error: formatSupabaseOrUnknownError(e) };
  }
}

/**
 * 从指定文章移除该语法条目的全部 occurrence（仅 `article_id` + `grammar_item_id`）。
 * 不删除 `grammar_items`；其它文章中的 occurrence 不受影响。
 * 与「忽略 ignored」不同：删除用于误添加/重复/错误保存，不是掌握状态。
 */
export async function deleteArticleGrammarItemOccurrences(
  supabase: SupabaseClient,
  params: {
    userId: string;
    articleId: string;
    grammarItemId: string;
  },
): Promise<{ error: string | null }> {
  const { userId, articleId, grammarItemId } = params;
  try {
    const { error } = await supabase
      .from("grammar_occurrences")
      .delete()
      .eq("user_id", userId)
      .eq("article_id", articleId)
      .eq("grammar_item_id", grammarItemId);
    if (error) throw error;
    return { error: null };
  } catch (e: unknown) {
    return { error: formatSupabaseOrUnknownError(e) };
  }
}

export async function updateGrammarItemMastery(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
  status: MasteryStatus,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("grammar_items")
    .update({ mastery_status: status })
    .eq("id", itemId)
    .eq("user_id", userId);

  return {
    error: error ? formatSupabaseOrUnknownError(error) : null,
  };
}

export async function updateGrammarItemDeepNote(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
  note: string,
): Promise<{ note: string | null; updatedAt: string | null; error: string | null }> {
  const trimmed = note.trim();
  const updatedAt = trimmed ? new Date().toISOString() : null;
  const { error } = await supabase
    .from("grammar_items")
    .update({
      user_deep_note: trimmed || null,
      user_deep_note_updated_at: updatedAt,
    })
    .eq("id", itemId)
    .eq("user_id", userId);

  if (error && isMissingDeepNoteColumn(error)) {
    return {
      note: null,
      updatedAt: null,
      error:
        "深度笔记字段尚未添加。请先在 Supabase SQL Editor 执行 supabase/fixes/008_learning_item_deep_notes.sql。",
    };
  }

  return {
    note: trimmed || null,
    updatedAt,
    error: error ? formatSupabaseOrUnknownError(error) : null,
  };
}

/** 单条语法 AI 补全：写入 grammar_items */
export async function applyGrammarAiEnrichment(
  supabase: SupabaseClient,
  params: {
    userId: string;
    grammarItemId: string;
    name_de: string;
    name_zh: string;
    explanation_zh: string;
    explanation_de_simple: string;
    level_estimate: string | null;
  },
): Promise<{ error: string | null }> {
  const {
    userId,
    grammarItemId,
    name_de,
    name_zh,
    explanation_zh,
    explanation_de_simple,
    level_estimate,
  } = params;

  try {
    const { error } = await supabase
      .from("grammar_items")
      .update({
        name_de,
        name_zh,
        explanation_zh,
        explanation_de_simple,
        level_estimate: level_estimate ?? null,
        needs_ai_enrichment: false,
      })
      .eq("id", grammarItemId)
      .eq("user_id", userId);

    if (error) throw error;
    return { error: null };
  } catch (e: unknown) {
    return { error: formatSupabaseOrUnknownError(e) };
  }
}
