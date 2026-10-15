import { snippetAroundOffsets } from "@/lib/articleAnalysis/enrichmentContext";
import {
  extractSentence,
  findBestTextOccurrence,
} from "@/lib/articleReadingModel";

export function resolveGrammarSelectionContext(
  originalText: string,
  selectedText: string,
): {
  ok: true;
  start: number;
  end: number;
  occurrenceSentence: string;
  snippet: string;
} | { ok: false; message: string } {
  const sel = selectedText.trim();
  if (!sel) {
    return { ok: false, message: "selected_text 不能为空" };
  }
  const hit = findBestTextOccurrence(originalText, sel, 0);
  if (!hit) {
    return {
      ok: false,
      message: "selected_text 必须是文章正文中的连续子串",
    };
  }
  const surf = originalText.slice(hit.start, hit.end);
  const occurrenceSentence = extractSentence(originalText, hit.start, hit.end);
  const snippet = snippetAroundOffsets(originalText, hit.start, hit.end);
  return {
    ok: true,
    start: hit.start,
    end: hit.end,
    occurrenceSentence,
    snippet,
  };
}
