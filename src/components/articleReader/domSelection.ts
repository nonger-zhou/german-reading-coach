/** 从 InteractiveArticleReader.tsx 拆出（2026-10-15，行为不变）。 */


export function scrollElementIntoScrollContainer(
  container: HTMLElement,
  element: HTMLElement,
  options?: {
    paddingTop?: number;
    behavior?: ScrollBehavior;
    /** start：保留上边距；center：在容器视区内纵向居中 */
    align?: "start" | "center";
    /**
     * 视区内为元素底部留出空隙（px），避免被底部固定抽屉挡住。
     * 通过限制单次滚动量 D：D 需同时满足「顶边留白」与「底边不落入底部 reserve 区域」。
     */
    ensureGapBottom?: number;
  },
) {
  const behavior = options?.behavior ?? "smooth";
  const cRect = container.getBoundingClientRect();
  const tRect = element.getBoundingClientRect();
  const reserve = options?.ensureGapBottom ?? 0;
  let nextTop: number;
  if (options?.align === "center") {
    nextTop =
      container.scrollTop +
      (tRect.top - cRect.top) -
      (cRect.height / 2 - tRect.height / 2);
  } else {
    const pad = options?.paddingTop ?? 72;
    const DHigh = tRect.top - cRect.top - pad;
    let D = DHigh;
    if (reserve > 0) {
      const DLow = tRect.bottom - cRect.bottom + reserve;
      D = DLow > DHigh ? DLow : DHigh;
    }
    nextTop = container.scrollTop + D;
  }
  container.scrollTo({ top: Math.max(0, nextTop), behavior });
}

/** 仅在元素未完整落在容器视区内时做最小滚动，避免「滚到中部」裁切 */
export function scrollElementIntoViewIfNeeded(
  container: HTMLElement,
  element: HTMLElement,
  options?: {
    paddingTop?: number;
    paddingBottom?: number;
    behavior?: ScrollBehavior;
  },
) {
  const cRect = container.getBoundingClientRect();
  const tRect = element.getBoundingClientRect();
  const padTop = options?.paddingTop ?? 12;
  const padBottom = options?.paddingBottom ?? 12;
  let delta = 0;
  if (tRect.top < cRect.top + padTop) {
    delta = tRect.top - cRect.top - padTop;
  } else if (tRect.bottom > cRect.bottom - padBottom) {
    delta = tRect.bottom - cRect.bottom + padBottom;
  }
  if (delta !== 0) {
    container.scrollBy({ top: delta, behavior: options?.behavior ?? "smooth" });
  }
}

/** 将视口矩形滚入 overflow 容器（用于文本选区，无对应 DOM 节点时） */
export function scrollRectIntoScrollContainer(
  container: HTMLElement,
  rect: DOMRect,
  options?: {
    paddingTop?: number;
    ensureGapBottom?: number;
    behavior?: ScrollBehavior;
  },
) {
  if (rect.width === 0 && rect.height === 0) return;
  const cRect = container.getBoundingClientRect();
  const pad = options?.paddingTop ?? 48;
  const reserve = options?.ensureGapBottom ?? 0;
  let delta = 0;
  if (rect.top < cRect.top + pad) {
    delta = rect.top - cRect.top - pad;
  }
  const bottomOverflow = rect.bottom - cRect.bottom + reserve;
  if (bottomOverflow > 0) {
    delta = Math.max(delta, bottomOverflow);
  }
  if (delta !== 0) {
    container.scrollBy({ top: delta, behavior: options?.behavior ?? "smooth" });
  }
}

/** 选区各行矩形（过滤空 rect）；用于浮层锚点，避免用整块 bounding box 盖住整句 */
export function getSelectionLineRects(range: Range): DOMRect[] {
  return Array.from(range.getClientRects()).filter(
    (r) => r.width > 0 && r.height > 0,
  );
}

/** 浮层锚在线条：单行用词本身；多行用最后一行（工具栏在选区下方） */
export function getSelectionAnchorRect(range: Range): DOMRect {
  const lines = getSelectionLineRects(range);
  if (lines.length === 0) return range.getBoundingClientRect();
  return lines[lines.length - 1]!;
}

/** 含手机端「已选：」一行时的浮层总高度估算 */
export const SELECTION_POPOVER_H = 68;
export const SELECTION_POPOVER_GAP = 32;

/**
 * 浮层贴在选区下方（空间不足时改到第一行上方），并与各行 rect 保持间距，避免盖住选中文字。
 */
export function computeSelectionPopoverPosition(
  anchorRect: DOMRect,
  lineRects: DOMRect[],
): { left: number; top: number } {
  const margin = 12;
  const popoverH = SELECTION_POPOVER_H;
  const gap = SELECTION_POPOVER_GAP;
  const left = Math.min(
    Math.max(anchorRect.left + anchorRect.width / 2, margin + 100),
    window.innerWidth - margin - 100,
  );

  const maxLineBottom = lineRects.length
    ? Math.max(...lineRects.map((r) => r.bottom))
    : anchorRect.bottom;
  const minLineTop = lineRects.length
    ? Math.min(...lineRects.map((r) => r.top))
    : anchorRect.top;

  let top = maxLineBottom + gap;

  const overlapsSelection = (t: number) =>
    lineRects.some(
      (r) => t < r.bottom + 8 && t + popoverH > r.top - 8,
    );

  if (
    top + popoverH > window.innerHeight - margin ||
    overlapsSelection(top)
  ) {
    top = minLineTop - popoverH - gap;
  }

  if (overlapsSelection(top)) {
    top = maxLineBottom + gap + 12;
  }

  top = Math.max(margin, Math.min(top, window.innerHeight - popoverH - margin));
  return { left, top };
}

export const GERMAN_WORD_CHAR_RE = /[A-Za-zÄÖÜäöüß]/;
export const GERMAN_WORD_TOKEN_RE = /[A-Za-zÄÖÜäöüß]+(?:[-'][A-Za-zÄÖÜäöüß]+)*/g;

export const TAP_SELECT_MOVE_PX = 12;
export const TAP_SELECT_MAX_MS = 450;
/** 超过该位移才视为拖选，此时才暂时禁用高亮 pointer-events（避免轻点词汇打不开右侧卡） */
export const DRAG_HIGHLIGHT_PASSTHROUGH_PX = 8;

export function getCaretRangeFromPoint(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
  };
  if (typeof doc.caretRangeFromPoint === "function") {
    return doc.caretRangeFromPoint(x, y);
  }
  const pos = doc.caretPositionFromPoint?.(x, y);
  if (!pos) return null;
  const r = document.createRange();
  r.setStart(pos.offsetNode, pos.offset);
  r.collapse(true);
  return r;
}

export function expandRangeToGermanWord(caret: Range): Range | null {
  let node: Node | null = caret.startContainer;
  let offset = caret.startOffset;
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    const child = el.childNodes[offset] ?? el.childNodes[offset - 1];
    if (child?.nodeType === Node.TEXT_NODE) {
      node = child;
      offset = 0;
    } else {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      node = walker.nextNode();
      offset = 0;
    }
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const text = node.textContent ?? "";
  GERMAN_WORD_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = GERMAN_WORD_TOKEN_RE.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (offset >= start && offset <= end) {
      const r = document.createRange();
      r.setStart(node, start);
      r.setEnd(node, end);
      return r;
    }
  }
  return null;
}

export function isArticleLearningHighlightTarget(el: Element | null): boolean {
  if (!el) return false;
  return Boolean(
    el.closest("button[data-occurrence-id]") ||
      el.closest('[role="button"][data-occurrence-id]'),
  );
}
