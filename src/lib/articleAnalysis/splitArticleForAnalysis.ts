/**
 * 长文分段：按段落（空行 / 换行）切成不超过 `limit` 字符的若干段，最多 `maxChunks` 段。
 * 单个段落超过 limit 时按句号再切；仍超长则硬切。
 */
export function splitArticleForAnalysis(
  text: string,
  limit: number,
  maxChunks: number,
): { chunks: string[]; truncated: boolean; analyzedChars: number } {
  if (text.length <= limit) {
    return { chunks: [text], truncated: false, analyzedChars: text.length };
  }

  const pieces: string[] = [];
  for (const para of text.split(/(?<=\n)/)) {
    if (para.length <= limit) {
      pieces.push(para);
      continue;
    }
    for (const sentence of para.split(/(?<=[.!?。])\s+/)) {
      for (let i = 0; i < sentence.length; i += limit) {
        pieces.push(sentence.slice(i, i + limit) + " ");
      }
    }
  }

  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (current && current.length + piece.length > limit) {
      chunks.push(current);
      current = "";
    }
    current += piece;
  }
  if (current.trim()) chunks.push(current);

  const kept = chunks.slice(0, maxChunks);
  const analyzedChars = kept.reduce((n, c) => n + c.length, 0);
  return {
    chunks: kept,
    truncated: chunks.length > maxChunks,
    analyzedChars,
  };
}
