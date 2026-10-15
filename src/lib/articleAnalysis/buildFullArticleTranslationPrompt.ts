/**
 * 全文翻译外接 AI：生成 Prompt 复制到剪贴板（不调用本 App OpenAI、不入库）。
 */

export function buildFullArticleTranslationPrompt(params: {
  articleText: string;
  title?: string;
}): string {
  const title = params.title?.trim();
  const header = title
    ? `文章标题：${title}\n\n`
    : "";
  return `${header}请把下面这篇德语文章完整、自然地翻译成中文。
要求：
1. 不要逐字硬翻，要翻译成中文读者自然能理解的表达。
2. 保留原文的段落结构。
3. 人名、机构名、地名第一次出现时尽量保留原文，并在中文后括号标注。
4. 对难懂的德语长句，可以在翻译中适当调整语序。
5. 不要省略内容。
6. 如果文章太长，请分段继续翻译，不要总结。

德语原文：
${params.articleText}`;
}
