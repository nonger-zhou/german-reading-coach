import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 读取浏览器端公开的 Supabase 环境变量。
 * 必须使用对 `process.env.NEXT_PUBLIC_*` 的**静态**属性访问，否则 Next.js 不会在客户端 bundle 中内联值（动态 `process.env[name]` 会得到 undefined）。
 */
export function readPublicSupabaseEnv(): {
  urlConfigured: boolean;
  anonKeyConfigured: boolean;
} {
  const urlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const keyRaw = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const url =
    typeof urlRaw === "string" ? urlRaw.trim() : "";
  const anonKey =
    typeof keyRaw === "string" ? keyRaw.trim() : "";
  return {
    urlConfigured: url.length > 0,
    anonKeyConfigured: anonKey.length > 0,
  };
}

function readUrlAndKey(): { url: string; anonKey: string } {
  const urlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const keyRaw = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const url =
    typeof urlRaw === "string" ? urlRaw.trim() : "";
  const anonKey =
    typeof keyRaw === "string" ? keyRaw.trim() : "";
  return { url, anonKey };
}

/**
 * 浏览器端 Supabase 客户端（使用 anon key）。
 * 须在用户手势或事件中调用；环境变量缺失时会抛出带说明的 Error。
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  const { url, anonKey } = readUrlAndKey();

  console.log("Supabase URL configured:", url.length > 0);
  console.log("Supabase anon key configured:", anonKey.length > 0);

  if (!url) {
    throw new Error(
      `[Supabase] NEXT_PUBLIC_SUPABASE_URL 缺失或为空。当前状态：URL missing · anon key ${anonKey.length > 0 ? "configured" : "missing"}。请在项目根目录配置 .env.local（参考 .env.example），并重启开发服务器（npm run dev）。`,
    );
  }
  if (!anonKey) {
    throw new Error(
      `[Supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY 缺失或为空。当前状态：URL configured · key missing。请在项目根目录配置 .env.local（参考 .env.example），并重启开发服务器（npm run dev）。`,
    );
  }

  return createClient(url, anonKey, {
    auth: {
      /** 邮件重置密码等链接会把 token 放在 URL hash 里，需从地址栏恢复会话 */
      detectSessionInUrl: true,
    },
  });
}

let browserClient: SupabaseClient | null = null;

/** 单例，便于在多个客户端组件中复用同一实例。 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createSupabaseBrowserClient();
  }
  return browserClient;
}
