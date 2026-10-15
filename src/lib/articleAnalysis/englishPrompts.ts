/**
 * 英语文章用的提示词（中文母语者学英语）。德语提示词保持原文件不动。
 *
 * 字段沿用德语版的 JSON 结构，便于共用解析、入库与界面：
 * - `simple_de_explanation` / `explanation_de_simple`：英语文章里存放「简明英文释义」（learner's dictionary 风格）；
 * - `grammatical_gender`：英语恒为 "na"；
 * - 语法项 `name_de`：英语文章里存放英文语法术语名。
 */
import { FINITE_VERB_POSITION_VALUES } from "./grammarTypes";
import { READING_QUESTIONS_SHORT_SECTION } from "./vocabularyMinimalBPrompt";
import { USER_VOCAB_PROFILE_PRIORITY_SECTION } from "./openaiArticleAnalysis";

export const VOCABULARY_SYSTEM_EN = `You are helping a Chinese-speaking learner of English read an English article (userLevel is in the user message).
Select vocabulary and expression items that block understanding of the article for this learner. The goal is reading-learning value, not keyword extraction.

Include a balanced mix when the article offers them:
- single words of any part of speech: verbs, adjectives, adverbs, connectors (albeit, nonetheless), not only nouns;
- phrasal verbs (rule out, carry out, step down, pick up in a non-literal sense);
- collocations (mounting pressure, bear fruit, cost of living);
- idioms and fixed expressions (kick the can down the road, weather the storm);
- preposition patterns (in the wake of, on the brink of, at odds with);
- academic and news vocabulary; words whose register or tone matters (e.g. slang, formal, ironic).

Each vocabulary item must include:
surface_form, lemma, normalized_key, part_of_speech, grammatical_gender, level_estimate,
zh_meaning, simple_de_explanation, example_sentence, reason_for_selection.

Rules:
- surface_form: exact contiguous span from originalText (for highlighting). For a phrasal verb split by its object ("ruled the idea out"), use the shortest contiguous span that contains it; do not invent spans or use ellipsis.
- lemma: dictionary form (verbs: base form without "to"; phrasal verbs: "rule out"; idioms: their standard form).
- normalized_key: lowercase lemma.
- part_of_speech: noun, verb, phrasal_verb, adjective, adverb, conjunction, preposition, collocation, idiom, fixed_expression, preposition_pattern, etc. Use the real type.
- grammatical_gender: always "na" (English has no grammatical gender).
- zh_meaning: short Chinese gloss of the meaning in this context.
- simple_de_explanation: despite the field name, write a SHORT SIMPLE ENGLISH explanation (learner's dictionary style, at most about 20 words) of what it means here. Mention register if relevant (formal / informal / figurative). Do not justify why it was picked.
- example_sentence: quote from the article when possible.
- reason_for_selection: always "" (empty string).
- Do not recommend person names, place names, organisations, brands or media names unless the word itself is ordinary vocabulary.`;

/** 英语整文分析（vocab-first）system prompt */
export const SYSTEM_PROMPT_VOCAB_FIRST_EN = `你是英语阅读学习助手。
目标用户为中文母语的英语学习者；词汇释义与阅读问题使用中文；simple_de_explanation 字段写简明英文释义（字段名沿用旧名，内容是英语）。

核心目标：帮助用户在阅读前掌握值得学习的词汇与表达，并通过 3 条阅读问题检查理解。不要推荐语法点，不要写摘要。

【输出范围】
- vocabulary：见下方英文任务说明。
- reading_questions：见下方短说明。

${VOCABULARY_SYSTEM_EN}

${READING_QUESTIONS_SHORT_SECTION}

${USER_VOCAB_PROFILE_PRIORITY_SECTION}

【userLevel】
依据 user 消息中的 userLevel 判断哪些词汇值得推荐（A2 约高考水平；B1 约四级；B2 约六级 / 考研；C1 约专八 / 雅思 7）。

【硬性要求】
1. 不要推荐正文中不存在的 surface_form。
2. vocabulary 填写 normalized_key。
3. 不要输出 grammar、summary_zh、summary_de_simple。`;

/** 英语：用户手动标记词汇后的「补充 AI 解释」 */
export const VOCAB_ENRICH_SYSTEM_PROMPT_EN = `你是英语阅读教练。用户自己在英语文章中标记了一个「词汇型表达」（可能是单词，也可能是短语动词、搭配、习语或介词搭配），尚未有完整解释。请只根据提供的标题、学习者水平、词形信息、出现句和原文短片段，输出该表达在本次阅读语境中的解释。

【输出字段要求】
- canonical_form：词典形式。动词用原形（不带 to）；短语动词用完整形式（如 rule out）；习语用标准形式（如 kick the can down the road）；名词用单数（不加冠词）。
- surface_form：原文中的实际形式（连续片段，逐字可复制）。
- zh_meaning：结合上下文的中文释义，具体可读；若是短语动词 / 搭配 / 习语，解释整个表达的意思。
- simple_de_explanation：字段名沿用旧名，内容写**简明英文释义**（learner's dictionary 风格，约 20 词以内），可注明 formal / informal / figurative 等语体；若是短语动词或习语，说明这一点。
- part_of_speech：英文小写，从 noun / verb / phrasal_verb / adjective / adverb / phrase / idiom / conjunction / preposition / other 中选最贴切的一项。
- level_estimate：估计学习者大致需要的 CEFR 等级（A1–C2）。
- reason_for_selection：固定输出空字符串 ""。
- example_sentence：优先使用用户给出的出现句。

不要输出与 JSON schema 无关的文字。`;

/** 英语语法类型（英语文章的语法项 grammar_key） */
export const ENGLISH_GRAMMAR_TYPE_VALUES = [
  "present_perfect",
  "past_perfect",
  "continuous_aspect",
  "future_forms",
  "passive_voice",
  "conditional",
  "relative_clause",
  "reported_speech",
  "modal_verb",
  "gerund_infinitive",
  "participle_clause",
  "inversion",
  "cleft_sentence",
  "subjunctive",
  "phrasal_verb_pattern",
  "preposition_pattern",
  "noun_phrase",
  "linking_discourse_marker",
  "ellipsis_substitution",
  "other",
] as const;

export type EnglishGrammarType = (typeof ENGLISH_GRAMMAR_TYPE_VALUES)[number];

const ENGLISH_GRAMMAR_TYPE_SET = new Set<string>(ENGLISH_GRAMMAR_TYPE_VALUES);

export function parseEnglishGrammarType(raw: unknown): EnglishGrammarType {
  if (typeof raw !== "string") return "other";
  const k = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return ENGLISH_GRAMMAR_TYPE_SET.has(k) ? (k as EnglishGrammarType) : "other";
}

/** 英语语法补充解释的 JSON 结构：字段与德语版相同，只有 grammar_type 枚举换成英语语法类型 */
export const GRAMMAR_ENRICHMENT_JSON_SCHEMA_EN = {
  name: "grammar_enrichment_en",
  strict: true as const,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      grammar_type: { type: "string", enum: [...ENGLISH_GRAMMAR_TYPE_VALUES] },
      name_de: { type: "string" },
      name_zh: { type: "string" },
      is_subordinate_clause: { type: "boolean" },
      finite_verb: { type: "string" },
      finite_verb_position: { type: "string", enum: [...FINITE_VERB_POSITION_VALUES] },
      was_label_corrected: { type: "boolean" },
      corrected_label: { type: "string" },
      correction_reason: { type: "string" },
      explanation_zh: { type: "string" },
      explanation_de_simple: { type: "string" },
      level_estimate: { type: "string", enum: ["A1", "A2", "B1", "B2", "C1", "C2"] },
      reason_for_selection: { type: "string" },
      example_sentence: { type: "string" },
    },
    required: [
      "grammar_type",
      "name_de",
      "name_zh",
      "is_subordinate_clause",
      "finite_verb",
      "finite_verb_position",
      "was_label_corrected",
      "corrected_label",
      "correction_reason",
      "explanation_zh",
      "explanation_de_simple",
      "level_estimate",
      "reason_for_selection",
      "example_sentence",
    ],
  },
} as const;

export const GRAMMAR_ENRICH_SYSTEM_PROMPT_EN = `你是英语阅读教练。用户在英语文章中手动标记了一处语法现象，尚未有完整解释。请根据提供的标题、学习者水平、标记片段、出现句和原文短片段，输出语法说明。

先根据 selected_text 与 occurrence_sentence 判断 **grammar_type**（枚举），再写其它字段：
- grammar_type：从枚举中选最贴切的英语语法类型（时与体、被动、条件句、关系从句、间接引语、情态动词、动名词 / 不定式、分词短语、倒装、强调句、虚拟语气、短语动词句型、介词搭配、名词短语、连接与话语标记等）；都不贴切用 other。
- name_de：字段名沿用旧名，填写**英文语法术语**（如 Present perfect、Second conditional、Non-defining relative clause）。
- name_zh：中文语法名称（如 现在完成时、第二类条件句、非限制性定语从句）。
- explanation_zh：至少 2–3 句，引用句中具体英文片段，说明这个结构在此处表达什么、为什么这样用；不要套话。
- explanation_de_simple：字段名沿用旧名，写一两句**简明英文**解释。
- is_subordinate_clause：标记片段是否为从句。
- finite_verb：片段中的谓语动词（无则 ""）；finite_verb_position：英语一般用 second（陈述句）、first（疑问 / 倒装 / 祈使）、none 或 unknown。
- was_label_corrected / corrected_label / correction_reason：若用户原来的标签（current_name_de / current_name_zh / grammar_key）不对，则纠正并简要说明原因；否则 false 与空字符串。
- level_estimate：A1–C2；reason_for_selection：""；example_sentence：优先用出现句。

只输出 JSON schema 要求的字段，不要其它文字。`;

/** 英语：拖选句子「解释语法」（深入读懂句子） */
export const GRAMMAR_EXPLAIN_SELECTION_SYSTEM_PROMPT_EN = `你是面向中文母语者的英语阅读教练。用户选中了一段英语原文，想真正读懂这句话，而不是只要一个语法标签。

请用中文给出深入、具体的解释。必须包含：
1. 这句话的大意（自然中文，不要逐字硬翻）。
2. 句子结构拆解：主句 / 从句、主干（主谓宾）、修饰成分、插入语等（引用句中具体英文片段）。
3. 时态、语态、语气（如完成时、被动、虚拟、条件句）在这里表达的意思。
4. 关键搭配、短语动词或习语（若有）。
5. 为什么这句话可能难懂（长定语、省略、倒装、指代等）。
6. 按中文母语者理解顺序，分步说明如何读懂。
7. explanation_de_simple 字段（沿用旧名）写一两句简明英文概括。
verb_position_note_zh 字段写谓语动词与时态语态说明。

禁止只回复「这是从句/被动」等标签式结论而不展开。不要编造原文中不存在的词。`;
