"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Supabase 重置密码邮件默认把用户带回 Site URL（常为 `/`），错误会出现在 hash 里。
 * 在全局壳层解析并提示，并把地址栏 hash 清掉，避免用户困惑。
 */
export function AuthRecoveryHashBanner() {
  const [payload, setPayload] = useState<{
    code: string;
    description: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw) return;

    const params = new URLSearchParams(raw);
    const errorCode = params.get("error_code");
    const errorDescription = params.get("error_description");

    const hasAccessToken = params.has("access_token");

    if (errorCode) {
      setPayload({
        code: errorCode,
        description: errorDescription
          ? decodeURIComponent(errorDescription.replace(/\+/g, " "))
          : "",
      });
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
      return;
    }

    if (
      hasAccessToken &&
      !window.location.pathname.startsWith("/auth/recovery")
    ) {
      const next = `${window.location.origin}/auth/recovery${window.location.hash}`;
      window.location.replace(next);
    }
  }, []);

  if (!payload) return null;

  const isExpired = payload.code === "otp_expired";

  return (
    <div
      className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
      role="alert"
    >
      <p className="font-medium">
        {isExpired
          ? "密码重置链接已失效或已过期"
          : "通过邮件登录/重置时出现问题"}
      </p>
      {payload.description ? (
        <p className="mt-1 opacity-90">{payload.description}</p>
      ) : null}
      {isExpired ? (
        <p className="mt-2 text-xs leading-relaxed opacity-95">
          常见原因：链接超过有效时间、重复点击了同一封邮件里的旧链接，或邮箱客户端「安全预览」提前打开了链接导致一次性链接被用掉。
          请到{" "}
          <Link
            href="/login"
            className="font-medium text-amber-900 underline underline-offset-2 dark:text-amber-200"
          >
            登录页
          </Link>{" "}
          使用「忘记密码」再发一封，并在收到新邮件后尽快只点击一次其中有效链接。
        </p>
      ) : null}
    </div>
  );
}
