/**
 * 判断提取到的正文是否完整（iPhone 分享保存与链接导入共用）。
 *
 * 结果三种：
 * - full：没有发现不完整的迹象 → 可以直接保存为文章
 * - partial：发现付费墙截断、正文偏短、页面有折叠等迹象 → 不当作全文
 * - failed：几乎没有正文
 *
 * 线索来源：
 * - via = "page"：iPhone Safari 在用户当前看到的页面上提取（用户可能已登录，能看到全文）
 * - via = "server"：服务器按网址抓取（没有用户的登录状态，付费文章通常只有开头）
 */

export type ClipVia = "page" | "server";

export type ClipSignals = {
  isAccessibleForFree?: boolean | null;
  declaredWordCount?: number | null;
  contentTier?: string | null;
  paywallVisible?: boolean | null;
  /** 仅服务器抓取：HTML 中有付费墙容器（不一定可见，弱线索） */
  paywallMarkup?: boolean | null;
  collapsedMoreButton?: boolean | null;
};

export type CompletenessReasonCode =
  | "no_body"
  | "paywall_visible"
  | "paywall_declared"
  | "paywall_text"
  | "word_count_mismatch"
  | "collapsed_more"
  | "too_short";

export type CompletenessReason = { code: CompletenessReasonCode; message: string };

export type CompletenessStatus = "full" | "partial" | "failed";

export type CompletenessResult = {
  status: CompletenessStatus;
  reasons: CompletenessReason[];
  wordCount: number;
  charCount: number;
};

/** 少于这么多字符视为没有提取到正文 */
export const MIN_BODY_CHARS = 120;
/** 少于这么多词视为偏短（短讯可能正常，但不默认当全文） */
export const SHORT_BODY_WORDS = 120;

/** 正文结尾出现这些话，多半是付费墙 / 登录墙的提示，而不是文章内容 */
const PAYWALL_TAIL_PATTERNS: RegExp[] = [
  /jetzt (?:\S+ )?abonnieren/i,
  /abo abschlie(?:ss|ß)en/i,
  /weiterlesen mit (?:\S+ ){0,3}(?:abo|plus|digital)/i,
  /(?:lesen sie|um) (?:\S+ ){0,6}weiter(?:zu)?lesen/i,
  /um weiterzulesen/i,
  /f(?:ü|ue)r abonnent(?:en|innen)/i,
  /exklusiv f(?:ü|ue)r (?:\S+ )?(?:abonnent|plus|abo)/i,
  /dieser artikel ist (?:nur )?f(?:ü|ue)r/i,
  /bereits abonnent/i,
  /kostenlos registrieren/i,
  /jetzt registrieren/i,
  /melden sie sich an,? um/i,
  /subscribe (?:now )?to (?:continue|read|keep reading)/i,
  /to continue reading/i,
  /continue reading with/i,
  /(?:for|available to) subscribers only/i,
  /already a subscriber/i,
  /(?:sign|log) in to (?:continue|read|keep reading)/i,
  /create a free account to/i,
  /this article is for (?:paid )?subscribers/i,
];

export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

function tailHasPaywallText(text: string): boolean {
  const tail = text.slice(-700);
  return PAYWALL_TAIL_PATTERNS.some((re) => re.test(tail));
}

export function assessCompleteness(input: {
  text: string;
  via: ClipVia;
  signals?: ClipSignals | null;
}): CompletenessResult {
  const text = (input.text ?? "").trim();
  const charCount = text.length;
  const wordCount = countWords(text);
  const s = input.signals ?? {};
  const reasons: CompletenessReason[] = [];

  if (charCount < MIN_BODY_CHARS) {
    return {
      status: "failed",
      reasons: [{ code: "no_body", message: "没有提取到正文。" }],
      wordCount,
      charCount,
    };
  }

  const declared =
    typeof s.declaredWordCount === "number" && s.declaredWordCount > 0
      ? s.declaredWordCount
      : null;
  /** 网页声明的词数足够大、而提取到的明显少 → 截断 */
  const wordCountShort = declared !== null && declared >= 150 && wordCount < declared * 0.7;
  /** 提取到的词数接近声明词数 → 视为完整（可覆盖「付费内容」等声明） */
  const wordCountConfirmsFull = declared !== null && wordCount >= declared * 0.85;

  if (s.paywallVisible) {
    reasons.push({
      code: "paywall_visible",
      message: "页面上显示了付费墙或登录提示。",
    });
  }

  const tier = (s.contentTier ?? "").toLowerCase();
  const declaredPaid = s.isAccessibleForFree === false || tier === "locked" || tier === "metered";
  if (declaredPaid && !wordCountConfirmsFull) {
    if (input.via === "server") {
      /** 服务器没有用户的登录状态：付费文章抓到的几乎都是开头 */
      reasons.push({
        code: "paywall_declared",
        message: "网页标明这是付费内容，服务器按网址只能抓到公开部分。",
      });
    } else if (wordCount < 300) {
      /** 手机页面上提取：可能已登录看到全文；只在正文明显偏短时才判定 */
      reasons.push({
        code: "paywall_declared",
        message: "网页标明这是付费内容，而提取到的正文很短。",
      });
    }
  }

  if (input.via === "server" && s.paywallMarkup && !declaredPaid && wordCount < 400 && !wordCountConfirmsFull) {
    reasons.push({
      code: "paywall_declared",
      message: "网页含付费墙模块，而抓到的正文偏短。",
    });
  }

  if (tailHasPaywallText(text)) {
    reasons.push({
      code: "paywall_text",
      message: "正文结尾是订阅 / 登录提示，后文可能被截断。",
    });
  }

  if (wordCountShort) {
    reasons.push({
      code: "word_count_mismatch",
      message: `网页标明约 ${declared} 词，只提取到 ${wordCount} 词。`,
    });
  }

  if (s.collapsedMoreButton && !wordCountConfirmsFull) {
    reasons.push({
      code: "collapsed_more",
      message: "页面上还有「Weiterlesen / 展开全文」按钮，后半篇可能没有展开。",
    });
  }

  if (wordCount < SHORT_BODY_WORDS && reasons.length === 0) {
    reasons.push({
      code: "too_short",
      message: `正文只有 ${wordCount} 词，可能没有提取完整。`,
    });
  }

  /** 去掉重复代码（例如两条 paywall_declared） */
  const unique = reasons.filter(
    (r, i) => reasons.findIndex((x) => x.code === r.code) === i,
  );

  return {
    status: unique.length ? "partial" : "full",
    reasons: unique,
    wordCount,
    charCount,
  };
}

/** 从任意输入规范出 ClipSignals（来自快捷指令的 JSON，不可信） */
export function normalizeClipSignals(raw: unknown): ClipSignals | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const bool = (v: unknown) => (typeof v === "boolean" ? v : null);
  const n = typeof r.declaredWordCount === "number" ? r.declaredWordCount : Number(r.declaredWordCount);
  return {
    isAccessibleForFree: bool(r.isAccessibleForFree),
    declaredWordCount: Number.isFinite(n) && n > 0 ? Math.round(n) : null,
    contentTier: typeof r.contentTier === "string" ? r.contentTier.slice(0, 20) : null,
    paywallVisible: bool(r.paywallVisible),
    collapsedMoreButton: bool(r.collapsedMoreButton),
  };
}
