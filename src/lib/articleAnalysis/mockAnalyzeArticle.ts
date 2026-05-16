import type { CefrLevel } from "@/lib/types";
import {
  findBestTextOccurrence,
  normalizeTextKey,
} from "@/lib/articleReadingModel";
import type {
  AnalyzedGrammarItem,
  AnalyzedVocabularyItem,
  ArticleAnalysisResult,
} from "./types";

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

function grammarHit(
  plain: string,
  cand: Omit<AnalyzedGrammarItem, "occurrences">,
): AnalyzedGrammarItem | null {
  const needle = cand.selected_text.trim();
  const occ = findBestTextOccurrence(plain, needle, 0);
  if (!occ) return null;
  return {
    ...cand,
    selected_text: plain.slice(occ.start, occ.end),
    occurrences: [{ start_offset: occ.start, end_offset: occ.end }],
  };
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

  const grammarCandidates: Omit<AnalyzedGrammarItem, "occurrences">[] = [
    {
      grammar_type: "other",
      grammar_key: "other",
      normalized_key: normalizeTextKey("mock_konjunktiv_redetext"),
      is_subordinate_clause: false,
      finite_verb: "",
      finite_verb_position: "unknown",
      selected_text: "sich mit Haut und Haar",
      name_de: "Reflexiv + Präpositionalphrase (Mock)",
      name_zh: "反身动词与介词短语（示例）",
      level_estimate: level,
      explanation_zh:
        "（Mock）反身结构 «sich … einsetzen» 常与介词短语共现，真实分析将结合全文讲解。",
      explanation_de_simple:
        "Reflexivpronomen „sich“ und feste Wendungen kommen oft zusammen.",
      example_sentence: "sich für etwas einsetzen",
      reason_for_selection: "Mock：若文中出现典型片段则展示；否则跳过。",
    },
    {
      grammar_type: "other",
      grammar_key: "other",
      normalized_key: normalizeTextKey("mock_partizip_gruppe"),
      is_subordinate_clause: false,
      finite_verb: "",
      finite_verb_position: "unknown",
      selected_text: "blitzgescheit",
      name_de: "Adjektivkompositum (Mock)",
      name_zh: "复合形容词（示例）",
      level_estimate: level,
      explanation_zh: "（Mock）新闻体常见复合形容词，真实 AI 将按等级释义。",
      explanation_de_simple:
        "Zusammensetzungen wie „blitz- + gescheit“ verstärken die Bedeutung.",
      example_sentence: "blitzgescheit, hochempathisch",
      reason_for_selection: "Mock：依赖正文是否包含该表面形式。",
    },
    {
      grammar_type: "nebensatz",
      grammar_key: "nebensatz",
      normalized_key: normalizeTextKey("mock_nebensatz"),
      is_subordinate_clause: true,
      finite_verb: "",
      finite_verb_position: "unknown",
      selected_text: "dass",
      name_de: "Nebensatz mit „dass“ (Mock)",
      name_zh: "dass 从句（示例）",
      level_estimate: level,
      explanation_zh: "（Mock）若文中有 „dass“ 引导从句则标出。",
      explanation_de_simple: "„Dass“ leitet oft einen Inhaltssatz ein.",
      example_sentence: "… dass …",
      reason_for_selection: "Mock：仅当可定位时加入列表。",
    },
  ];

  const grammar: AnalyzedGrammarItem[] = [];
  for (const g of grammarCandidates) {
    const hit = grammarHit(plain, g);
    if (hit) grammar.push(hit);
    if (grammar.length >= 3) break;
  }

  const summary_zh = `（Mock 摘要）本文「${title || "（无标题）"}」围绕主题展开；Phase 3.0 仅占位，未调用 OpenAI。当前假定读者水平：${userLevel}。`;
  const summary_de_simple = `(Mock-Zusammenfassung) Artikel „${title || "ohne Titel"}“ — Platzhalter für Phase 3.0; echte KI folgt. Niveau: ${userLevel}.`;

  const reading_questions = [
    "（Mock）作者主要想说明哪一点？真实分析将结合全文生成具体问题。",
    "（Mock）文中哪些词对理解段落最关键？",
    "（Mock）能否用一两句德语复述本文主旨？",
  ];

  return {
    vocabulary,
    grammar,
    summary_zh,
    summary_de_simple,
    reading_questions,
  };
}
