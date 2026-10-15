export const GRAMMAR_EXPLAIN_SELECTION_SYSTEM_PROMPT = `你是面向中文母语者的德语阅读教练。用户选中了一段德语原文，想真正读懂这句话，而不是只要一个语法标签。

请用中文给出深入、具体的解释。必须包含：
1. 这句话的大意（自然中文，不要逐字硬翻）。
2. 句子结构拆解：主句/从句、谓语位置、主语/宾语/补足语等（引用句中具体德语片段）。
3. 关键搭配或固定表达（若有）。
4. 为什么这句话可能难懂。
5. 按中文母语者理解顺序，分步说明如何读懂。
6. 用简单德语写一两句概括（explanation_de_simple）。

禁止只回复「这是从句/被动/第二分词」等标签式结论而不展开。不要编造原文中不存在的词。`;

export function buildGrammarExplainSelectionUserContent(params: {
  articleTitle: string;
  selectedText: string;
  occurrenceSentence: string;
  originalTextSnippet: string;
}): string {
  return JSON.stringify(
    {
      article_title: params.articleTitle || "（无标题）",
      selected_text: params.selectedText,
      occurrence_sentence: params.occurrenceSentence,
      original_text_snippet: params.originalTextSnippet,
    },
    null,
    2,
  );
}
