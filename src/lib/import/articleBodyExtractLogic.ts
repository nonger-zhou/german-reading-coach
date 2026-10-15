/**
 * 链接导入 / 插件正文提取：`<p>` 不足时是否改用块级 section/div。
 * `importFromUrl.ts` 与 `visibleArticleExtractLogic.ts`、插件 `background.js` 保持语义一致。
 */

import {
  isExtractUiNoiseLine,
  normalizeExtractText,
} from "./visibleArticleExtractLogic";

export function paragraphSetCharCount(paragraphs: string[]): number {
  return paragraphs.reduce((sum, p) => sum + p.replace(/\s+/g, " ").trim().length, 0);
}

/** 块级正文是否明显优于仅 `<p>` 采集（机构博客如 blog.nationalmuseum.ch） */
export function shouldPreferBlockParagraphs(
  pParagraphs: string[],
  blockParagraphs: string[],
): boolean {
  const pChars = paragraphSetCharCount(pParagraphs);
  const blockChars = paragraphSetCharCount(blockParagraphs);
  if (blockParagraphs.length < 2) return false;
  if (blockChars < 900) return false;
  return blockChars > Math.max(900, pChars * 1.35);
}

/** 导入正文块级段落噪声（元数据、订阅、推荐尾等） */
export function isImportBodyBlockNoise(text: string): boolean {
  const s = text.replace(/\s+/g, " ").trim();
  if (!s) return true;
  if (isExtractUiNoiseLine(s)) return true;
  const n = normalizeExtractText(s);
  if (n === "videofallback" || n.startsWith("video fallback")) return true;
  if (
    /^(publiziert|aktualisiert|veroffentlicht|published|updated)(\s*am)?(\s|:|\d)/.test(
      n,
    )
  ) {
    return true;
  }
  if (/^url(\s|:|\d)/.test(n)) return true;
  if (n.includes("wir informieren sie") && s.length < 140) return true;
  if (n.startsWith("mehr zu ") && s.length < 120) return true;
  if (n.includes("blog abonnieren") && s.length < 220) return true;
  if (n.includes("weitere beitrage") && s.length < 120) return true;
  if (
    n.includes("ist historiker") &&
    n.includes("publizist") &&
    s.length < 220
  ) {
    return true;
  }
  return false;
}

export function isImportBodyBlockCandidate(text: string): boolean {
  const s = text.replace(/\s+/g, " ").trim();
  if (isImportBodyBlockNoise(s)) return false;
  if (s.length >= 80) return true;
  if (s.length >= 35 && /[.!?»:]$/.test(s)) return true;
  return false;
}

export function blockElementClassLooksLikeBody(className: string): boolean {
  return /(?:^|[\s_-])(?:text|content|body|article|post|entry|snm-text)(?:$|[\s_-])/i.test(
    className,
  );
}

export function dedupeParagraphList(paragraphs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paragraphs) {
    const key = normalizeExtractText(p);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p.replace(/\s+/g, " ").trim());
  }
  return out;
}
