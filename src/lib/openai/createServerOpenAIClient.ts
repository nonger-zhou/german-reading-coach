import * as dns from "node:dns";
import OpenAI from "openai";
import { Agent, ProxyAgent, fetch as undiciFetch } from "undici";
import type { Dispatcher } from "undici";

/**
 * 与链接导入一致：部分 Windows 环境对 api.openai.com 走 IPv6 或 Node 默认 TLS 链会长时间失败或握手错误；
 * 使用 undici + IPv4 更接近稳定连接。
 */
function mayRelaxOpenAiTls(): boolean {
  return (
    process.env.ALLOW_INSECURE_OPENAI_TLS === "1" ||
    (process.env.NODE_ENV !== "production" &&
      process.env.ALLOW_INSECURE_IMPORT_TLS === "1")
  );
}

/** 仅用于 OpenAI：优先 OPENAI_HTTPS_PROXY，否则遵循常见 HTTPS_PROXY（与 curl/git 一致）。 */
function openAiProxyUrl(): string | null {
  const u =
    process.env.OPENAI_HTTPS_PROXY?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.https_proxy?.trim();
  return u || null;
}

let cachedDispatcher: { key: string; dispatcher: Dispatcher } | null = null;

function getUndiciDispatcherForOpenAI(): Dispatcher {
  const relax = mayRelaxOpenAiTls();
  const proxy = openAiProxyUrl();
  const key = `${relax}:${proxy ?? "direct"}`;
  if (cachedDispatcher?.key === key) {
    return cachedDispatcher.dispatcher;
  }
  const connectOpts = {
    family: 4 as const,
    ...(relax ? { rejectUnauthorized: false as const } : {}),
  };
  const dispatcher = proxy
    ? new ProxyAgent({
        uri: proxy,
        requestTls: connectOpts,
      })
    : new Agent({ connect: connectOpts });
  cachedDispatcher = { key, dispatcher };
  return dispatcher;
}

/**
 * 供 OpenAI SDK `fetch` 使用：undici（IPv4 + 可选代理 + 可选 TLS 放宽），失败时再试 Node 原生 `fetch`。
 */
export async function openaiCompatibleFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (typeof dns.setDefaultResultOrder === "function") {
    dns.setDefaultResultOrder("ipv4first");
  }
  const dispatcher = getUndiciDispatcherForOpenAI();
  const undiciInit = {
    ...init,
    dispatcher,
  } as Parameters<typeof undiciFetch>[1];
  try {
    return (await undiciFetch(
      input as Parameters<typeof undiciFetch>[0],
      undiciInit,
    )) as unknown as Response;
  } catch (undiciErr) {
    try {
      return await globalThis.fetch(input as RequestInfo, init);
    } catch {
      throw undiciErr;
    }
  }
}

export type CreateServerOpenAIClientParams = {
  apiKey: string;
  timeout: number;
  maxRetries?: number;
};

export function createServerOpenAIClient({
  apiKey,
  timeout,
  maxRetries = 2,
}: CreateServerOpenAIClientParams): OpenAI {
  if (typeof dns.setDefaultResultOrder === "function") {
    dns.setDefaultResultOrder("ipv4first");
  }
  return new OpenAI({
    apiKey,
    timeout,
    maxRetries,
    fetch: openaiCompatibleFetch as typeof fetch,
  });
}

/** 把 SDK 的「Connection error.」展开为含 TLS/DNS/代理等底层原因，便于用户与本机网络对照。 */
export function formatOpenAIRouteErrorMessage(e: unknown): string {
  if (!(e instanceof Error)) {
    return String(e);
  }
  const segments: string[] = [];
  let cur: unknown = e;
  for (let depth = 0; depth < 5 && cur != null; depth++) {
    if (cur instanceof Error) {
      const m = (cur.message || "").trim();
      if (m && segments.at(-1) !== m) segments.push(m);
      cur = cur.cause;
    } else if (typeof cur === "string") {
      const m = cur.trim();
      if (m && segments.at(-1) !== m) segments.push(m);
      break;
    } else {
      break;
    }
  }
  let msg = segments.join(" — ");
  if (!msg) msg = "OpenAI 调用失败";
  if (/fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(msg) && !openAiProxyUrl()) {
    msg +=
      "。若无法直连 api.openai.com，可在 .env.local 设置 OPENAI_HTTPS_PROXY（或 HTTPS_PROXY）为本地可用代理后重启 dev。";
  }
  return msg;
}
