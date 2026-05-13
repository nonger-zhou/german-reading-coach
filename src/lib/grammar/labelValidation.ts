export type GrammarDraft = {
  name_de: string;
  name_zh: string;
  explanation_zh: string;
  explanation_de_simple: string;
};

export type GrammarValidationResult = GrammarDraft & {
  fixed_expression: string | null;
  translation_zh: string | null;
  common_misunderstanding_zh: string | null;
  corrected_from: string | null;
};

function hasPattern(sentence: string, pattern: RegExp): boolean {
  return pattern.test(sentence);
}

function isFehlenEsPattern(sentence: string): boolean {
  const s = sentence.toLowerCase();
  return (
    hasPattern(s, /\bes\s+habe\b/) && hasPattern(s, /\ban\b/) && hasPattern(s, /\bgefehlt\b/)
  ) || (
    hasPattern(s, /\bes\s+hat\b/) && hasPattern(s, /\ban\b/) && hasPattern(s, /\bgefehlt\b/)
  ) || (
    hasPattern(s, /\bes\s+fehlt\b/) && hasPattern(s, /\ban\b/)
  );
}

export function validateGrammarLabel(
  draft: GrammarDraft,
  params: {
    sentence: string;
    selectedText: string;
  },
): GrammarValidationResult {
  const sentence = `${params.sentence} ${params.selectedText}`.trim();
  const haystack = `${draft.name_de} ${draft.name_zh} ${draft.explanation_zh}`.toLowerCase();

  const result: GrammarValidationResult = {
    ...draft,
    fixed_expression: null,
    translation_zh: null,
    common_misunderstanding_zh: null,
    corrected_from: null,
  };

  if (isFehlenEsPattern(sentence)) {
    const labeledAsK2 = /konjunktiv\s*ii|虚拟式\s*ii/.test(haystack);
    if (labeledAsK2 || /es\s+habe/.test(sentence.toLowerCase())) {
      result.corrected_from = `${draft.name_zh} / ${draft.name_de}`;
      result.name_zh = "间接引语中的 Konjunktiv I";
      result.name_de = "Konjunktiv I in der indirekten Rede";
      result.explanation_zh =
        "这里的“habe”是 Konjunktiv I，不是 Konjunktiv II，用于间接引语，表示在转述报告或他人的说法。固定表达是“jemandem fehlt es an etwas”，意思是某人缺少某物或某方面不足。";
      result.explanation_de_simple =
        "Hier ist „habe“ Konjunktiv I (indirekte Rede), nicht Konjunktiv II. Die feste Wendung ist „jemandem fehlt es an etwas“.";
      result.fixed_expression = "jemandem fehlt es an etwas";
      result.translation_zh = "据称 Maisano 缺乏学术资历和领导经验。";
      result.common_misunderstanding_zh =
        "不要把“habe”误认为 Konjunktiv II；Konjunktiv II 常见形式是“hätte”。";
    }
    return result;
  }

  const sLower = sentence.toLowerCase();
  if (/\bwenn\b/.test(sLower) && /\bhätte(n)?\b/.test(sLower)) {
    if (!/konjunktiv\s*ii|虚拟式\s*ii/.test(haystack)) {
      result.corrected_from = `${draft.name_zh} / ${draft.name_de}`;
      result.name_zh = "Konjunktiv II 假设句";
      result.name_de = "Konjunktiv II im irrealen Wenn-Satz";
    }
    return result;
  }

  if (/\bhätten\b/.test(sLower) && /\bgeführt\b/.test(sLower) && /\b(dass|laut|bericht|sagte|hieß)\b/.test(sLower)) {
    if (!/ersatz|konjunktiv\s*ii|虚拟式\s*ii/.test(haystack)) {
      result.corrected_from = `${draft.name_zh} / ${draft.name_de}`;
      result.name_zh = "间接引语中的 Konjunktiv-II-Ersatzform";
      result.name_de = "Konjunktiv-II-Ersatzform in der indirekten Rede";
    }
  }

  return result;
}

export function buildExternalDeepDivePrompt(params: {
  sentence: string;
  selectedText: string;
  titleZh: string;
  titleDe: string;
  explanationZh: string;
  explanationDe: string;
}): string {
  return [
    "请深入讲解以下德语语法点，重点纠错并给出可迁移规则：",
    `句子: ${params.sentence}`,
    `选中片段: ${params.selectedText}`,
    `当前标题(中): ${params.titleZh}`,
    `当前标题(德): ${params.titleDe}`,
    `当前简短中文解释: ${params.explanationZh}`,
    `当前简短德语解释: ${params.explanationDe}`,
    "请输出：1) 正确语法标签与理由；2) 若涉及 Konjunktiv I/II，给最小对比；3) 固定表达与字面结构；4) 2-3 个同类例句。",
  ].join("\n");
}

function grammarExternalPromptField(value: string | null | undefined): string {
  if (value == null) return "未提供";
  const t = String(value).trim();
  return t.length > 0 ? t : "未提供";
}

/** 阅读页「外部深入解释」：拼装剪贴板 prompt（不调 API、不入库）。 */
export function buildGrammarExternalDeepDivePrompt(params: {
  userLevel: string;
  grammarName: string;
  selectedText: string;
  occurrenceSentence: string;
  articleTitle: string;
  explanationZh: string;
  explanationDeSimple: string;
}): string {
  const userLevel = grammarExternalPromptField(params.userLevel);
  const grammarName = grammarExternalPromptField(params.grammarName);
  const selectedText = grammarExternalPromptField(params.selectedText);
  const occurrenceSentence = grammarExternalPromptField(
    params.occurrenceSentence,
  );
  const articleTitle = grammarExternalPromptField(params.articleTitle);
  const explanationZh = grammarExternalPromptField(params.explanationZh);
  const explanationDeSimple = grammarExternalPromptField(
    params.explanationDeSimple,
  );

  return `请作为一名面向中文母语德语学习者的德语语法老师，详细解释下面这条德语语法现象。

用户水平：${userLevel}
语法名称：${grammarName}
原文片段：${selectedText}
上下文句子：${occurrenceSentence}
文章标题：${articleTitle}

当前基础中文解释：
${explanationZh}

当前简单德语解释：
${explanationDeSimple}

请按以下结构详细解释：

1. 先用中文说明这句话的大意。
2. 拆解这个语法结构：
   - 哪一部分是主句？
   - 哪一部分是从句？
   - 谓语在哪里？
   - 如果涉及被动，哪一部分表示被动？
   - 如果涉及 Konjunktiv，哪一部分表示虚拟语气或间接引语？
   - 动词原形是什么？
   - Partizip II 是什么？
3. 把它改写成更普通的直陈式德语，并解释语气差别。
4. 如果适用，把它改写成主动句，并解释主语和宾语变化。
5. 说明为什么新闻报道里会使用这种结构。
6. 给出 5 个类似 B1-B2 水平例句：
   - 德语原句
   - 中文翻译
   - 语法拆解
7. 最后给我一个简单记忆规则，帮助我以后看到类似结构时能识别出来。`;
}

/** 阅读页词汇「外部深入解释」：拼装剪贴板 prompt（不调 API、不入库）。 */
export function buildVocabularyExternalDeepDivePrompt(params: {
  userLevel: string;
  displayTerm: string;
  canonicalForm: string;
  surfaceForm: string;
  partOfSpeechOrItemType: string;
  articleTitle: string;
  occurrenceSentence: string;
  zhMeaning: string;
  simpleDeExplanation: string;
  levelEstimate: string;
}): string {
  const userLevel = grammarExternalPromptField(params.userLevel);
  const displayTerm = grammarExternalPromptField(params.displayTerm);
  const canonicalForm = grammarExternalPromptField(params.canonicalForm);
  const surfaceForm = grammarExternalPromptField(params.surfaceForm);
  const partOfSpeechOrItemType = grammarExternalPromptField(
    params.partOfSpeechOrItemType,
  );
  const articleTitle = grammarExternalPromptField(params.articleTitle);
  const occurrenceSentence = grammarExternalPromptField(
    params.occurrenceSentence,
  );
  const zhMeaning = grammarExternalPromptField(params.zhMeaning);
  const simpleDeExplanation = grammarExternalPromptField(
    params.simpleDeExplanation,
  );
  const levelEstimate = grammarExternalPromptField(params.levelEstimate);

  return `请作为一名面向中文母语德语学习者的德语词汇老师，详细解释下面这个德语词汇或表达。

用户水平：${userLevel}
词条：${displayTerm}
词典形式：${canonicalForm}
原文形式：${surfaceForm}
词性/类型：${partOfSpeechOrItemType}
文章标题：${articleTitle}
上下文句子：${occurrenceSentence}
词条估计等级（CEFR 等）：${levelEstimate}

当前中文解释：
${zhMeaning}

当前简单德语解释：
${simpleDeExplanation}

请按以下结构详细解释：

1. 先说明这个词/表达在本文中的意思。
2. 如果是名词：
   - 给出 der/die/das
   - 给出复数形式
   - 说明常见搭配
3. 如果是动词：
   - 给出不定式
   - 说明本文中的变形
   - 说明常见宾语或介词搭配
4. 如果是可分动词：
   - 给出完整词典形式
   - 指出动词核心和可分前缀分别在哪里
   - 解释为什么前缀出现在句尾或 Partizip II 里
5. 如果是短语、搭配或固定表达：
   - 解释它为什么不能只按单个词理解
   - 给出常见用法
6. 给出 5 个类似 B1-B2 水平例句：
   - 德语原句
   - 中文翻译
   - 用法说明
7. 最后给我一个简单记忆方法，帮助我以后在文章中认出这个词或表达。`;
}
