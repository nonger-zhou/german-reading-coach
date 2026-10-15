import type { CefrLevel } from "@/lib/types";
import {
  findBestTextOccurrence,
  normalizeTextKey,
} from "@/lib/articleReadingModel";
import type { AnalyzedVocabularyItem, ArticleAnalysisResult } from "./types";

const STOP = new Set([
  "nicht",
  "auch",
  "sich",
  "einen",
  "einer",
  "einem",
  "eines",
  "wurde",
  "werden",
  "worden",
  "haben",
  "nach",
  "über",
  "unter",
  "dass",
  "wenn",
  "noch",
  "nur",
  "vom",
  "von",
  "zum",
  "zur",
  "dem",
  "den",
  "der",
  "des",
  "die",
  "das",
  "und",
  "oder",
  "aber",
]);

function pickWords(text: string, max: number): string[] {
  const raw = text.match(/\b[A-Za-zÄÖÜäöüß]{6,}\b/g) ?? [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const w of raw) {
    const low = w.toLowerCase();
    if (STOP.has(low)) continue;
    if (seen.has(low)) continue;
    seen.add(low);
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

function withOccFromPlain(
  plain: string,
  surface: string,
): AnalyzedVocabularyItem["occurrences"] {
  const occ = findBestTextOccurrence(plain, surface, 0);
  if (!occ) return undefined;
  return [{ start_offset: occ.start, end_offset: occ.end }];
}

/**
 * Phase 3.0 mock：不调用 OpenAI，基于正文简单抽取可匹配高亮的词与语法片段。
 * 未在文中出现的片段不会出现在结果中，避免「空高亮」。
 */
export function mockAnalyzeArticle(params: {
  title: string;
  originalText: string;
  userLevel: CefrLevel;
}): ArticleAnalysisResult {
  const { title, originalText, userLevel } = params;
  const plain = `${title}\n\n${originalText}`.trim();
  const level: CefrLevel = userLevel;

  const picked = pickWords(plain, 5);
  const vocabulary: AnalyzedVocabularyItem[] = [];
  let i = 0;
  for (const surface of picked) {
    const occ = withOccFromPlain(plain, surface);
    if (!occ) continue;
    i += 1;
    vocabulary.push({
      surface_form: surface,
      lemma: surface,
      normalized_key: surface.toLowerCase(),
      part_of_speech: i % 2 === 0 ? "noun" : "verb",
      grammatical_gender: i % 2 === 0 ? (i % 4 === 0 ? "m" : "n") : "na",
      level_estimate: level,
      zh_meaning: `（Mock）与主题相关的学习词 ${i}：${surface}`,
      simple_de_explanation: `Im Text: „${surface}“. Das ist ein Beispiel für Phase-3.0-Mock.`,
      example_sentence: `… ${surface} …`,
      reason_for_selection:
        "Mock：按词长在正文中自动抽取；真实分析将按等级与可读性筛选。",
      occurrences: occ,
    });
    if (vocabulary.length >= 4) break;
  }

  const reading_questions = [
    "（Mock）作者主要想说明哪一点？真实分析将结合全文生成具体问题。",
    "（Mock）文中哪些词对理解段落最关键？",
    "（Mock）能否用一两句德语复述本文主旨？",
  ];

  return {
    vocabulary,
    grammar: [],
    summary_zh: "",
    summary_de_simple: "",
    reading_questions,
  };
}
