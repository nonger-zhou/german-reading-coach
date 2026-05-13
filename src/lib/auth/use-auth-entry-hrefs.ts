"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  loginPageHref,
  postAuthRedirectOrHome,
  signupPageHref,
} from "@/lib/auth/post-auth-redirect";

/** 当前页上下文下的登录/注册入口链接（带安全 `next`）及登录/注册成功后的落地路径 */
export function useAuthEntryHrefs(): {
  loginHref: string;
  signupHref: string;
  postAuthRedirect: string;
} {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nextFromUrl = searchParams.get("next");
  const search = searchParams.toString();

  return {
    loginHref: loginPageHref(pathname, search, nextFromUrl),
    signupHref: signupPageHref(pathname, search, nextFromUrl),
    postAuthRedirect: postAuthRedirectOrHome(nextFromUrl),
  };
}
