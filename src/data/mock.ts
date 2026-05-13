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

export const initialGrammar: GrammarEntry[] = [
  {
    id: "g-damit",
    grammar_key: "damit + Konjunktiv",
    name_de: "Nebensatz mit „damit“ (Final)",
    name_zh: "damit 引导的目的从句",
    explanation_zh:
      "„damit“ 引出目的从句，表示“为了……以便……”。从句中常用虚拟式或直陈式（新闻体中直陈式也常见）。",
    encounter_count: 2,
    mastery_status: "learning",
  },
  {
    id: "g-passiv",
    grammar_key: "Passiv Präsens",
    name_de: "Präsens-Passiv",
    name_zh: "现在时被动语态",
    explanation_zh:
      "结构常为： werden + Partizip II。表示动作承受者作主语，如 „wird angekündigt“。",
    encounter_count: 6,
    mastery_status: "new",
  },
  {
    id: "g-adjektiv",
    grammar_key: "Adjektivendung",
    name_de: "Adjektivdeklination",
    name_zh: "形容词词尾",
    explanation_zh:
      "形容词在名词前需随格、性、数变化，如 „optimistisch“ 在特定结构中可能带词尾。",
    encounter_count: 8,
    mastery_status: "familiar",
  },
];
