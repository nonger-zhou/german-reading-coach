import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ArticleVocabItem,
  VocabOccurrence,
  VocabSense,
} from "@/lib/articleReadingTypes";
import { extractSentence } from "@/lib/articleReadingModel";
import type { MasteryStatus } from "@/lib/types";
import { formatSupabaseOrUnknownError } from "@/lib/supabase/errors";
import { mergeLemmaForVocabularyPersist } from "@/lib/supabase/vocabularyLemmaMerge";
import { parseGrammaticalGender } from "@/lib/vocabulary/grammaticalGender";

const DB_SOURCE_MANUAL = "manual";
const DB_SOURCE_AI_MOCK = "ai_mock";
const DB_SOURCE_AI = "ai";

/** DB `part_of_speech`：空串参与唯一约束；兼容阅读页旧文案「用户添加」 */
export function vocabPartOfSpeechForDb(ui: string): string {
  if (!ui || ui.trim() === "" || ui === "用户添加") return "";
  return ui.trim();
}

export function mapDbVocabSourceToArticle(
  source: string | null,
): ArticleVocabItem["source"] {
  if (source === DB_SOURCE_MANUAL) return "user_added";
  if (source === DB_SOURCE_AI_MOCK) return "ai_mock";
  if (source === DB_SOURCE_AI) return "ai";
  if (source === "ai_detected") return "ai_detected";
  if (source === "ai_detected_then_user_confirmed")
    return "ai_detected_then_user_confirmed";
  return "user_added";
}

function mapOccSource(s: string | null): VocabOccurrence["source"] {
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

type VocabularyItemRow = {
  id: string;
  lemma: string | null;
  display_word: string | null;
  normalized_key: string;
  part_of_speech: string | null;
  zh_meaning: string | null;
  simple_de_explanation: string | null;
  mastery_status: string | null;
  source: string | null;
  needs_ai_enrichment: boolean | null;
  level_estimate: string | null;
  gender?: string | null;
  user_deep_note?: string | null;
  user_deep_note_updated_at?: string | null;
};

type VocabularySenseRow = {
  id: string;
  vocabulary_item_id: string;
  zh_meaning: string | null;
  simple_de_explanation: string | null;
  domain: string | null;
  example_sentence: string | null;
};

type VocabularyOccurrenceRow = {
  id: string;
  vocabulary_item_id: string;
  vocabulary_sense_id: string | null;
  surface_form: string | null;
  sentence: string | null;
  start_offset: number | null;
  end_offset: number | null;
  fallback_match_text: string | null;
  source: string | null;
};

/** 加载当前用户在指定文章上的词汇（source = manual / ai_mock / ai） */
function vocabularyGenderForDb(item: ArticleVocabItem): string | null {
  const g = parseGrammaticalGender(item.grammatical_gender);
  return g === "na" ? null : g;
}

export async function fetchArticleManualVocabulary(
  supabase: SupabaseClient,
  articleId: string,
): Promise<ArticleVocabItem[]> {
  const { data: occRows, error: occErr } = await supabase
    .from("vocabulary_occurrences")
    .select(
      "id,vocabulary_item_id,vocabulary_sense_id,surface_form,sentence,start_offset,end_offset,fallback_match_text,source",
    )
    .eq("article_id", articleId);

  if (occErr) throw occErr;
  if (!occRows?.length) return [];

  const itemIds = [
    ...new Set(
      (occRows as VocabularyOccurrenceRow[]).map((r) => r.vocabulary_item_id),
    ),
  ];

  const itemSelectWithDeepNote =
    "id,lemma,display_word,normalized_key,part_of_speech,gender,zh_meaning,simple_de_explanation,mastery_status,source,needs_ai_enrichment,level_estimate,user_deep_note,user_deep_note_updated_at";
  const itemSelectBase =
    "id,lemma,display_word,normalized_key,part_of_speech,gender,zh_meaning,simple_de_explanation,mastery_status,source,needs_ai_enrichment,level_estimate";

  const initialItemsResult = await supabase
    .from("vocabulary_items")
    .select(itemSelectWithDeepNote)
    .in("id", itemIds)
    .in("source", [DB_SOURCE_MANUAL, DB_SOURCE_AI_MOCK, DB_SOURCE_AI]);
  let itemRows: unknown[] | null = initialItemsResult.data;
  let itemErr: unknown = initialItemsResult.error;

  if (itemErr && isMissingDeepNoteColumn(itemErr)) {
    const fallback = await supabase
      .from("vocabulary_items")
      .select(itemSelectBase)
      .in("id", itemIds)
      .in("source", [DB_SOURCE_MANUAL, DB_SOURCE_AI_MOCK, DB_SOURCE_AI]);
    itemRows = fallback.data;
    itemErr = fallback.error;
  }

  if (itemErr) throw itemErr;
  const items = (itemRows ?? []) as VocabularyItemRow[];
  if (!items.length) return [];

  const manualIds = new Set(items.map((i) => i.id));

  const { data: senseRows, error: senseErr } = await supabase
    .from("vocabulary_senses")
    .select(
      "id,vocabulary_item_id,zh_meaning,simple_de_explanation,domain,example_sentence",
    )
    .in("vocabulary_item_id", items.map((i) => i.id));

  if (senseErr) throw senseErr;
  const sensesByItem = new Map<string, VocabularySenseRow[]>();
  for (const s of (senseRows ?? []) as VocabularySenseRow[]) {
    const list = sensesByItem.get(s.vocabulary_item_id) ?? [];
    list.push(s);
    sensesByItem.set(s.vocabulary_item_id, list);
  }

  const occByItem = new Map<string, VocabularyOccurrenceRow[]>();
  for (const o of occRows as VocabularyOccurrenceRow[]) {
    if (!manualIds.has(o.vocabulary_item_id)) continue;
    const list = occByItem.get(o.vocabulary_item_id) ?? [];
    list.push(o);
    occByItem.set(o.vocabulary_item_id, list);
  }

  const out: ArticleVocabItem[] = [];
  for (const row of items) {
    const occs = occByItem.get(row.id);
    if (!occs?.length) continue;

    const senseList = sensesByItem.get(row.id) ?? [];
    const senses: VocabSense[] = senseList.map((s) => ({
      id: `sense-ui-${s.id}`,
      dbSenseId: s.id,
      zh_meaning: s.zh_meaning ?? "待 AI 补充",
      simple_de_explanation: s.simple_de_explanation ?? "Wird später ergänzt.",
      domain: s.domain ?? undefined,
      example_sentence: s.example_sentence ?? undefined,
    }));

    const occurrences: VocabOccurrence[] = occs.map((o) => {
      const senseForOcc =
        (o.vocabulary_sense_id
          ? senses.find((se) => se.dbSenseId === o.vocabulary_sense_id)
          : undefined) ?? senses[0];
      return {
        id: o.id,
        surface_form: o.surface_form ?? "",
        sentence: o.sentence ?? "",
        start_offset: o.start_offset ?? undefined,
        end_offset: o.end_offset ?? undefined,
        fallbackMatchText: o.fallback_match_text ?? o.surface_form ?? "",
        source: mapOccSource(o.source),
        sense_id: senseForOcc?.id,
      };
    });

    const pos = row.part_of_speech ?? "";
    const display =
      row.display_word ?? row.lemma ?? occurrences[0]?.surface_form ?? "";

    out.push({
      id: `vocab-${row.id}`,
      dbItemId: row.id,
      persisted: true,
      lemma: row.lemma ?? display,
      display_word: display,
      normalized_key: row.normalized_key,
      part_of_speech: pos || "—",
      grammatical_gender: parseGrammaticalGender(row.gender),
      zh_meaning: row.zh_meaning ?? senses[0]?.zh_meaning ?? "待 AI 补充",
      simple_de_explanation:
        row.simple_de_explanation ??
        senses[0]?.simple_de_explanation ??
        "Wird später ergänzt.",
      mastery_status: clampMastery(row.mastery_status),
      source: mapDbVocabSourceToArticle(row.source),
      needs_ai_enrichment: row.needs_ai_enrichment ?? false,
      level_estimate: row.level_estimate ?? undefined,
      user_deep_note: row.user_deep_note,
      user_deep_note_updated_at: row.user_deep_note_updated_at,
      senses: senses.length
        ? senses
        : [
            {
              id: `placeholder-${row.id}`,
              dbSenseId: null,
              zh_meaning: "待 AI 补充",
              simple_de_explanation: "Wird später ergänzt.",
            },
          ],
      occurrences,
    });
  }

  return out;
}

async function ensureDefaultSense(
  supabase: SupabaseClient,
  userId: string,
  vocabularyItemId: string,
): Promise<string> {
  const { data: existing, error: selErr } = await supabase
    .from("vocabulary_senses")
    .select("id")
    .eq("vocabulary_item_id", vocabularyItemId)
    .limit(1);

  if (selErr) throw selErr;
  if (existing?.[0]?.id) return existing[0].id as string;

  const { data: inserted, error: insErr } = await supabase
    .from("vocabulary_senses")
    .insert({
      user_id: userId,
      vocabulary_item_id: vocabularyItemId,
      zh_meaning: "待 AI 补充",
      simple_de_explanation: "Wird später ergänzt.",
    })
    .select("id")
    .single();

  if (insErr) throw insErr;
  return inserted!.id as string;
}

/** 将阅读页一条手动词汇（含 occurrences）写入 Supabase，返回带服务端 id 的条目 */
export async function persistManualVocabularyItem(
  supabase: SupabaseClient,
  params: {
    userId: string;
    articleId: string;
    articlePlain: string;
    item: ArticleVocabItem;
  },
): Promise<{ item: ArticleVocabItem | null; error: string | null }> {
  const { userId, articleId, articlePlain, item } = params;
  const pos = vocabPartOfSpeechForDb(item.part_of_speech);
  /** 词典形须保留 AI 的 lemma（常含 der/die/das）；勿用 display_word（句中形式）覆盖 */
  const lemmaForStorage =
    (item.lemma ?? "").trim() || (item.display_word ?? "").trim();
  const dbSource =
    item.source === "ai_mock"
      ? DB_SOURCE_AI_MOCK
      : item.source === "ai"
        ? DB_SOURCE_AI
        : DB_SOURCE_MANUAL;
  const defaultNeedsAi =
    item.source === "ai_mock" || item.source === "ai"
      ? false
      : (item.needs_ai_enrichment ?? true);

  try {
    const { data: existingRow, error: findErr } = await supabase
      .from("vocabulary_items")
      .select(
        "id,mastery_status,lemma,display_word,normalized_key,part_of_speech",
      )
      .eq("user_id", userId)
      .eq("normalized_key", item.normalized_key)
      .eq("part_of_speech", pos)
      .maybeSingle();

    if (findErr) throw findErr;

    let vocabularyItemId: string;

    if (existingRow) {
      vocabularyItemId = existingRow.id as string;
      const lemmaToWrite = mergeLemmaForVocabularyPersist(
        existingRow.lemma as string | null,
        lemmaForStorage,
        item.display_word,
      );
      const { error: upErr } = await supabase
        .from("vocabulary_items")
        .update({
          last_seen_at: new Date().toISOString(),
          display_word: item.display_word,
          lemma: lemmaToWrite,
          zh_meaning: item.zh_meaning,
          simple_de_explanation: item.simple_de_explanation,
          needs_ai_enrichment: item.needs_ai_enrichment ?? false,
          level_estimate: item.level_estimate ?? null,
          gender: vocabularyGenderForDb(item),
          /** 与旧 Mock（ai_mock）同键合并时，真实 AI 保存须升级为 ai，避免右侧仍显示 Mock 源 */
          ...(item.source === "ai"
            ? { source: DB_SOURCE_AI, needs_ai_enrichment: false }
            : {}),
        })
        .eq("id", vocabularyItemId)
        .eq("user_id", userId);

      if (upErr) throw upErr;
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("vocabulary_items")
        .insert({
          user_id: userId,
          lemma: lemmaForStorage,
          display_word: item.display_word,
          normalized_key: item.normalized_key,
          part_of_speech: pos,
          zh_meaning: item.zh_meaning,
          simple_de_explanation: item.simple_de_explanation,
          mastery_status: item.mastery_status,
          source: dbSource,
          needs_ai_enrichment: defaultNeedsAi,
          level_estimate: item.level_estimate ?? null,
          gender: vocabularyGenderForDb(item),
          last_seen_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insErr) throw insErr;
      vocabularyItemId = inserted!.id as string;
    }

    const defaultSenseId = await ensureDefaultSense(
      supabase,
      userId,
      vocabularyItemId,
    );

    if ((item.source === "ai_mock" || item.source === "ai") && item.senses[0]) {
      const s0 = item.senses[0];
      const { error: senseUpErr } = await supabase
        .from("vocabulary_senses")
        .update({
          zh_meaning: s0.zh_meaning,
          simple_de_explanation: s0.simple_de_explanation,
          example_sentence: s0.example_sentence ?? null,
        })
        .eq("id", defaultSenseId);
      if (senseUpErr) throw senseUpErr;
    }

    /** 与 senses[0].id 一致，供文中 occurrence 链接到 sense；不得写入库 */
    const senseUiId = item.senses[0]?.id ?? `sense-ui-${defaultSenseId}`;

    const nextOccurrences: VocabOccurrence[] = [];

    for (const occ of item.occurrences) {
      const start = occ.start_offset;
      const end = occ.end_offset;
      const fallback = occ.fallbackMatchText || occ.surface_form;

      let existingId: string | null = null;

      if (start !== undefined && end !== undefined) {
        const { data: hit } = await supabase
          .from("vocabulary_occurrences")
          .select("id")
          .eq("article_id", articleId)
          .eq("vocabulary_item_id", vocabularyItemId)
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

      const stableOccId =
        start !== undefined && end !== undefined
          ? `${item.id}-${start}-${end}`
          : occ.id;

      if (existingId) {
        nextOccurrences.push({
          ...occ,
          id: stableOccId,
          sentence,
          sense_id: senseUiId,
        });
        continue;
      }

      const { error: occErr } = await supabase
        .from("vocabulary_occurrences")
        .insert({
          user_id: userId,
          vocabulary_item_id: vocabularyItemId,
          vocabulary_sense_id: defaultSenseId,
          article_id: articleId,
          surface_form: occ.surface_form,
          sentence,
          start_offset: start ?? null,
          end_offset: end ?? null,
          fallback_match_text: fallback,
          source: dbSource,
        });

      if (occErr) throw occErr;

      nextOccurrences.push({
        ...occ,
        id: stableOccId,
        sentence,
        sense_id: senseUiId,
      });
    }

    const updatedItem: ArticleVocabItem = {
      ...item,
      id: item.id,
      dbItemId: vocabularyItemId,
      persisted: true,
      part_of_speech: pos || item.part_of_speech,
      senses: [
        {
          id: senseUiId,
          dbSenseId: defaultSenseId,
          zh_meaning: item.senses[0]?.zh_meaning ?? "待 AI 补充",
          simple_de_explanation:
            item.senses[0]?.simple_de_explanation ?? "Wird später ergänzt.",
        },
      ],
      occurrences: nextOccurrences,
    };

    return { item: updatedItem, error: null };
  } catch (e: unknown) {
    return { item: null, error: formatSupabaseOrUnknownError(e) };
  }
}

/**
 * 从指定文章移除该词汇条目的全部 occurrence（仅 `article_id` + `vocabulary_item_id`）。
 * 不删除 `vocabulary_items` / `vocabulary_senses`；其它文章中的 occurrence 不受影响。
 * 与「忽略 ignored」不同：删除用于误添加/重复/错误保存，不是掌握状态。
 */
export async function deleteArticleVocabularyItemOccurrences(
  supabase: SupabaseClient,
  params: {
    userId: string;
    articleId: string;
    vocabularyItemId: string;
  },
): Promise<{ error: string | null }> {
  const { userId, articleId, vocabularyItemId } = params;
  try {
    const { error } = await supabase
      .from("vocabulary_occurrences")
      .delete()
      .eq("user_id", userId)
      .eq("article_id", articleId)
      .eq("vocabulary_item_id", vocabularyItemId);
    if (error) throw error;
    return { error: null };
  } catch (e: unknown) {
    return { error: formatSupabaseOrUnknownError(e) };
  }
}

export async function updateVocabularyItemMastery(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
  status: MasteryStatus,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("vocabulary_items")
    .update({ mastery_status: status })
    .eq("id", itemId)
    .eq("user_id", userId);

  return {
    error: error ? formatSupabaseOrUnknownError(error) : null,
  };
}

export async function updateVocabularyItemDeepNote(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
  note: string,
): Promise<{ note: string | null; updatedAt: string | null; error: string | null }> {
  const trimmed = note.trim();
  const updatedAt = trimmed ? new Date().toISOString() : null;
  const { error } = await supabase
    .from("vocabulary_items")
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

/** 单条词汇 AI 补全：写入 vocabulary_items + vocabulary_senses（首条 sense） */
export async function applyVocabularyAiEnrichment(
  supabase: SupabaseClient,
  params: {
    userId: string;
    vocabularyItemId: string;
    canonical_form: string;
    zh_meaning: string;
    simple_de_explanation: string;
    part_of_speech: string;
    level_estimate: string | null;
    example_sentence: string | null;
  },
): Promise<{ error: string | null }> {
  const {
    userId,
    vocabularyItemId,
    canonical_form,
    zh_meaning,
    simple_de_explanation,
    part_of_speech,
    level_estimate,
    example_sentence,
  } = params;
  const pos = vocabPartOfSpeechForDb(part_of_speech);

  try {
    const { data: senseRow, error: senseSelErr } = await supabase
      .from("vocabulary_senses")
      .select("id")
      .eq("vocabulary_item_id", vocabularyItemId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (senseSelErr) throw senseSelErr;
    const senseId = senseRow?.id as string | undefined;
    if (!senseId) {
      return { error: "未找到该词条的义项记录，无法写入解释。" };
    }

    const { error: senseUpErr } = await supabase
      .from("vocabulary_senses")
      .update({
        zh_meaning,
        simple_de_explanation,
        example_sentence: example_sentence ?? null,
      })
      .eq("id", senseId)
      .eq("user_id", userId);

    if (senseUpErr) throw senseUpErr;

    const { error: itemUpErr } = await supabase
      .from("vocabulary_items")
      .update({
        lemma: canonical_form,
        zh_meaning,
        simple_de_explanation,
        part_of_speech: pos,
        level_estimate: level_estimate ?? null,
        needs_ai_enrichment: false,
      })
      .eq("id", vocabularyItemId)
      .eq("user_id", userId);

    if (itemUpErr) throw itemUpErr;

    return { error: null };
  } catch (e: unknown) {
    return { error: formatSupabaseOrUnknownError(e) };
  }
}
