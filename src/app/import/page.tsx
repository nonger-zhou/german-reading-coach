"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { GermanLevelSelect } from "@/components/GermanLevelSelect";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import {
  buildArticleInsertRow,
  emptyToNull,
} from "@/lib/supabase/articles";
import { ensureUserProfile } from "@/lib/supabase/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatSupabaseOrUnknownError } from "@/lib/supabase/errors";
import { useAuthEntryHrefs } from "@/lib/auth/use-auth-entry-hrefs";
import { parseArticleFromRawInput } from "@/lib/text/parseArticleFromRaw";
import type { CefrLevel } from "@/lib/types";

type ImportMode = "paste" | "url";
type UrlImportUiError = { message: string; code: string | null };
type ExternalImportDraftPayload = {
  title?: unknown;
  url?: unknown;
  sourceName?: unknown;
  source_name?: unknown;
  publishedAtText?: unknown;
  published_at_text?: unknown;
  rawText?: unknown;
  text?: unknown;
};

const IMPORT_DRAFT_MESSAGE_TYPE = "german-reading-coach:import-draft";
const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

function normalizeCefrLevel(value: string | null | undefined): CefrLevel {
  return LEVELS.includes(value as CefrLevel) ? (value as CefrLevel) : "B1";
}

function draftString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function chooseDraftTitle(
  parsedTitle: string | null | undefined,
  pluginTitle: string,
): string {
  const parsed = parsedTitle?.trim() ?? "";
  const plugin = pluginTitle.trim();
  if (!plugin) return parsed;
  if (isReasonablePluginTitle(plugin)) return plugin;
  if (!parsed) return plugin;
  if (plugin.length >= parsed.length + 12) return plugin;
  return parsed;
}

function isReasonablePluginTitle(title: string): boolean {
  if (title.length < 20 || title.length > 260) return false;
  if (/^\s*(Startseite|Home)\s*[|›>]/i.test(title)) return false;
  const separatorCount = (title.match(/[|›>]/g) || []).length;
  if (separatorCount >= 2 && title.length < 160) return false;
  return /[A-Za-zÄÖÜäöüß]/.test(title);
}

function ImportPageContent() {
  const router = useRouter();
  const { loginHref } = useAuthEntryHrefs();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [publishedAtText, setPublishedAtText] = useState("");
  const [rawPastedText, setRawPastedText] = useState("");
  const [cleanedText, setCleanedText] = useState("");
  const [mode, setMode] = useState<ImportMode>("url");
  const [level, setLevel] = useState<CefrLevel>("B1");
  const [saving, setSaving] = useState(false);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [readingClipboard, setReadingClipboard] = useState(false);
  const [urlImportError, setUrlImportError] = useState<UrlImportUiError | null>(null);
  const [clipboardMessage, setClipboardMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const defaultLevelLoadedForUserRef = useRef<string | null>(null);
  const importedDraftIdsRef = useRef<Set<string>>(new Set());

  const refreshSession = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    setSession(s);
  }, []);

  useEffect(() => {
    void refreshSession();
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshSession();
    });
    return () => subscription.unsubscribe();
  }, [refreshSession]);

  useEffect(() => {
    if (session === undefined) {
      return;
    }
    if (!session?.user) {
      defaultLevelLoadedForUserRef.current = null;
      setLevel("B1");
      return;
    }
    if (defaultLevelLoadedForUserRef.current === session.user.id) {
      return;
    }

    let cancelled = false;
    defaultLevelLoadedForUserRef.current = session.user.id;

    (async () => {
      try {
        const { profile } = await ensureUserProfile(session.user);
        if (cancelled) return;
        setLevel(normalizeCefrLevel(profile.self_selected_level));
      } catch {
        if (cancelled) return;
        setLevel("B1");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const runParse = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return;
    }
    const p = parseArticleFromRawInput(raw);
    setCleanedText(p.cleanedText);
    setTitle((prev) => (prev.trim() ? prev : p.suggestedTitle ?? ""));
    setPublishedAtText((prev) =>
      prev.trim() ? prev : (p.publishedAtLine ?? ""),
    );
  }, []);

  const applyExternalImportDraft = useCallback(
    (payload: ExternalImportDraftPayload) => {
      const nextTitle = draftString(payload.title);
      const nextUrl = draftString(payload.url);
      const nextSourceName =
        draftString(payload.sourceName) || draftString(payload.source_name);
      const nextPublishedAt =
        draftString(payload.publishedAtText) ||
        draftString(payload.published_at_text);
      const nextRawText = draftString(payload.rawText) || draftString(payload.text);

      setValidationError(null);
      setSaveError(null);
      setUrlImportError(null);

      if (nextUrl) setUrl(nextUrl);
      if (nextSourceName) setSourceName(nextSourceName);
      if (nextPublishedAt) setPublishedAtText(nextPublishedAt);

      if (nextRawText) {
        setMode("paste");
        setRawPastedText(nextRawText);
        const parsed = parseArticleFromRawInput(nextRawText);
        setCleanedText(parsed.cleanedText);
        setTitle((prev) =>
          prev.trim() ? prev : chooseDraftTitle(parsed.suggestedTitle, nextTitle),
        );
        setPublishedAtText((prev) =>
          prev.trim() ? prev : nextPublishedAt || parsed.publishedAtLine || "",
        );
      } else if (nextTitle) {
        setTitle(nextTitle);
      }

      setClipboardMessage({
        tone: "success",
        text: nextRawText
          ? "已从浏览器插件导入当前页面内容，正文已填入下方编辑区。"
          : "已从浏览器插件带入文章信息。",
      });
    },
    [],
  );

  useEffect(() => {
    function onExternalImportDraft(event: MessageEvent) {
      if (event.source !== window) return;
      const data = event.data as unknown;
      if (!data || typeof data !== "object") return;
      const message = data as {
        type?: unknown;
        draftId?: unknown;
        payload?: unknown;
      };
      if (message.type !== IMPORT_DRAFT_MESSAGE_TYPE) return;
      if (!message.payload || typeof message.payload !== "object") return;

      const draftId = draftString(message.draftId);
      if (draftId) {
        if (importedDraftIdsRef.current.has(draftId)) return;
        importedDraftIdsRef.current.add(draftId);
      }

      applyExternalImportDraft(message.payload as ExternalImportDraftPayload);
    }

    window.addEventListener("message", onExternalImportDraft);
    return () => window.removeEventListener("message", onExternalImportDraft);
  }, [applyExternalImportDraft]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      runParse(rawPastedText);
    }, 400);
    return () => window.clearTimeout(id);
  }, [rawPastedText, runParse]);

  async function onReadArticleFromClipboard() {
    setValidationError(null);
    setSaveError(null);
    setUrlImportError(null);
    setClipboardMessage(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.readText !== "function"
    ) {
      setClipboardMessage({
        tone: "error",
        text: "当前浏览器不允许读取剪贴板，请手动粘贴正文。",
      });
      return;
    }

    setReadingClipboard(true);
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (!trimmed) {
        setClipboardMessage({
          tone: "error",
          text: "剪贴板为空，请先复制文章正文。",
        });
        return;
      }

      setRawPastedText(text);
      runParse(text);
      setClipboardMessage({
        tone: "success",
        text: "已从剪贴板读取正文，并已整理到下方正文编辑区。",
      });
    } catch {
      setClipboardMessage({
        tone: "error",
        text: "读取剪贴板失败，请确认浏览器权限，或手动粘贴正文。",
      });
    } finally {
      setReadingClipboard(false);
    }
  }

  function mapUrlImportError(code: string | null, fallback: string): string {
    switch (code) {
      case "invalid_url":
      case "unsupported_protocol":
        return "链接格式无效，请输入完整的 http/https 文章链接。";
      case "timeout":
        return "抓取超时，请稍后重试，或改用手动粘贴。";
      case "blocked":
        return "该站点可能拒绝抓取，或需要登录后访问。请改用手动粘贴。";
      case "tls_verify_failed":
        return "HTTPS 证书校验失败（服务器 Node 与浏览器的信任链不一致，常见于公司代理或个别站点证书链）。可在 .env.local 设置 ALLOW_INSECURE_IMPORT_TLS=1 后重启 dev（有中间人风险，仅建议在可信网络使用），或改用手动粘贴。";
      case "fetch_failed":
        return "抓取失败：该站点可能拒绝抓取或需要登录。请改用手动粘贴。";
      case "content_too_short":
      case "parse_failed":
        return "已访问页面，但无法稳定提取正文。请改用手动粘贴。";
      default:
        return fallback || "抓取失败，请稍后重试或改用手动粘贴。";
    }
  }

  async function onFetchArticleByUrl() {
    setValidationError(null);
    setSaveError(null);
    setUrlImportError(null);
    const target = url.trim();
    if (!target) {
      setUrlImportError({ message: "请先输入文章链接。", code: "missing_url" });
      return;
    }
    setFetchingUrl(true);
    try {
      const res = await fetch("/api/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!data || typeof data !== "object") {
        setUrlImportError({
          message: mapUrlImportError(null, `抓取失败（${res.status}）。`),
          code: null,
        });
        return;
      }
      const d = data as Record<string, unknown>;
      if (d.ok !== true) {
        const err = d.error as Record<string, unknown> | undefined;
        const code =
          err && typeof err.code === "string" ? err.code : null;
        const msg =
          err && typeof err.message === "string"
            ? err.message
            : `抓取失败（${res.status}）。`;
        setUrlImportError({ message: mapUrlImportError(code, msg), code });
        return;
      }
      const article = d.article as Record<string, unknown> | undefined;
      if (!article || typeof article !== "object") {
        setUrlImportError({
          message: "返回数据异常：缺少 article，请稍后重试或改用手动粘贴。",
          code: "invalid_response",
        });
        return;
      }
      const nextTitle = String(article.title ?? "").trim();
      const nextSourceUrl = String(article.source_url ?? "").trim();
      const nextSourceName = String(article.source_name ?? "").trim();
      const nextPublishedAt = String(article.published_at_text ?? "").trim();
      const nextCleanedText = String(article.cleaned_text ?? "");
      const nextRawText = String(article.raw_text ?? nextCleanedText);
      if (!nextCleanedText.trim()) {
        setUrlImportError({
          message: "抓取成功但正文为空，请换一篇文章重试，或改用手动粘贴。",
          code: "empty_content",
        });
        return;
      }

      setTitle((prev) => (prev.trim() ? prev : nextTitle));
      setUrl((prev) => (prev.trim() ? prev : nextSourceUrl));
      setSourceName((prev) => (prev.trim() ? prev : nextSourceName));
      setPublishedAtText((prev) => (prev.trim() ? prev : nextPublishedAt));
      setRawPastedText(nextRawText);
      setCleanedText(nextCleanedText);
    } catch (e: unknown) {
      setUrlImportError({
        message: mapUrlImportError(
          null,
          e instanceof Error ? e.message : "抓取失败，请稍后重试。",
        ),
        code: null,
      });
    } finally {
      setFetchingUrl(false);
    }
  }

  async function onSaveArticle() {
    setSaveError(null);
    setValidationError(null);

    if (session === undefined || session === null || !session.user) {
      setValidationError("请先登录后再保存文章。");
      return;
    }

    const titleTrim = title.trim();
    const bodyTrim = cleanedText.trim();
    if (!titleTrim) {
      setValidationError("请填写标题。");
      return;
    }
    if (!bodyTrim) {
      setValidationError("请先在正文中填写内容，或使用「从剪贴板读取」导入。");
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await ensureUserProfile(session.user);

      const row = buildArticleInsertRow({
        user_id: session.user.id,
        title: titleTrim,
        url: emptyToNull(url),
        source_name: emptyToNull(sourceName),
        original_text: bodyTrim,
        user_level_at_analysis: level,
      });

      const { data, error } = await supabase
        .from("articles")
        .insert(row)
        .select("id")
        .single();

      if (error) {
        throw error;
      }
      if (!data?.id) {
        throw new Error("保存成功但未返回文章 id");
      }

      router.push(`/articles/${data.id}`);
    } catch (e) {
      setSaveError(formatSupabaseOrUnknownError(e));
    } finally {
      setSaving(false);
    }
  }

  if (session === undefined) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <p className="text-sm text-zinc-500">加载中…</p>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            导入文章
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            登录后可保存正文到云端，并在阅读页查看。
          </p>
        </div>
        <Card className="space-y-3">
          <CardTitle className="text-base">需要登录</CardTitle>
          <CardDescription>
            保存文章到 Supabase 前，请先使用账户登录。
          </CardDescription>
          <Link
            href={loginHref}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
          >
            去登录
          </Link>
        </Card>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          演示阅读（无保存）仍可使用{" "}
          <Link href="/articles/mock" className="text-emerald-700 hover:underline dark:text-emerald-400">
            演示课文
          </Link>
          。
        </p>
      </div>
    );
  }

  const hasPaste = rawPastedText.trim().length > 0;
  const normalizeBody = (s: string) => s.replace(/\r\n/g, "\n").trim();
  const sourceDiffers =
    hasPaste && normalizeBody(rawPastedText) !== normalizeBody(cleanedText);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          导入文章
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="md:hidden">
            链接抓取，或复制后点「剪贴板」填入正文。
          </span>
          <span className="hidden md:inline">
            推荐先用链接自动抓取标题与正文；若抓取失败可切换手动粘贴。需要完整阅读演示可走{" "}
            <Link
              href="/articles/mock"
              className="text-emerald-700 hover:underline dark:text-emerald-400"
            >
              演示课文
            </Link>
            。
          </span>
        </p>
      </div>

      {validationError ? (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
          role="alert"
        >
          {validationError}
        </p>
      ) : null}

      {saveError ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          <p className="font-medium">保存失败</p>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-sans text-xs">
            {saveError}
          </pre>
          <p className="mt-2 text-xs opacity-90">
            若为权限错误，可在 Supabase 执行{" "}
            <code className="rounded bg-red-100/80 px-1 dark:bg-red-900/50">
              supabase/fixes/003_articles_grants_fix.sql
            </code>
            ；若 RLS 异常可执行{" "}
            <code className="rounded bg-red-100/80 px-1 dark:bg-red-900/50">
              004_articles_rls_fix.sql
            </code>
            。
          </p>
        </div>
      ) : null}

      <Card>
        <CardTitle className="text-base">导入方式</CardTitle>
        <CardDescription>
          <span className="md:hidden">粘贴或链接抓取后保存。</span>
          <span className="hidden md:inline">
            可选择手动粘贴正文，或先抓取链接后再确认保存。
          </span>
        </CardDescription>
        <div className="mt-3 inline-flex rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => setMode("paste")}
            className={`rounded-md px-3 py-1.5 text-sm ${
              mode === "paste"
                ? "bg-emerald-600 text-white"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            }`}
          >
            手动粘贴
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`rounded-md px-3 py-1.5 text-sm ${
              mode === "url"
                ? "bg-emerald-600 text-white"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            }`}
          >
            链接导入
          </button>
        </div>
      </Card>

      {mode === "url" ? (
        <Card>
          <CardTitle className="text-base">链接导入</CardTitle>
          <CardDescription>
            <span className="md:hidden">输入链接后点「抓取文章」。</span>
            <span className="hidden md:inline">
              在服务端抓取网页并提取标题、正文、来源与发布时间，不会调用 AI。
            </span>
          </CardDescription>
          <label className="mt-3 block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            文章链接
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className={`mt-2 w-full rounded-lg border bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500/30 focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100 ${
              mode === "url"
                ? "border-emerald-500/70 bg-emerald-50/40 dark:border-emerald-500/70 dark:bg-emerald-950/20"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          />
          {urlImportError ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300" role="alert">
              {urlImportError.message}
            </p>
          ) : null}
          <div className="mt-3">
            <Button
              type="button"
              className={
                mode === "url"
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : undefined
              }
              onClick={() => void onFetchArticleByUrl()}
              disabled={fetchingUrl}
            >
              {fetchingUrl ? "抓取中…" : "抓取文章"}
            </Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardTitle className="text-base">文章标题（可选手动覆盖）</CardTitle>
        <CardDescription>
          系统会在链接抓取成功后自动填入标题。您只在“未自动抓取到标题”或想改成自定义标题（例如中文标题）时手动填写。
        </CardDescription>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：Die Bundesregierung plant …"
          className="mt-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </Card>

      <Card>
        <CardTitle className="text-base">正文</CardTitle>
        <CardDescription>
          <span className="md:hidden">
            复制网页后点「剪贴板」填入；或抓取链接。下方选阅读水平。
          </span>
          <span className="hidden md:inline">
            保存到云端时使用此处的文本。从网页复制全文时，请优先点「从剪贴板读取」，以便自动去掉广告与多余版式；若正文已是干净稿，也可直接在此编辑或粘贴。阅读水平请在下方「本篇阅读水平」中选择。
          </span>
        </CardDescription>
        <textarea
          value={cleanedText}
          onChange={(e) => setCleanedText(e.target.value)}
          rows={12}
          placeholder={
            mode === "paste"
              ? "在此编辑正文，或使用「从剪贴板读取」导入网页全文…"
              : "链接抓取成功后，正文会出现在这里；也可直接在此编辑…"
          }
          className="mt-3 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant={mode === "paste" ? "primary" : "secondary"}
            onClick={() => void onReadArticleFromClipboard()}
            disabled={readingClipboard}
          >
            {readingClipboard ? "读取中…" : "从剪贴板读取"}
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => void onSaveArticle()}
            disabled={saving}
          >
            {saving ? "保存中…" : "保存文章"}
          </Button>
        </div>
        {clipboardMessage ? (
          <p
            className={`mt-2 text-xs ${
              clipboardMessage.tone === "success"
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-amber-700 dark:text-amber-300"
            }`}
            role={clipboardMessage.tone === "error" ? "alert" : "status"}
          >
            {clipboardMessage.text}
          </p>
        ) : null}
        {hasPaste ? (
          <details
            className={`mt-4 rounded-lg border px-3 py-2 text-sm dark:border-zinc-700 ${
              sourceDiffers
                ? "border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/25"
                : "border-zinc-200 bg-zinc-50/60 dark:border-zinc-700 dark:bg-zinc-900/40"
            }`}
          >
            <summary className="cursor-pointer font-medium text-zinc-800 dark:text-zinc-200">
              来源稿（可选）
              {sourceDiffers ? (
                <span className="ml-2 text-xs font-normal text-amber-800 dark:text-amber-200">
                  与上方正文不一致，抓取/整理后常见
                </span>
              ) : (
                <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  与正文一致时可忽略
                </span>
              )}
            </summary>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              <span className="md:hidden">原始稿，改后会同步到上方正文。</span>
              <span className="hidden md:inline">
                此处为抓取或剪贴板导入的原始文本。修改后约半秒会自动同步到上方正文；也可先改上方正文再保存。
              </span>
            </p>
            <textarea
              value={rawPastedText}
              onChange={(e) => {
                setClipboardMessage(null);
                setRawPastedText(e.target.value);
              }}
              rows={8}
              className="mt-2 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </details>
        ) : null}
      </Card>

      <Card>
        <CardTitle className="text-base">本篇阅读水平</CardTitle>
        <CardDescription>
          已自动带入设置页的默认阅读水平；这里只影响当前这篇文章。
        </CardDescription>
        <div className="mt-4">
          <GermanLevelSelect value={level} onChange={setLevel} name="import-level" />
        </div>
      </Card>

      <details className="group rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-zinc-900 marker:hidden dark:text-zinc-100 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            <span>可选信息</span>
            <span className="text-xs font-normal text-zinc-500 group-open:rotate-180 dark:text-zinc-400">
              ▼
            </span>
          </span>
        </summary>
        <div className="space-y-4 border-t border-zinc-200 px-4 pb-4 pt-3 dark:border-zinc-700">
          <div>
            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
              文章链接
            </label>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              当前手动导入时可不填。链接导入抓取成功后会自动带入。
            </p>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
              来源名称
            </label>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              可选。未来系统会尽量根据 URL 或插件自动识别来源。
            </p>
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="例如：Tagesschau"
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
              发布时间（文本）
            </label>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              仅用于预览参考；本阶段不新增发布时间数据库字段。
            </p>
            <input
              type="text"
              value={publishedAtText}
              onChange={(e) => setPublishedAtText(e.target.value)}
              placeholder="例如：2026-05-06T08:30:00Z"
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>
      </details>
    </div>
  );
}

export default function ImportPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl space-y-6">
          <p className="text-sm text-zinc-500">加载中…</p>
        </div>
      }
    >
      <ImportPageContent />
    </Suspense>
  );
}
