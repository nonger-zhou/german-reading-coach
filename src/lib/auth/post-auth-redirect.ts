/** 登录/注册成功后无有效 `next` 时的默认落地页 */
export const DEFAULT_POST_AUTH_PATH = "/";

const AUTH_PATH_PREFIXES = ["/login", "/signup", "/auth/recovery"] as const;

export function shouldAttachReturnUrl(pathname: string): boolean {
  const p = pathname.split("?")[0] ?? pathname;
  return !AUTH_PATH_PREFIXES.some(
    (prefix) => p === prefix || p.startsWith(`${prefix}/`),
  );
}

export function mergePathAndQuery(pathname: string, search: string): string {
  if (!search) return pathname;
  return `${pathname}?${search}`;
}

/**
 * 校验并解析 URL 查询参数中的 `next`（或等价的回跳路径），防止开放重定向。
 * 仅允许同源相对路径（以 `/` 开头且非 `//`），并排除登录/注册/重置密码流程页。
 */
export function tryResolveReturnPath(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  try {
    s = decodeURIComponent(s);
  } catch {
    return null;
  }
  if (!s.startsWith("/") || s.startsWith("//")) return null;
  if (s.includes("\\") || s.includes("\0")) return null;

  const pathOnly = (s.split("#")[0] ?? "").split("?")[0] ?? "";
  for (const prefix of AUTH_PATH_PREFIXES) {
    if (pathOnly === prefix || pathOnly.startsWith(`${prefix}/`)) {
      return null;
    }
  }

  return s.split("#")[0] || null;
}

export function postAuthRedirectOrHome(raw: string | null | undefined): string {
  return tryResolveReturnPath(raw) ?? DEFAULT_POST_AUTH_PATH;
}

export function loginPageHref(
  pathname: string,
  search: string,
  nextFromUrl: string | null,
): string {
  const fromQuery = tryResolveReturnPath(nextFromUrl);
  if (fromQuery) {
    return `/login?next=${encodeURIComponent(fromQuery)}`;
  }
  if (shouldAttachReturnUrl(pathname)) {
    const loc = mergePathAndQuery(pathname, search);
    const fromLoc = tryResolveReturnPath(loc);
    if (fromLoc) {
      return `/login?next=${encodeURIComponent(fromLoc)}`;
    }
  }
  return "/login";
}

export function signupPageHref(
  pathname: string,
  search: string,
  nextFromUrl: string | null,
): string {
  const fromQuery = tryResolveReturnPath(nextFromUrl);
  if (fromQuery) {
    return `/signup?next=${encodeURIComponent(fromQuery)}`;
  }
  if (shouldAttachReturnUrl(pathname)) {
    const loc = mergePathAndQuery(pathname, search);
    const fromLoc = tryResolveReturnPath(loc);
    if (fromLoc) {
      return `/signup?next=${encodeURIComponent(fromLoc)}`;
    }
  }
  return "/signup";
}
