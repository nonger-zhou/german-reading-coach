/**
 * 浏览器插件「可见页面」正文/标题提取的纯函数规则。
 * `browser-extension/chrome-mv3/background.js` 内 `collectVisibleArticle` 须与本文件保持语义一致。
 * `<p>` 不足时的块级 section 规则见 `articleBodyExtractLogic.ts`（链接导入 `importFromUrl.ts` 亦同）。
 */

export function stripSiteSuffixFromTitle(title: string): string {
  const t = title.replace(/\s+/g, " ").trim();
  if (!t) return "";
  const parts = t.split(/\s*[|•·–—›»]\s*/);
  if (parts.length >= 2) {
    const first = parts[0]!.trim();
    if (first.length >= 16) return first;
  }
  return t;
}

export function normalizeExtractText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 相关推荐 / 侧栏模块标题 */
export function isRelatedSectionHeading(text: string): boolean {
  const n = normalizeExtractText(text);
  if (!n) return false;
  return (
    /^(das konnte sie auch interessieren|das konnte ihnen auch interessieren|konnte sie auch interessieren|konnte ihnen auch interessieren|mehr zum thema|auch interessant|weitere artikel|weiters lesen|lesen sie auch|empfohlene artikel|ahnliche artikel|related stories|more stories)/.test(
      n,
    ) || n.includes("auch interessieren")
  );
}

/** 作者署名、推荐卡人名（非正文句） */
export function isAuthorNameLine(text: string): boolean {
  const s = text.replace(/\s+/g, " ").trim();
  if (s.length < 4 || s.length > 90) return false;
  if (/^von\s+/i.test(s)) return true;
  if (
    /^[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß.-]+){0,4}$/.test(s) &&
    !/[.!?;:«»‹›]/.test(s)
  ) {
    return true;
  }
  return false;
}

/** 第三方嵌入 / Cookie 同意占位（NZZ、SRF、Tamedia 等常见 `<p>` 文案） */
export function isCookieOrExternalEmbedPlaceholder(text: string): boolean {
  const n = normalizeExtractText(text);
  if (!n) return false;
  if (n.includes("zusatzliche cookies")) return true;
  if (n.includes("erganzenden externen inhalt")) return true;
  return false;
}

export function isExtractUiNoiseLine(text: string): boolean {
  const s = text.replace(/\s+/g, " ").trim();
  if (!s) return true;
  if (isCookieOrExternalEmbedPlaceholder(s)) return true;
  if (isRelatedSectionHeading(s) || isAuthorNameLine(s)) return true;
  if (
    /^(abo|einloggen|registrieren|teilen|drucken|speichern|newsletter|weitere newsletter)$/i.test(
      s,
    )
  ) {
    return true;
  }
  if (/^\d+\s*$/.test(s)) return true;
  if (/^@[\w.-]+$/i.test(s)) return true;
  return false;
}

export function isArticleParagraphLine(text: string): boolean {
  const s = text.replace(/\s+/g, " ").trim();
  if (isExtractUiNoiseLine(s)) return false;
  if (s.length >= 80) return true;
  if (s.length >= 35 && /[.!?»:]$/.test(s)) return true;
  return false;
}

export function isReasonableArticleHeadline(text: string): boolean {
  const s = text.replace(/\s+/g, " ").trim();
  if (s.length < 20 || s.length > 260) return false;
  if (!/[A-Za-zÄÖÜäöüß]/.test(s)) return false;
  if (isRelatedSectionHeading(s) || isAuthorNameLine(s)) return false;
  if (/^(Startseite|Newsletter|Weitere Newsletter|Der Morgen|Abo|Podcast)$/i.test(s)) {
    return false;
  }
  if (/^\s*(Startseite|Home)\s*[|›>]/i.test(s)) {
    return false;
  }
  const separatorCount = (s.match(/[|›>]/g) || []).length;
  if (separatorCount >= 2 && s.length < 160) return false;
  return true;
}

export function shouldStopExtractAtLine(text: string, collectedChars: number): boolean {
  if (isRelatedSectionHeading(text)) return true;
  if (collectedChars < 800) return false;
  return /^(fehler gefunden|jetzt melden|mehr zum thema|auch interessant|weitere artikel|weitere newsletter|newsletter|der morgen|\d+\s+kommentare?)/i.test(
    text.trim(),
  );
}

/** 插件/抓取标题是否不宜直接用作文章标题 */
export function isBadImportPluginTitle(title: string): boolean {
  const s = title.replace(/\s+/g, " ").trim();
  if (!s) return true;
  if (!isReasonableArticleHeadline(s)) return true;
  return false;
}
