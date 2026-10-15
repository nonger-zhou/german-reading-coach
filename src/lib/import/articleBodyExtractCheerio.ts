import type { CheerioAPI } from "cheerio";
import {
  dedupeParagraphList,
  isImportBodyBlockCandidate,
  isImportBodyBlockNoise,
  blockElementClassLooksLikeBody,
} from "./articleBodyExtractLogic";

function safeText(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** 从 article/main 内叶子 `section` 与正文 class 的 `div` 收集块级段落 */
export function collectBlockParagraphs(
  $: CheerioAPI,
  selector: string,
): string[] {
  const root = $(selector).first();
  if (!root.length) return [];

  const out: string[] = [];

  const tryPush = (raw: string) => {
    const text = safeText(raw);
    if (!isImportBodyBlockCandidate(text)) return;
    if (isImportBodyBlockNoise(text)) return;
    out.push(text);
  };

  root.find("section").each((_, el) => {
    const $el = $(el);
    if ($el.closest("header,footer,nav,aside,form").length > 0) return;
    if ($el.find("section").length > 0) return;
    tryPush($el.text());
  });

  if (out.length < 2) {
    root.find("div[class]").each((_, el) => {
      const $el = $(el);
      if ($el.closest("header,footer,nav,aside,form").length > 0) return;
      const cls = String($el.attr("class") ?? "");
      if (!blockElementClassLooksLikeBody(cls)) return;
      if (
        $el.find(
          "section, div[class*='text' i], div[class*='content' i], div[class*='body' i]",
        ).length > 0
      ) {
        return;
      }
      tryPush($el.text());
    });
  }

  return dedupeParagraphList(out);
}
