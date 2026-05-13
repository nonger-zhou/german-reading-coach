/** 仅截取原文片段，避免把整篇长文发给模型 */
export function snippetAroundOffsets(
  originalText: string,
  start: number | null | undefined,
  end: number | null | undefined,
  radius = 240,
): string {
  const len = originalText.length;
  if (!len) return "";
  if (
    start === null ||
    start === undefined ||
    end === null ||
    end === undefined ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end <= start
  ) {
    return originalText.slice(0, Math.min(900, len));
  }
  const mid = Math.floor((start + end) / 2);
  const from = Math.max(0, mid - radius);
  const to = Math.min(len, mid + radius);
  return originalText.slice(from, to);
}
