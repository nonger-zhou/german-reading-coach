import { findBestTextOccurrence } from "@/lib/articleReadingModel";
import type { AnalyzedVocabularyItem } from "./types";

/** 动词短语 / 可分动词 / 搭配 / 固定表达等（验收用） */
export const VOCAB_EXPRESSION_PARTS_OF_SPEECH = new Set([
  "separable_verb",
  "verb_phrase",
  "collocation",
  "fixed_expression",
  "prepositional_phrase",
]);

export type VocabPosBucket =
  | "noun"
  | "verb"
  | "adjective"
  | "adverb"
  | "phrase"
  | "other";

export function bucketVocabPartOfSpeech(pos: string): VocabPosBucket {
  const k = pos.trim().toLowerCase();
  if (k === "noun" || k === "compound_noun" || k.includes("substantiv"))
    return "noun";
  if (
    k === "verb" ||
    k === "separable_verb" ||
    k === "verb_phrase" ||
    k.startsWith("verb")
  )
    return "verb";
  if (k === "adjective" || k === "adj" || k.includes("adjektiv"))
    return "adjective";
  if (k === "adverb" || k.includes("adverb")) return "adverb";
  if (
    k === "phrase" ||
    k === "collocation" ||
    k === "fixed_expression" ||
    k === "prepositional_phrase" ||
    k.includes("phrase")
  )
    return "phrase";
  return "other";
}

export function countVocabByBucket(
  items: ReadonlyArray<Pick<AnalyzedVocabularyItem, "part_of_speech">>,
): Record<VocabPosBucket, number> & { total: number } {
  const counts: Record<VocabPosBucket, number> = {
    noun: 0,
    verb: 0,
    adjective: 0,
    adverb: 0,
    phrase: 0,
    other: 0,
  };
  for (const item of items) {
    counts[bucketVocabPartOfSpeech(item.part_of_speech)] += 1;
  }
  return { total: items.length, ...counts };
}

export function formatVocabPosCounts(
  counts: ReturnType<typeof countVocabByBucket>,
): string {
  return [
    `total=${counts.total}`,
    `noun=${counts.noun}`,
    `verb=${counts.verb}`,
    `adjective=${counts.adjective}`,
    `adverb=${counts.adverb}`,
    `phrase=${counts.phrase}`,
    `other=${counts.other}`,
  ].join(", ");
}

/** 至少 2 条且全部为名词类（compound_noun 计入 noun） */
export function isVocabularyAllNounLike(
  vocabulary: ReadonlyArray<Pick<AnalyzedVocabularyItem, "part_of_speech">>,
): boolean {
  if (vocabulary.length < 2) return false;
  return vocabulary.every(
    (v) => bucketVocabPartOfSpeech(v.part_of_speech) === "noun",
  );
}

export function countNonNounVocabulary(
  vocabulary: ReadonlyArray<Pick<AnalyzedVocabularyItem, "part_of_speech">>,
): number {
  return vocabulary.filter(
    (v) => bucketVocabPartOfSpeech(v.part_of_speech) !== "noun",
  ).length;
}

/** 至少一条名词类（noun / compound_noun） */
export function hasNounLikeVocabulary(
  vocabulary: ReadonlyArray<Pick<AnalyzedVocabularyItem, "part_of_speech">>,
): boolean {
  return vocabulary.some(
    (v) => bucketVocabPartOfSpeech(v.part_of_speech) === "noun",
  );
}

/** 至少一条非名词类（动词、形容词、副词、短语等） */
export function hasNonNounLikeVocabulary(
  vocabulary: ReadonlyArray<Pick<AnalyzedVocabularyItem, "part_of_speech">>,
): boolean {
  return vocabulary.some(
    (v) => bucketVocabPartOfSpeech(v.part_of_speech) !== "noun",
  );
}

export function hasExpressionTypeVocabulary(
  vocabulary: ReadonlyArray<Pick<AnalyzedVocabularyItem, "part_of_speech">>,
): boolean {
  return countExpressionTypeVocabulary(vocabulary) >= 1;
}

/** verb_phrase / separable_verb / collocation / fixed_expression / prepositional_phrase 条数 */
export function countExpressionTypeVocabulary(
  vocabulary: ReadonlyArray<Pick<AnalyzedVocabularyItem, "part_of_speech">>,
): number {
  return vocabulary.filter((v) =>
    VOCAB_EXPRESSION_PARTS_OF_SPEECH.has(
      v.part_of_speech.trim().toLowerCase(),
    ),
  ).length;
}

/** 非名词项的 surface_form 是否都能在正文中子串定位 */
export function nonNounSurfaceFormsMissingFromArticle(
  vocabulary: ReadonlyArray<
    Pick<AnalyzedVocabularyItem, "part_of_speech" | "surface_form">
  >,
  articlePlain: string,
): string[] {
  const missing: string[] = [];
  for (const v of vocabulary) {
    if (bucketVocabPartOfSpeech(v.part_of_speech) === "noun") continue;
    const surf = v.surface_form.trim();
    if (!surf) {
      missing.push("(empty surface_form)");
      continue;
    }
    if (surf.includes("…") || surf.includes("...")) {
      missing.push(surf);
      continue;
    }
    if (!findBestTextOccurrence(articlePlain, surf, 0)) {
      missing.push(surf);
    }
  }
  return missing;
}
