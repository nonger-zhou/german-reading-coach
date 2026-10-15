import type {
  ArticleChunk,
  GrammarEntry,
  MockArticleMeta,
  VocabEntry,
} from "@/lib/types";

export const mockArticleMeta: MockArticleMeta = {
  title: "Nachrichten aus Berlin (Demo)",
  summaryZh:
    "这是一篇演示用的德语短文：政府宣布新的环保措施，市民反应积极。文中包含若干高亮词汇与语法点，便于在阅读器中练习。",
  questions: [
    "文中提到的措施主要涉及哪个领域？",
    "作者如何描述市民的态度？",
    "请用自己的话概括第二段大意。",
  ],
};

export const mockArticleChunks: ArticleChunk[] = [
  { kind: "text", text: "Die Regierung hat " },
  {
    kind: "vocab",
    id: "v-maßnahmen",
    surface: "Maßnahmen",
  },
  { kind: "text", text: " angekündigt, " },
  {
    kind: "grammar",
    id: "g-damit",
    surface: "damit",
  },
  { kind: "text", text: " die Luftqualität verbessert wird. " },
  {
    kind: "vocab",
    id: "v-bürger",
    surface: "Bürger",
  },
  { kind: "text", text: " zeigen sich " },
  {
    kind: "vocab",
    id: "v-optimistisch",
    surface: "optimistisch",
  },
  {
    kind: "text",
    text: ", doch einige Experten warnen vor zu hohen Erwartungen.",
  },
];

export const initialVocabulary: VocabEntry[] = [
  {
    id: "v-maßnahmen",
    lemma: "Maßnahme",
    display_word: "Maßnahmen",
    part_of_speech: "名词 (复数)",
    grammatical_gender: "f",
    zh_meaning: "措施；办法",
    simple_de_explanation:
      "Plural von „Maßnahme“: konkrete Schritte, die man plant oder ergreift.",
    encounter_count: 3,
    mastery_status: "learning",
  },
  {
    id: "v-bürger",
    lemma: "Bürger",
    display_word: "Bürger",
    part_of_speech: "名词 (复数)",
    grammatical_gender: "m",
    zh_meaning: "市民；公民",
    simple_de_explanation:
      "Menschen, die in einer Stadt leben oder Staatsbürger sind.",
    encounter_count: 5,
    mastery_status: "new",
  },
  {
    id: "v-optimistisch",
    lemma: "optimistisch",
    display_word: "optimistisch",
    part_of_speech: "形容词",
    zh_meaning: "乐观的",
    simple_de_explanation:
      "Positiv eingestellt; man erwartet ein gutes Ergebnis.",
    encounter_count: 2,
    mastery_status: "familiar",
  },
  {
    id: "v-verbessern",
    lemma: "verbessern",
    display_word: "verbessern",
    part_of_speech: "动词",
    zh_meaning: "改善；提高",
    simple_de_explanation:
      "Etwas besser machen als zuvor (Qualität, Leistung).",
    encounter_count: 4,
    mastery_status: "mastered",
  },
  {
    id: "v-ankündigen",
    lemma: "ankündigen",
    display_word: "ankündigen",
    part_of_speech: "动词",
    zh_meaning: "宣布；预告",
    simple_de_explanation: "Öffentlich sagen, was in Zukunft passieren soll.",
    encounter_count: 1,
    mastery_status: "ignored",
  },
];

/** 演示课文不再预置系统语法高亮；语法请用拖选 +「标记语法」体验。 */
export const initialGrammar: GrammarEntry[] = [];
