import type { AnalyzedVocabularyItem, ArticleAnalysisResult } from "./types";
import type { CefrLevel } from "@/lib/types";
import { parseGrammaticalGender } from "@/lib/vocabulary/grammaticalGender";
import { normalizeTextKey } from "@/lib/articleReadingModel";

/**
 * 单次整文分析送入模型的正文上限（字符数）。
 * 原因：控制单次 OpenAI 调用的 token/费用/延迟，并降低超长文 JSON 输出失败率；超长文目前只分析前半段（响应 warning）。
 * 后续可改为分块分析或分段合并推荐。
 */
export const OPENAI_ANALYSIS_TEXT_CHAR_LIMIT = 10_000;

const SYSTEM_PROMPT = `你是德语阅读学习助手。
目标用户默认为中文母语者，正在学习德语；解释语言默认为中文；simple_de_explanation / explanation_de_simple 使用简单德语。

核心目标：用户在阅读文章前，先查看你标出的关键词汇和语法点；看完这些解释后，应能大致读懂文章主旨和关键细节，阅读过程中不需要频繁查词。

【推荐数量】
- vocabulary（广义词汇 / 表达，lexical item）：**不设固定条数上限**；应覆盖文中影响读懂主旨与关键细节、且符合 **userLevel** 的值得学项（单词、复合名词、搭配、可分动词、固定表达等）。
- grammar **最多 8 条**；reading_questions **恰好 3 条**中文问题。
- 简单、篇幅短或整体较易的文章，词汇条数自然会较少；**不要为了凑满条数**而加入过于基础、对读懂主旨与关键细节帮助很小的项目。

【词汇推荐范围：主动覆盖广义 lexical item】
不要只推荐单个生词。应主动识别影响理解的词汇型表达，包括但不限于：
- 单词（如 Täter）
- 复合名词（如 Untersuchungshaft）
- 短语、搭配、固定表达（如 in fünf Fällen、unter Druck geraten、eine Entscheidung treffen）
- 动词短语、介词短语、新闻常用表达
- 可分动词（见下节）
用户若在界面中框选较长片段再「添加为词汇」，通常表示表达层面需求；全文分析时你也应同样积极地识别这类片段。

【可分动词与动词变形】
若文中出现可分动词或动词的非原形形式，每个相关 vocabulary 项应尽量体现：
- lemma：德语词典形式（动词多为不定式，如 einrichten、umbringen、niederlegen）
- surface_form：原文中的真实片段（可与 lemma 不同），例如「richtet … ein」「brachte … um」「niedergelegt」
- 在 zh_meaning / simple_de_explanation / reason_for_selection 中说明：是否为可分动词或变形、词典形式与文中形式的对应关系、为何值得推荐。
示例：原文「richtet für sie eine Beratungsstelle ein」→ lemma「einrichten」、surface 体现句中拆分形式、中文含「设立」等。
示例：「niedergelegt」→ lemma「niederlegen」，中文可含「辞去职务、放弃职位」等。

【名词：冠词与复数】
若推荐名词类条目，尽量在 lemma 或解释中给出：
- 名词性与推荐词典形式（如 das Mandat），并尽量标注 **der/die/das**；
- **part_of_speech 为 noun 或 compound_noun 时，lemma 字段必须以 der / die / das 之一开头并空格接词干**（如 das Mandat、die Entscheidung）；若冠词确实无法判断，lemma 仍用无冠词形式，并在 simple_de_explanation 首句写明「词典冠词不确定」。
- 常见复数形式（如 die Mandate），可在 zh_meaning 或 simple_de_explanation 中简要写出。
**不确定冠词或复数时不要编造**；宁可略写或标注「需查词典确认」。

【语法推荐策略（最多 8 条）】
优先推荐**明显影响理解**、尤其是对 **userLevel** 水平读者容易造成误解的结构，例如：
- 长句、从句嵌套、关系从句
- Konjunktiv I / II、间接引语
- 被动态、不定式结构、功能动词结构等新闻报道中常见难点
**不要**罗列过于基础、对理解本文帮助不大的语法标签。

【用户水平 userLevel】
userLevel 表示本次分析使用的学习者水平（若调用方未指定则常见默认为 B1）。你必须依据该水平判断哪些词汇与语法「值得推荐」：
- A2：侧重基础词与基础结构，但仍遵守非凑数原则。
- B1：新闻常见词、搭配、可分动词、复合名词、被动、从句等。
- B2：减少过于基础的词，侧重抽象表达、长句、语气、Konjunktiv/间接引语、复杂结构。
- C1/C2：仅在确有帮助时增加难度；grammar 仍不得超过 8 条。

【每条 vocabulary 须在释义中交代清楚的要点】
- lemma 尽量为词典形式；动词用不定式；名词尽量带冠词的规范形式（不确定则不瞎编）。
- 说明属于哪类表达（可分动词、固定搭配、介词短语、复合名词等，择要）。
- surface_form 若为句中变形或拆分形式，说明与 lemma 的对应关系。

【grammar 与 vocabulary 的分工】
若某片段更适合作为**语法结构**讲解（从句、语序、语态等），放入 grammar；若主要是**词汇 / 表达含义**学习，放入 vocabulary。同一位置不要重复堆砌。

硬性要求：
1. 不要推荐明显人名、地名、媒体名、公司名，除非它们本身有语言学习价值。
2. 不要推荐文章标题或正文中不存在的词或片段。
3. 每个 vocabulary.surface_form、grammar.selected_text 必须是所给原文中的真实连续子串（区分大小写与变音符号，与原文完全一致）。
4. 不要编造原文中不存在的词或例句；example_sentence 可摘自原文或基于原文片段的简短引用。
5. normalized_key：词汇的小写归一化键（可去重参考，如 lemma 小写或规范形式）。
6. grammar 每条必须包含 **grammar_key** 与 **normalized_key**：二者与用户总语法库唯一键 **(grammar_key, normalized_key)** 对齐；均须小写归一化、折叠多余空白（与词汇 normalized_key 规则一致）。**grammar_key** 表示大概念标签（如从句类型）；**normalized_key** 表示该条「语法记录」的稳定子键，可与 grammar_key 相同，或在同一概念下用更细的归一化片段区分不同难点；**不要**与 vocabulary 的 normalized_key 字段混用语义。

【part_of_speech 与 grammatical_gender（硬性，与 JSON schema 一致）】
每条 vocabulary 须**同时**正确填写 **part_of_speech** 与 **grammatical_gender**。

**part_of_speech** — 按表达的真实类型选择，**不要**为填 m/f/n 而把动词、搭配、可分动词一律标成名词：
- 单个名词 → **noun**
- 连写的复合名词（如 Untersuchungshaft）→ **compound_noun**
- 可分动词（句中可拆分）→ **separable_verb**
- 动词短语、多词动词表达 → **verb_phrase**
- 固定搭配、惯用表达（多词、以动词或虚词为主）→ **collocation** 或 **fixed_expression**
- 介词短语、一般短语 → **prepositional_phrase** 或 **phrase**
- 单个动词、形容词等 → **verb** / **adjective** 等

**grammatical_gender** — 仅取：**na** | **m** | **f** | **n** | **unclear**。
- **仅当** part_of_speech 为 **noun** 或 **compound_noun**（或条目本质上是名词性学习对象）时：填 **m / f / n**（无法判断用 **unclear**，不要用 na）；lemma 尽量以 **der / die / das** 开头（见上文名词节）。
- part_of_speech 为 **separable_verb、verb、verb_phrase、phrase、collocation、fixed_expression、prepositional_phrase** 及形容词、副词、介词等时：填 **na**。

**禁止**：把明显是动词搭配、固定表达、可分动词的条目标成 noun / compound_noun，仅为了输出冠词或 gender。`;

export function truncateForOpenAIAnalysis(fullText: string): {
  text: string;
  truncated: boolean;
} {
  if (fullText.length <= OPENAI_ANALYSIS_TEXT_CHAR_LIMIT) {
    return { text: fullText, truncated: false };
  }
  return {
    text: fullText.slice(0, OPENAI_ANALYSIS_TEXT_CHAR_LIMIT),
    truncated: true,
  };
}

export function buildOpenAIAnalysisUserContent(params: {
  title: string;
  originalText: string;
  userLevel: CefrLevel;
  /** 已掌握/暂忽略词汇键说明（OpenAI user 消息附加段） */
  vocabLibraryBlockAppendix?: string;
  /** 已掌握/暂忽略语法键说明（OpenAI user 消息附加段） */
  grammarLibraryBlockAppendix?: string;
}): string {
  const base = `userLevel: ${params.userLevel}

title:
${params.title}

originalText:
${params.originalText}`;
  const extras = [params.vocabLibraryBlockAppendix, params.grammarLibraryBlockAppendix]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
  if (!extras.length) return base;
  return `${base}\n\n${extras.join("\n\n")}`;
}

export function normalizeOpenAIArticleAnalysis(
  raw: unknown,
): ArticleAnalysisResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("分析结果格式无效");
  }
  const o = raw as Record<string, unknown>;
  const reading_questions = Array.isArray(o.reading_questions)
    ? o.reading_questions.filter((x) => typeof x === "string")
    : [];

  const vocRaw = Array.isArray(o.vocabulary) ? o.vocabulary : [];
  const vocSanitized: ArticleAnalysisResult["vocabulary"] = vocRaw.map(
    (row): AnalyzedVocabularyItem => {
      const r = row as Record<string, unknown>;
      const base = r as unknown as AnalyzedVocabularyItem;
      return {
        ...base,
        grammatical_gender: parseGrammaticalGender(r.grammatical_gender),
      };
    },
  );
  const voc = vocSanitized;

  const graRaw = Array.isArray(o.grammar) ? o.grammar : [];
  const graSanitized: ArticleAnalysisResult["grammar"] = graRaw.map((row) => {
    const r = row as Record<string, unknown>;
    const gk = typeof r.grammar_key === "string" ? r.grammar_key : "";
    const nkIn = typeof r.normalized_key === "string" ? r.normalized_key : "";
    const nk = nkIn.trim()
      ? normalizeTextKey(nkIn)
      : normalizeTextKey(gk);
    const base = r as unknown as ArticleAnalysisResult["grammar"][0];
    return {
      ...base,
      grammar_key: gk,
      normalized_key: nk,
    };
  });
  const gra =
    graSanitized.length > 8 ? graSanitized.slice(0, 8) : graSanitized;

  return {
    vocabulary: voc,
    grammar: gra,
    summary_zh: typeof o.summary_zh === "string" ? o.summary_zh : "",
    summary_de_simple:
      typeof o.summary_de_simple === "string" ? o.summary_de_simple : "",
    reading_questions: reading_questions.slice(0, 3),
  };
}

export { SYSTEM_PROMPT };
