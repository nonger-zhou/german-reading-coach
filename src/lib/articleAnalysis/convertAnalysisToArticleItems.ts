import type {
  ArticleGrammarItem,
  ArticleVocabItem,
  GrammarOccurrence,
  VocabOccurrence,
  VocabSense,
} from "@/lib/articleReadingTypes";
import {
  extractSentence,
  findBestTextOccurrence,
  newEntityId,
  normalizeTextKey,
} from "@/lib/articleReadingModel";
import type { ArticleAnalysisResult } from "./types";

function buildVocabOccurrence(
  articlePlain: string,
  surface: string,
  hints: ArticleAnalysisResult["vocabulary"][0]["occurrences"],
): VocabOccurrence | null {
  let start: number | undefined;
  let end: number | undefined;
  if (hints?.[0]) {
    start = hints[0].start_offset;
    end = hints[0].end_offset;
    if (
      start >= 0 &&
      end <= articlePlain.length &&
      end > start &&
      articlePlain.slice(start, end) !== surface
    ) {
      const slice = articlePlain.slice(start, end);
      if (slice.toLowerCase() !== surface.toLowerCase()) {
        start = undefined;
        end = undefined;
      }
    }
  }
  if (start === undefined || end === undefined) {
    const hit = findBestTextOccurrence(articlePlain, surface, 0);
    if (!hit) return null;
    start = hit.start;
    end = hit.end;
  }
  const surf = articlePlain.slice(start, end);
  const sentence = extractSentence(articlePlain, start, end);
  return {
    id: `${newEntityId("voc-occ")}`,
    surface_form: surf,
    sentence,
    start_offset: start,
    end_offset: end,
    fallbackMatchText: surf,
    source: "ai_detected",
  };
}

function buildGrammarOccurrence(
  articlePlain: string,
  selected: string,
  hints: ArticleAnalysisResult["grammar"][0]["occurrences"],
): GrammarOccurrence | null {
  let start: number | undefined;
  let end: number | undefined;
  if (hints?.[0]) {
    start = hints[0].start_offset;
    end = hints[0].end_offset;
  }
  if (start === undefined || end === undefined) {
    const hit = findBestTextOccurrence(articlePlain, selected, 0);
    if (!hit) return null;
    start = hit.start;
    end = hit.end;
  }
  const surf = articlePlain.slice(start, end);
  const sentence = extractSentence(articlePlain, start, end);
  return {
    id: newEntityId("g-occ"),
    surface_form: surf,
    sentence,
    start_offset: start,
    end_offset: end,
    fallbackMatchText: surf,
    source: "ai_detected",
  };
}

/** 将分析结果转为阅读页词条；仅能在 `articlePlain` 中定位的项会加入。`itemSource`：`ai_mock`（Mock）或 `ai`（真实 OpenAI 保存）。 */
export function convertAnalysisResultToArticleItems(
  result: ArticleAnalysisResult,
  articlePlain: string,
  options?: { itemSource?: "ai_mock" | "ai" },
): { vocabulary: ArticleVocabItem[]; grammar: ArticleGrammarItem[] } {
  const itemSource = options?.itemSource ?? "ai_mock";
  const vocabulary: ArticleVocabItem[] = [];
  for (const av of result.vocabulary) {
    const occ = buildVocabOccurrence(
      articlePlain,
      av.surface_form,
      av.occurrences,
    );
    if (!occ) continue;

    const nk = normalizeTextKey(av.normalized_key || av.surface_form);
    const sense: VocabSense = {
      id: newEntityId("sense"),
      zh_meaning: av.zh_meaning,
      simple_de_explanation: av.simple_de_explanation,
      example_sentence: av.example_sentence,
    };
    occ.sense_id = sense.id;

    vocabulary.push({
      id: newEntityId("v-item"),
      dbItemId: null,
      lemma: av.lemma,
      display_word: av.surface_form,
      normalized_key: nk,
      part_of_speech: av.part_of_speech || "—",
      grammatical_gender: av.grammatical_gender ?? "na",
      zh_meaning: av.zh_meaning,
      simple_de_explanation: av.simple_de_explanation,
      mastery_status: "new",
      source: itemSource,
      needs_ai_enrichment: false,
      persisted: false,
      level_estimate: av.level_estimate,
      reason_for_selection: av.reason_for_selection,
      senses: [sense],
      occurrences: [occ],
    });
  }

  const grammar: ArticleGrammarItem[] = [];
  for (const ag of result.grammar) {
    const occ = buildGrammarOccurrence(
      articlePlain,
      ag.selected_text,
      ag.occurrences,
    );
    if (!occ) continue;

    const nk = normalizeTextKey(ag.normalized_key || ag.grammar_key);
    grammar.push({
      id: newEntityId("g-item"),
      dbItemId: null,
      grammar_key: ag.grammar_key,
      normalized_key: nk,
      name_de: ag.name_de,
      name_zh: ag.name_zh,
      explanation_zh: ag.explanation_zh,
      explanation_de_simple: ag.explanation_de_simple,
      mastery_status: "new",
      source: itemSource,
      persisted: false,
      level_estimate: ag.level_estimate,
      reason_for_selection: ag.reason_for_selection,
      occurrences: [occ],
    });
  }

  return { vocabulary, grammar };
}

/** 预览保存前：在 `articlePlain` 中无法子串匹配的词汇/语法（不写入 occurrence）。 */
export function listRealAiEntriesWithoutTextMatch(
  result: ArticleAnalysisResult,
  articlePlain: string,
): { vocabulary: string[]; grammar: string[] } {
  const vocabulary: string[] = [];
  for (const av of result.vocabulary) {
    if (!findBestTextOccurrence(articlePlain, av.surface_form, 0)) {
      vocabulary.push(av.surface_form);
    }
  }
  const grammar: string[] = [];
  for (const ag of result.grammar) {
    if (!findBestTextOccurrence(articlePlain, ag.selected_text, 0)) {
      grammar.push(ag.selected_text);
    }
  }
  return { vocabulary, grammar };
}
