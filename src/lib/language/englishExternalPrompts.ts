/**
 * 英语文章的「外部深入解释」与「全文翻译」Prompt（复制到剪贴板，交给外部 AI；不调用本应用 API、不入库）。
 * 参数与德语版（src/lib/grammar/labelValidation.ts、buildFullArticleTranslationPrompt.ts）相同，德语版不变。
 */

function field(value: string | null | undefined): string {
  if (value == null) return "未提供";
  const t = String(value).trim();
  return t.length > 0 ? t : "未提供";
}

export function buildGrammarExternalDeepDivePromptEn(params: {
  userLevel: string;
  grammarName: string;
  selectedText: string;
  occurrenceSentence: string;
  articleTitle: string;
  explanationZh: string;
  explanationDeSimple: string;
}): string {
  return `请作为一名面向中文母语英语学习者的英语语法老师，详细解释下面这条英语语法现象。

用户水平：${field(params.userLevel)}
语法名称：${field(params.grammarName)}
文章标题：${field(params.articleTitle)}

【完整英文原句】（请以此为准理解结构，不要只分析下面片段）
${field(params.occurrenceSentence)}

【用户选中的片段】
${field(params.selectedText)}

当前基础中文解释：
${field(params.explanationZh)}

当前简明英文解释：
${field(params.explanationDeSimple)}

请按以下结构详细解释：

1. 先用中文说明这句话的大意。
2. 拆解这个语法结构：
   - 句子主干（主语、谓语、宾语 / 表语）是什么？
   - 哪一部分是从句或非谓语结构（不定式、动名词、分词）？它修饰或补充什么？
   - 时态和体（如现在完成时、进行体）在这里表达什么？
   - 如果涉及被动、条件句、虚拟语气或倒装，分别体现在哪里？
3. 把它改写成更简单、更常见的英文说法，并说明意思或语气的差别。
4. 说明为什么新闻 / 正式文章里会使用这种结构。
5. 给出 5 个类似 B1-B2 水平例句：
   - 英文原句
   - 中文翻译
   - 语法拆解
6. 指出中文母语者常见的误解或错误。
7. 最后给我一个简单记忆规则，帮助我以后看到类似结构时能识别出来。`;
}

export function buildVocabularyExternalDeepDivePromptEn(params: {
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
  return `请作为一名面向中文母语英语学习者的英语词汇老师，详细解释下面这个英语词汇或表达。

用户水平：${field(params.userLevel)}
词条：${field(params.displayTerm)}
词典形式：${field(params.canonicalForm)}
原文形式：${field(params.surfaceForm)}
词性/类型：${field(params.partOfSpeechOrItemType)}
文章标题：${field(params.articleTitle)}
上下文句子：${field(params.occurrenceSentence)}
词条估计等级（CEFR 等）：${field(params.levelEstimate)}

当前中文解释：
${field(params.zhMeaning)}

当前简明英文解释：
${field(params.simpleDeExplanation)}

请按以下结构详细解释：

1. 先说明这个词/表达在本文中的意思，以及它的语体（正式 / 非正式 / 比喻 / 新闻常用）。
2. 给出音标（英式与美式如有不同请分别给出）和重音位置。
3. 如果是名词：可数 / 不可数、复数形式、常见搭配（动词 + 名词、形容词 + 名词）。
4. 如果是动词：原形、本文中的变形、常见宾语和介词搭配；是否及物。
5. 如果是短语动词：说明它的意思为什么不能从单词直接推出，宾语可以放在哪里（可分 / 不可分），有哪些近义的单个动词。
6. 如果是搭配、习语或介词搭配：解释字面结构与实际意思，给出常见用法与使用场合。
7. 与容易混淆的近义词做对比（若有）。
8. 给出 5 个类似 B1-B2 水平例句：
   - 英文原句
   - 中文翻译
   - 用法说明
9. 最后给我一个简单记忆方法，帮助我以后在文章中认出这个词或表达。`;
}

export function buildFullArticleTranslationPromptEn(params: {
  articleText: string;
  title?: string;
}): string {
  const title = params.title?.trim();
  const header = title ? `文章标题：${title}\n\n` : "";
  return `${header}请把下面这篇英语文章完整、自然地翻译成中文。
要求：
1. 不要逐字硬翻，要翻译成中文读者自然能理解的表达。
2. 保留原文的段落结构。
3. 人名、机构名、地名第一次出现时尽量保留原文，并在中文后括号标注。
4. 对难懂的英语长句（长定语从句、插入语、倒装），可以在翻译中适当调整语序。
5. 习语和比喻表达请译出实际意思，必要时括号说明字面意思。
6. 不要省略内容。
7. 如果文章太长，请分段继续翻译，不要总结。

英语原文：
${params.articleText}`;
}
