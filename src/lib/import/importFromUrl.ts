import * as dns from "node:dns";
import * as http from "node:http";
import * as https from "node:https";
import { load } from "cheerio";
import { parseArticleFromRawInput } from "@/lib/text/parseArticleFromRaw";

export type ImportedArticlePreview = {
  title: string;
  source_url: string;
  source_name: string;
  published_at_text: string;
  cleaned_text: string;
  raw_text?: string;
  excerpt?: string;
};

type ImportErrCode =
  | "invalid_url"
  | "unsupported_protocol"
  | "fetch_failed"
  | "tls_verify_failed"
  | "timeout"
  | "blocked"
  | "parse_failed"
  | "content_too_short";

export class UrlImportError extends Error {
  code: ImportErrCode;
  constructor(message: string, code: ImportErrCode) {
    super(message);
    this.code = code;
  }
}

function safeText(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function normalizeHostname(host: string): string {
  return host.replace(/^www\./i, "").trim();
}

function readMeta($: ReturnType<typeof load>, key: string): string {
  const byName = safeText($(`meta[name="${key}"]`).attr("content"));
  if (byName) return byName;
  return safeText($(`meta[property="${key}"]`).attr("content"));
}

function pickTitle($: ReturnType<typeof load>): string {
  const h1 = safeText($("h1").first().text());
  if (h1) return h1;
  const og = readMeta($, "og:title");
  if (og) return og;
  const tw = readMeta($, "twitter:title");
  if (tw) return tw;
  return safeText($("title").first().text());
}

function pickSourceName($: ReturnType<typeof load>, hostname: string): string {
  const og = readMeta($, "og:site_name");
  if (og) return og;
  const appName = readMeta($, "application-name");
  if (appName) return appName;
  return hostname;
}

function pickPublishedFromJsonLd($: ReturnType<typeof load>): string {
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    const raw = safeText($(scripts[i]).html());
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const queue = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of queue) {
        if (!item || typeof item !== "object") continue;
        const rec = item as Record<string, unknown>;
        const date = rec.datePublished;
        if (typeof date === "string" && date.trim()) {
          return date.trim();
        }
      }
    } catch {
      continue;
    }
  }
  return "";
}

function pickPublishedText($: ReturnType<typeof load>): string {
  const timeInArticle = safeText($("article time[datetime]").first().attr("datetime"));
  if (timeInArticle) return timeInArticle;
  const timeGlobal = safeText($("time[datetime]").first().attr("datetime"));
  if (timeGlobal) return timeGlobal;
  const og = readMeta($, "article:published_time");
  if (og) return og;
  const ld = pickPublishedFromJsonLd($);
  if (ld) return ld;

  const timeNodeText = safeText($("time").first().text());
  if (timeNodeText) return timeNodeText;
  const bodyText = safeText($("body").text());
  const hit = bodyText.match(
    /(Publiziert|Veröffentlicht|Published|Aktualisiert)\s*:?\s*([^\n]{6,80})/i,
  );
  if (!hit) return "";
  return safeText(hit[0]);
}

function collectParagraphs($: ReturnType<typeof load>, selector: string): string[] {
  const out: string[] = [];
  $(selector)
    .find("p")
    .each((_, p) => {
      const t = safeText($(p).text());
      if (t.length >= 30) out.push(t);
    });
  return out;
}

/** 用于导语/正文首段重复（如 20min：Lead 与紧随其后的首段几乎同义） */
function normForDedup(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function wordJaccard(a: string, b: string): number {
  const wa = normForDedup(a)
    .split(" ")
    .filter((w) => w.length >= 2);
  const wb = normForDedup(b)
    .split(" ")
    .filter((w) => w.length >= 2);
  if (wa.length === 0 || wb.length === 0) return 0;
  const setA = new Set(wa);
  const setB = new Set(wb);
  let inter = 0;
  for (const w of setA) {
    if (setB.has(w)) inter++;
  }
  const union = setA.size + setB.size - inter;
  return union ? inter / union : 0;
}

function commonPrefixLen(a: string, b: string): number {
  const na = normForDedup(a);
  const nb = normForDedup(b);
  let i = 0;
  const m = Math.min(na.length, nb.length);
  while (i < m && na[i] === nb[i]) i++;
  return i;
}

/**
 * 相邻两段是否为「同一导语的两次出现」（结构略有不同，如 zehn Sandwiches vs Sandwiches）。
 */
function paragraphsAreNearDuplicate(prev: string, cur: string): boolean {
  if (prev.length < 70 || cur.length < 70) return false;
  if (normForDedup(prev) === normForDedup(cur)) return true;
  const jac = wordJaccard(prev, cur);
  const pref = commonPrefixLen(prev, cur);
  if (jac >= 0.52 && pref >= 28) return true;
  if (jac >= 0.58) return true;
  const shorter = prev.length <= cur.length ? prev : cur;
  const longer = prev.length > cur.length ? prev : cur;
  const ns = normForDedup(shorter);
  const nl = normForDedup(longer);
  if (ns.length >= 90 && nl.includes(ns.slice(0, Math.min(100, ns.length)))) return true;
  return false;
}

/** 去掉与上一段高度雷同的段，保留较长的一段（信息更完整）。 */
function dedupeAdjacentSimilarParagraphs(paragraphs: string[]): string[] {
  if (paragraphs.length < 2) return paragraphs;
  const out: string[] = [paragraphs[0]!];
  for (let i = 1; i < paragraphs.length; i++) {
    const cur = paragraphs[i]!;
    const last = out[out.length - 1]!;
    if (paragraphsAreNearDuplicate(last, cur)) {
      if (cur.length > last.length) {
        out[out.length - 1] = cur;
      }
      continue;
    }
    out.push(cur);
  }
  return out;
}

function joinParagraphsDeduped(paragraphs: string[]): string {
  return dedupeAdjacentSimilarParagraphs(paragraphs).join("\n\n");
}

/** meta description 常与正文首段相同；再塞进 raw 会导致 parse 后重复。 */
function excerptRedundantWithBodyLead(excerpt: string, bodyText: string): boolean {
  const e = safeText(excerpt);
  if (e.length < 50) return false;
  const firstBlock = bodyText.split(/\n\s*\n/)[0]?.trim() ?? "";
  if (firstBlock.length < 60) return false;
  if (paragraphsAreNearDuplicate(e, firstBlock)) return true;
  const ne = normForDedup(e);
  const nb = normForDedup(firstBlock);
  return nb.includes(ne.slice(0, Math.min(120, ne.length)));
}

function pickBodyText($: ReturnType<typeof load>): string {
  const priorities = [
    "article",
    "main article",
    '[role="article"]',
    "main",
  ] as const;

  for (const sel of priorities) {
    const p = collectParagraphs($, sel);
    if (p.length >= 3) return joinParagraphsDeduped(p);
    const text = safeText($(sel).first().text());
    if (text.length >= 600) return text;
  }

  const generalParagraphs: string[] = [];
  $("p").each((_, p) => {
    const $p = $(p);
    if ($p.closest("header,footer,nav,aside").length > 0) return;
    const t = safeText($p.text());
    if (t.length >= 30) generalParagraphs.push(t);
  });
  if (generalParagraphs.length >= 4) return joinParagraphsDeduped(generalParagraphs);

  return safeText($("body").text());
}

/** 新闻站抓取：仅用 UA + Accept + 语言（避免多余 Sec-Fetch/sec-ch-ua 触发部分 CDN/WAF 慢响应或异常）。 */
const BROWSER_LIKE_FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "de-CH,de;q=0.9,en-US;q=0.8,en;q=0.7",
};

/** 阶段 1：建立连接并收到响应头（勿与下载 HTML 正文混用同一 Abort，否则首包已到仍可能被判超时）。 */
const IMPORT_HEADERS_PHASE_MS = 90_000;

/** 阶段 2：流式读取 `res.text()`（大页面可能再需数十秒）。 */
const IMPORT_BODY_READ_MS = 120_000;

const MAX_IMPORT_REDIRECTS = 8;

function isTlsVerificationError(e: unknown): boolean {
  if (e == null) return false;
  if (typeof e === "object" && "code" in e) {
    const code = (e as { code?: unknown }).code;
    if (
      code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
      code === "SELF_SIGNED_CERT_IN_CHAIN" ||
      code === "CERT_HAS_EXPIRED"
    ) {
      return true;
    }
  }
  if (e instanceof Error) {
    if (
      /UNABLE_TO_VERIFY|unable to verify first certificate|certificate verify failed/i.test(
        e.message,
      )
    ) {
      return true;
    }
    return isTlsVerificationError(e.cause);
  }
  return false;
}

/** 开发环境默认允许在「仅 TLS 校验失败」时用 undici 放宽校验重试；生产需显式 ALLOW_INSECURE_IMPORT_TLS=1。 */
function mayRelaxTlsForImport(): boolean {
  return (
    process.env.ALLOW_INSECURE_IMPORT_TLS === "1" ||
    process.env.NODE_ENV !== "production"
  );
}

/**
 * Windows 上 undici/fetch 对境外 HTTPS 仍可能长时间无响应；改用 Node 内置 http(s) + IPv4 优先，
 * 行为更接近系统网络栈，20min 等站更稳。
 */
async function downloadHtmlViaNodeHttp(
  startUrl: string,
  redirectsLeft = MAX_IMPORT_REDIRECTS,
): Promise<string> {
  if (redirectsLeft < 0) {
    throw new UrlImportError("重定向次数过多。", "fetch_failed");
  }
  const u = new URL(startUrl);
  const isHttps = u.protocol === "https:";
  const lib = isHttps ? https : http;
  const defaultPort = isHttps ? 443 : 80;
  const port = u.port ? Number.parseInt(u.port, 10) : defaultPort;
  const relax = mayRelaxTlsForImport();

  const headers: http.OutgoingHttpHeaders = {
    ...BROWSER_LIKE_FETCH_HEADERS,
    Host: u.host,
  };

  const hardCap = IMPORT_HEADERS_PHASE_MS + IMPORT_BODY_READ_MS;

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: u.hostname,
        port,
        path: `${u.pathname}${u.search}`,
        method: "GET",
        headers,
        agent: isHttps
          ? new https.Agent({
              rejectUnauthorized: !relax,
              family: 4,
            })
          : new http.Agent({ family: 4 }),
      },
      (incoming) => {
        const code = incoming.statusCode ?? 0;
        const rawLoc = incoming.headers.location;
        const loc =
          typeof rawLoc === "string"
            ? rawLoc
            : Array.isArray(rawLoc)
              ? rawLoc[0]
              : undefined;
        if (code >= 300 && code < 400 && loc) {
          incoming.resume();
          const nextUrl = new URL(loc, startUrl).toString();
          void downloadHtmlViaNodeHttp(nextUrl, redirectsLeft - 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (code < 200 || code >= 300) {
          incoming.resume();
          reject(
            new UrlImportError(
              `网站返回异常状态：${code}。`,
              code === 403 || code === 401 ? "blocked" : "fetch_failed",
            ),
          );
          return;
        }

        const ctRaw = incoming.headers["content-type"];
        const ct =
          typeof ctRaw === "string"
            ? ctRaw
            : Array.isArray(ctRaw)
              ? (ctRaw[0] ?? "")
              : "";
        if (!ct.toLowerCase().includes("text/html")) {
          incoming.resume();
          reject(
            new UrlImportError(
              "该链接返回的不是可解析的网页 HTML。",
              "parse_failed",
            ),
          );
          return;
        }

        const chunks: Buffer[] = [];
        incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
        incoming.on("end", () => {
          resolve(Buffer.concat(chunks).toString("utf8"));
        });
        incoming.on("error", (err) => {
          reject(
            new UrlImportError(
              err instanceof Error ? err.message : String(err),
              "fetch_failed",
            ),
          );
        });
      },
    );

    req.setTimeout(hardCap, () => {
      req.destroy();
      reject(
        new UrlImportError("请求超时，请稍后重试或改用手动粘贴。", "timeout"),
      );
    });
    req.on("error", (err) => {
      reject(
        new UrlImportError(`连接失败：${err.message}`, "fetch_failed"),
      );
    });
    req.end();
  });
}

async function downloadHtmlViaUndiciPipeline(url: string): Promise<string> {
  const fetchController = new AbortController();
  const fetchTimer = setTimeout(
    () => fetchController.abort(),
    IMPORT_HEADERS_PHASE_MS,
  );
  try {
    const res = await fetchHtmlForImport(url, fetchController.signal);
    clearTimeout(fetchTimer);

    if (!res.ok) {
      throw new UrlImportError(
        `网站返回异常状态：${res.status}。`,
        res.status === 403 || res.status === 401 ? "blocked" : "fetch_failed",
      );
    }
    const ctype = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!ctype.includes("text/html")) {
      throw new UrlImportError("该链接返回的不是可解析的网页 HTML。", "parse_failed");
    }

    return await new Promise<string>((resolve, reject) => {
      const bodyTimer = setTimeout(() => {
        reject(
          new UrlImportError(
            "下载正文超时，请稍后重试或改用手动粘贴。",
            "timeout",
          ),
        );
      }, IMPORT_BODY_READ_MS);
      void res
        .text()
        .then((t) => {
          clearTimeout(bodyTimer);
          resolve(t);
        })
        .catch((err: unknown) => {
          clearTimeout(bodyTimer);
          reject(err);
        });
    });
  } catch (e) {
    clearTimeout(fetchTimer);
    if (e instanceof UrlImportError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new UrlImportError(
        "连接或等待响应超时，请稍后重试或改用手动粘贴。",
        "timeout",
      );
    }
    throw new UrlImportError("网站无法访问，或该网站可能阻止抓取。", "fetch_failed");
  }
}

async function fetchHtmlWithUndiciInsecure(
  url: string,
  signal: AbortSignal,
): Promise<globalThis.Response> {
  const { Agent, fetch: undiciFetch } = await import("undici");
  const agent = new Agent({
    connect: { rejectUnauthorized: false },
    headersTimeout: IMPORT_HEADERS_PHASE_MS,
    bodyTimeout: IMPORT_BODY_READ_MS,
  });
  try {
    const r = await undiciFetch(url, {
      method: "GET",
      redirect: "follow",
      signal,
      headers: BROWSER_LIKE_FETCH_HEADERS,
      dispatcher: agent,
    });
    return r as unknown as globalThis.Response;
  } finally {
    await agent.close();
  }
}

/**
 * 本地开发：部分 Windows 下 Node 原生 fetch 对境外 HTTPS 会长时间挂起，耗尽 Abort 后表现为「抓取超时」。
 * 故在非 production 且 URL 为 https 时，直接使用 undici 拉取（connect.rejectUnauthorized:false），与浏览器侧「能打开」一致；生产环境仍先用原生 fetch，仅在 TLS 报错时回退 undici（若允许）。
 */
async function fetchHtmlForImport(
  url: string,
  signal: AbortSignal,
): Promise<globalThis.Response> {
  const init: RequestInit = {
    method: "GET",
    redirect: "follow",
    signal,
    headers: BROWSER_LIKE_FETCH_HEADERS,
  };

  if (mayRelaxTlsForImport() && url.startsWith("https://")) {
    return fetchHtmlWithUndiciInsecure(url, signal);
  }

  try {
    return await fetch(url, init);
  } catch (e) {
    if (!isTlsVerificationError(e)) throw e;

    if (!mayRelaxTlsForImport()) {
      throw new UrlImportError(
        "HTTPS 证书校验失败。若部署在生产环境，请检查 NODE_EXTRA_CA_CERTS 或网络代理证书；也可改用手动粘贴正文。",
        "tls_verify_failed",
      );
    }

    return fetchHtmlWithUndiciInsecure(url, signal);
  }
}

function buildRawInputForCleaner(params: {
  title: string;
  bodyText: string;
  excerpt: string;
  publishedAt: string;
}): string {
  const lines: string[] = [];
  if (params.title) lines.push(params.title);
  if (params.excerpt) lines.push(params.excerpt);
  if (params.publishedAt) lines.push(`Published: ${params.publishedAt}`);
  lines.push(params.bodyText);
  return lines.filter(Boolean).join("\n\n");
}

export async function importArticleFromUrl(rawUrl: string): Promise<ImportedArticlePreview> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new UrlImportError("URL 无效，请输入完整链接。", "invalid_url");
  }

  const protocol = parsedUrl.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    throw new UrlImportError("仅支持 http / https 链接。", "unsupported_protocol");
  }

  if (typeof dns.setDefaultResultOrder === "function") {
    dns.setDefaultResultOrder("ipv4first");
  }

  const urlStr = parsedUrl.toString();
  let html: string;
  try {
    html = await downloadHtmlViaNodeHttp(urlStr);
  } catch (e) {
    const retry =
      e instanceof UrlImportError &&
      (e.code === "timeout" || e.code === "fetch_failed");
    if (!retry) throw e;
    html = await downloadHtmlViaUndiciPipeline(urlStr);
  }

  const $ = load(html);
  const title = pickTitle($);
  const sourceName = pickSourceName($, normalizeHostname(parsedUrl.hostname));
  const publishedAtText = pickPublishedText($);
  const excerptRaw = readMeta($, "description") || readMeta($, "og:description");
  const bodyText = pickBodyText($);
  if (!bodyText || bodyText.length < 120) {
    throw new UrlImportError(
      "无法提取正文，或内容过短。该网站可能阻止抓取。",
      "content_too_short",
    );
  }

  const excerpt = excerptRedundantWithBodyLead(excerptRaw, bodyText)
    ? ""
    : excerptRaw;

  const rawForCleaner = buildRawInputForCleaner({
    title,
    bodyText,
    excerpt,
    publishedAt: publishedAtText,
  });
  const parsed = parseArticleFromRawInput(rawForCleaner);
  if (!parsed.cleanedText || parsed.cleanedText.trim().length < 120) {
    throw new UrlImportError("正文清理后内容过短，无法导入。", "content_too_short");
  }

  return {
    title: title || parsed.suggestedTitle || "未命名文章",
    source_url: parsedUrl.toString(),
    source_name: sourceName,
    published_at_text: publishedAtText || parsed.publishedAtLine || "",
    cleaned_text: parsed.cleanedText,
    raw_text: rawForCleaner,
    excerpt: safeText(excerptRaw) || undefined,
  };
}
