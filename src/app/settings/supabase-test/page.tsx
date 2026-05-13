"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import {
  getSupabaseBrowserClient,
  readPublicSupabaseEnv,
} from "@/lib/supabase/client";

/** RLS 拒绝匿名/未授权读取时，PostgREST 常返回 42501 或含 permission denied 的文案 */
function isRlsPermissionDenied(error: PostgrestError): boolean {
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "42501" ||
    msg.includes("permission denied") ||
    msg.includes("row-level security")
  );
}

export default function SupabaseTestPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"idle" | "success" | "protected" | "error">(
    "idle",
  );
  const [initMessage, setInitMessage] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  /** 与 createSupabaseBrowserClient 使用同一套静态 env 读取逻辑 */
  const envStatus = useMemo(() => readPublicSupabaseEnv(), []);

  async function handleTest() {
    setLoading(true);
    setResult("idle");
    setErrorDetail(null);
    setInitMessage(null);
    try {
      const supabase = getSupabaseBrowserClient();
      setInitMessage("Supabase client 已初始化");

      const { error } = await supabase.from("profiles").select("*").limit(1);

      if (!error) {
        setResult("success");
        return;
      }

      if (isRlsPermissionDenied(error)) {
        setResult("protected");
        return;
      }

      setResult("error");
      setErrorDetail(
        [error.message, error.code ? `code: ${error.code}` : null]
          .filter(Boolean)
          .join(" · "),
      );
    } catch (e) {
      setResult("error");
      setInitMessage(null);
      setErrorDetail(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/settings"
          className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          ← 返回设置
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Supabase 连接测试
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          使用 anon key 尝试只读{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">profiles</code>{" "}
          一行（不写入）。当前<strong>未登录</strong>时，若表启用 RLS，可能收到{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">42501</code> /{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            permission denied
          </code>
          —— 表示<strong>已连上 Supabase</strong>，只是<strong>无权读表</strong>，属预期，不是「连不上」。
        </p>
      </div>

      <Card className="space-y-4">
        <div>
          <CardTitle className="text-base">环境变量</CardTitle>
          <CardDescription>
            将 <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">.env.example</code>{" "}
            复制为 <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">.env.local</code>{" "}
            并填入 Supabase 控制台中的 Project URL 与 anon public key。
          </CardDescription>
        </div>
        <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <li>
            <span className="font-medium">NEXT_PUBLIC_SUPABASE_URL：</span>
            {envStatus.urlConfigured ? (
              <span className="text-emerald-700 dark:text-emerald-400">已配置</span>
            ) : (
              <span className="text-amber-700 dark:text-amber-400">未配置</span>
            )}
          </li>
          <li>
            <span className="font-medium">NEXT_PUBLIC_SUPABASE_ANON_KEY：</span>
            {envStatus.anonKeyConfigured ? (
              <span className="text-emerald-700 dark:text-emerald-400">已配置</span>
            ) : (
              <span className="text-amber-700 dark:text-amber-400">未配置</span>
            )}
          </li>
        </ul>

        <Button
          type="button"
          variant="primary"
          disabled={
            loading ||
            !envStatus.urlConfigured ||
            !envStatus.anonKeyConfigured
          }
          onClick={handleTest}
        >
          {loading ? "测试中…" : "测试 Supabase 连接"}
        </Button>

        {!envStatus.urlConfigured || !envStatus.anonKeyConfigured ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            请先配置两项环境变量并重启开发服务器（<code>npm run dev</code>
            ），再点击测试。
          </p>
        ) : null}

        {initMessage ? (
          <p
            className="text-sm font-medium text-emerald-700 dark:text-emerald-400"
            role="status"
          >
            {initMessage}
          </p>
        ) : null}

        {result === "success" ? (
          <div
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100"
            role="status"
          >
            <p className="font-medium">连接成功</p>
            <p className="mt-1">
              Supabase 连接成功；已能使用当前会话读取{" "}
              <code className="rounded bg-emerald-100/80 px-1 dark:bg-emerald-900/60">
                profiles
              </code>{" "}
             （或表允许匿名读）。
            </p>
          </div>
        ) : null}

        {result === "protected" ? (
          <div
            className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100"
            role="status"
          >
            <p className="font-medium">连接成功（受 RLS 保护）</p>
            <p className="mt-1 leading-relaxed">
              Supabase 连接成功；{" "}
              <code className="rounded bg-sky-100/80 px-1 dark:bg-sky-900/60">
                profiles
              </code>{" "}
              表受 RLS 保护，当前未登录无法读取，这是预期行为。若接口返回{" "}
              <code className="rounded bg-sky-100/80 px-1 dark:bg-sky-900/60">
                code: 42501
              </code>{" "}
              或{" "}
              <code className="rounded bg-sky-100/80 px-1 dark:bg-sky-900/60">
                permission denied
              </code>
              ，表示<strong>客户端与项目已连通</strong>，只是<strong>策略禁止匿名读该行</strong>。
            </p>
          </div>
        ) : null}

        {result === "error" && errorDetail ? (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
            role="alert"
          >
            <p className="font-medium">连接失败</p>
            <p className="mt-1 whitespace-pre-wrap break-words">{errorDetail}</p>
            <p className="mt-2 text-xs opacity-90">
              若仅为 RLS 拒绝，应出现上方蓝色「受 RLS 保护」提示；此处多为网络、URL、密钥错误或服务端异常。
            </p>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
