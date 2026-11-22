/**
 * iPhone 分享保存的服务端逻辑（/api/clip 调用；依赖可注入，便于单元测试）。
 *
 * 两种请求：
 * - Safari 分享：快捷指令在页面上运行与电脑插件相同的提取脚本，传来 { source: "page", title, url, rawText, signals, … }
 * - Chrome / 其他 App 分享：只有网址 → { url } 或 { text }（从文本里找第一个网址），由服务器按网址抓取
 *
 * 判断完整 → 存为文章；不完整或失败 → 放入手机收件箱（保留标题、链接、已提取部分），并返回给快捷指令显示的提示。
 */
import {
  assessCompleteness,
  normalizeClipSignals,
  type ClipVia,
  type CompletenessReason,
  type CompletenessResult,
} from "@/lib/clip/completeness";
import { CLIP_SCRIPT_VERSION } from "@/lib/clip/shortcutScript.generated";
import type { ImportedArticlePreview } from "@/lib/import/importFromUrl";
import { UrlImportError } from "@/lib/import/importFromUrl";
import { isBadImportPluginTitle } from "@/lib/import/visibleArticleExtractLogic";
import { detectArticleLanguage } from "@/lib/language/detectArticleLanguage";
import type { LearningLanguage } from "@/lib/language/learningLanguage";
import { parseArticleFromRawInput } from "@/lib/text/parseArticleFromRaw";

export type RpcResult = { data: unknown; error: { code?: string; message?: string } | null };

export type ClipDeps = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;
  importFromUrl: (url: string) => Promise<ImportedArticlePreview>;
};

export type ClipResponse = {
  ok: boolean;
  /** 给快捷指令「显示通知」用的一句话 */
  message: string;
  saved?: "article" | "inbox";
  status?: CompletenessResult["status"];
  title?: string;
  wordCount?: number;
  reasons?: CompletenessReason[];
  articleId?: string;
};

type Candidate = {
  title: string;
  url: string;
  sourceName: string;
  publishedAtText: string;
  text: string;
  via: ClipVia;
  completeness: CompletenessResult;
  languageHint: LearningLanguage | null;
};

const MAX_RAW_CHARS = 400_000;

function str(v: unknown, max = 5000): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function findFirstUrl(text: string): string {
  const m = text.match(/https?:\/\/[^\s<>"'）)\]]+/i);
  return m ? m[0].replace(/[.,;:!?»«]+$/, "") : "";
}

function chooseTitle(parsedTitle: string | null | undefined, pageTitle: string): string {
  const parsed = parsedTitle?.trim() ?? "";
  const page = pageTitle.trim();
  if (!page || isBadImportPluginTitle(page)) return parsed;
  if (!parsed) return page;
  if (page.length >= parsed.length + 12) return page;
  return parsed;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function candidateFromPage(body: Record<string, unknown>): Candidate {
  const rawText = typeof body.rawText === "string" ? body.rawText.slice(0, MAX_RAW_CHARS) : "";
  const parsed = rawText.trim() ? parseArticleFromRawInput(rawText) : null;
  const text = parsed?.cleanedText ?? "";
  const pageLanguage = str(body.pageLanguage, 20).toLowerCase();
  return {
    title: chooseTitle(parsed?.suggestedTitle, str(body.title, 500)),
    url: str(body.url, 2000),
    sourceName: str(body.sourceName, 200),
    publishedAtText: str(body.publishedAtText, 200) || parsed?.publishedAtLine || "",
    text,
    via: "page",
    completeness: assessCompleteness({
      text,
      via: "page",
      signals: normalizeClipSignals(body.signals),
    }),
    languageHint: pageLanguage.startsWith("en") ? "en" : pageLanguage.startsWith("de") ? "de" : null,
  };
}

async function candidateFromServer(url: string, deps: ClipDeps): Promise<Candidate> {
  try {
    const a = await deps.importFromUrl(url);
    return {
      title: a.title,
      url: a.source_url || url,
      sourceName: a.source_name,
      publishedAtText: a.published_at_text,
      text: a.cleaned_text,
      via: "server",
      completeness: assessCompleteness({ text: a.cleaned_text, via: "server", signals: a.signals }),
      languageHint: null,
    };
  } catch (e) {
    const meta = e instanceof UrlImportError ? e.meta : undefined;
    const message =
      e instanceof Error && e.message ? e.message : "服务器没能打开这个网址。";
    const partial = meta?.partial_text?.trim() ?? "";
    const base = assessCompleteness({ text: partial, via: "server" });
    return {
      title: meta?.title || "",
      url,
      sourceName: meta?.source_name || hostOf(url),
      publishedAtText: meta?.published_at_text || "",
      text: partial,
      via: "server",
      completeness: {
        ...base,
        status: "failed",
        reasons: [{ code: "no_body", message: `服务器抓取失败：${message}` }],
      },
      languageHint: null,
    };
  }
}

function pickLanguage(c: Candidate): LearningLanguage {
  return detectArticleLanguage(c.text).language ?? c.languageHint ?? "de";
}

function hintFor(c: Candidate): string {
  const codes = new Set(c.completeness.reasons.map((r) => r.code));
  if (c.via === "server") {
    return "从 Chrome 或邮件 App 分享只能传网址；付费或需登录的文章，请在 Safari 打开（并登录该网站）后再分享。";
  }
  if (codes.has("collapsed_more")) return "请先在页面上点开全文，再重新分享。";
  if (codes.has("paywall_visible") || codes.has("paywall_declared") || codes.has("paywall_text")) {
    return "如果你已订阅，请先在 Safari 里登录该网站，再重新分享。";
  }
  return "可以打开收件箱补全正文后保存。";
}

function isMissingFunction(err: { code?: string; message?: string }): boolean {
  return (
    err.code === "PGRST202" ||
    err.code === "42883" ||
    err.code === "42P01" ||
    /could not find the function|does not exist/i.test(err.message ?? "")
  );
}

const INVALID_TOKEN_MESSAGE =
  "导入令牌无效或已作废：请到 App「设置 → iPhone 分享保存」重新生成令牌，并替换快捷指令里的令牌。";
const MIGRATION_MESSAGE =
  "服务器数据库还没有开启 iPhone 保存功能（需执行 supabase/fixes/013_iphone_clip.sql）。";

export async function handleClipRequest(
  token: string | null,
  body: unknown,
  deps: ClipDeps,
): Promise<ClipResponse> {
  if (!token) {
    return { ok: false, message: "缺少导入令牌：请在快捷指令的请求头里填写 Authorization: Bearer 令牌。" };
  }
  if (!body || typeof body !== "object") {
    return { ok: false, message: "没有收到网页内容：请从 Safari 或 Chrome 的「分享」里运行这个快捷指令。" };
  }
  const b = body as Record<string, unknown>;

  /** 先验令牌，再抓网页（避免无令牌请求让服务器代抓任意网址） */
  const resolved = await deps.rpc("clip_resolve_token", { p_token: token });
  if (resolved.error) {
    return {
      ok: false,
      message: isMissingFunction(resolved.error) ? MIGRATION_MESSAGE : `验证令牌失败：${resolved.error.message ?? "未知错误"}`,
    };
  }
  if (!resolved.data) return { ok: false, message: INVALID_TOKEN_MESSAGE };

  let candidate: Candidate;
  if (b.source === "page") {
    candidate = candidateFromPage(b);
    /** 页面上几乎没提取到正文（版式特殊、脚本出错）：再让服务器按网址试一次 */
    if (candidate.completeness.status === "failed" && candidate.url) {
      const fromServer = await candidateFromServer(candidate.url, deps);
      if (fromServer.completeness.wordCount > candidate.completeness.wordCount) {
        candidate = { ...fromServer, title: fromServer.title || candidate.title };
      }
    }
  } else {
    const url = str(b.url, 2000) || findFirstUrl(str(b.text, 20000));
    if (!url) {
      return { ok: false, message: "没有找到网址：请在文章页面点「分享」，再选这个快捷指令。" };
    }
    candidate = await candidateFromServer(url, deps);
  }

  const title = candidate.title || hostOf(candidate.url) || "未命名文章";
  const { completeness } = candidate;
  const isFull = completeness.status === "full";

  const ingest = await deps.rpc("clip_ingest", {
    p_token: token,
    p_kind: isFull ? "article" : "inbox",
    p_title: title,
    p_url: candidate.url,
    p_source_name: candidate.sourceName,
    p_published_at_text: candidate.publishedAtText,
    p_text: candidate.text,
    p_language: pickLanguage(candidate),
    p_status: completeness.status === "failed" ? "failed" : "partial",
    p_reasons: completeness.reasons,
    p_via: candidate.via,
    p_word_count: completeness.wordCount,
  });
  if (ingest.error) {
    if (ingest.error.code === "28000") return { ok: false, message: INVALID_TOKEN_MESSAGE };
    return {
      ok: false,
      message: isMissingFunction(ingest.error)
        ? MIGRATION_MESSAGE
        : `保存失败：${ingest.error.message ?? "未知错误"}`,
    };
  }
  const data = (ingest.data ?? {}) as { kind?: string; id?: string };

  const outdated =
    b.source === "page" && str(b.scriptVersion, 40) && str(b.scriptVersion, 40) !== CLIP_SCRIPT_VERSION
      ? "（提示：提取脚本已有新版，建议到 App「设置 → iPhone 分享保存」重新复制到快捷指令。）"
      : "";

  if (isFull) {
    return {
      ok: true,
      saved: "article",
      status: "full",
      title,
      wordCount: completeness.wordCount,
      reasons: [],
      articleId: typeof data.id === "string" ? data.id : undefined,
      message: `已保存全文：《${title}》（${completeness.wordCount} 词）${outdated}`,
    };
  }

  const reason = completeness.reasons[0]?.message ?? "正文可能不完整。";
  const head =
    completeness.status === "failed"
      ? `没能提取正文：${reason}已把标题和链接放进「手机收件箱」，没有存为文章。`
      : `没有存为文章：${reason}已把标题、链接和已提取的 ${completeness.wordCount} 词放进「手机收件箱」。`;
  return {
    ok: true,
    saved: "inbox",
    status: completeness.status,
    title,
    wordCount: completeness.wordCount,
    reasons: completeness.reasons,
    message: `${head}${hintFor(candidate)}${outdated}`,
  };
}
