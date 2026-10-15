/**
 * 「添加后自动生成 AI 解释」开关（2026-10-15）。
 *
 * 阅读页手动添加词汇 / 语法并保存成功后，若条目还缺解释，自动调用一次补充解释（每个新条目只调一次；
 * 刷新、重新打开文章都不会再调用，与 PRD Phase 3.14 一致）。默认开；在设置页可关闭。
 * 保存在本机浏览器（与「点击后自动播放发音」相同），读写失败时按默认值（开）处理。
 */
export const STORAGE_KEY_AUTO_ENRICH_ON_ADD = "german-reading-coach:autoEnrichOnAdd";

export function readAutoEnrichOnAdd(): boolean {
  try {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(STORAGE_KEY_AUTO_ENRICH_ON_ADD) !== "false";
  } catch {
    return true;
  }
}

export function writeAutoEnrichOnAdd(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_AUTO_ENRICH_ON_ADD, enabled ? "true" : "false");
  } catch {
    /* 隐私模式等：忽略，按默认值 */
  }
}

/** 队列：去重追加 */
export function enqueueUnique(queue: readonly string[], id: string): string[] {
  return queue.includes(id) ? [...queue] : [...queue, id];
}
