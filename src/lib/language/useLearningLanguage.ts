"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  DEFAULT_LEARNING_LANGUAGE,
  isLearningLanguage,
  type LearningLanguage,
} from "./learningLanguage";

/**
 * 当前学习语言（顶栏切换）。
 *
 * - 真相源：`profiles.target_language`（跨设备同步）；本机 localStorage 只做首屏缓存，避免闪一下德语。
 * - 未登录、读不到、旧账号：一律德语，德语用户的体验与以前完全相同。
 * - 页面在 `ready` 之前不要按语言拉数据（新设备上首屏还不知道用户选了哪种语言）。
 */

const STORAGE_KEY = "grc.learningLanguage.v1";

type State = { language: LearningLanguage; ready: boolean };

let state: State = { language: DEFAULT_LEARNING_LANGUAGE, ready: false };
let initialized = false;
const listeners = new Set<() => void>();

function emit(next: State) {
  if (next.language === state.language && next.ready === state.ready) return;
  state = next;
  for (const l of listeners) l();
}

function readCache(): LearningLanguage | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isLearningLanguage(v) ? v : null;
  } catch {
    return null;
  }
}

function writeCache(lang: LearningLanguage) {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* 隐私模式等：忽略 */
  }
}

async function syncFromProfile() {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      emit({ language: state.language, ready: true });
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("target_language")
      .eq("id", userId)
      .maybeSingle();
    const fromDb =
      !error && data && isLearningLanguage(data.target_language)
        ? data.target_language
        : DEFAULT_LEARNING_LANGUAGE;
    writeCache(fromDb);
    emit({ language: fromDb, ready: true });
  } catch {
    emit({ language: state.language, ready: true });
  }
}

function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const cached = readCache();
  if (cached) emit({ language: cached, ready: true });
  void syncFromProfile();
  const supabase = getSupabaseBrowserClient();
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
      void syncFromProfile();
    }
  });
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY && isLearningLanguage(e.newValue)) {
      emit({ language: e.newValue, ready: true });
    }
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const SERVER_STATE: State = { language: DEFAULT_LEARNING_LANGUAGE, ready: false };

/** 切换当前学习语言：立即生效，并写入 profiles（失败时本机仍生效，返回错误信息） */
export async function setLearningLanguage(lang: LearningLanguage): Promise<string | null> {
  writeCache(lang);
  emit({ language: lang, ready: true });
  try {
    const supabase = getSupabaseBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return null;
    const { error } = await supabase
      .from("profiles")
      .update({ target_language: lang })
      .eq("id", userId);
    return error ? error.message : null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export function useLearningLanguage(): {
  language: LearningLanguage;
  ready: boolean;
  setLanguage: (lang: LearningLanguage) => Promise<string | null>;
} {
  useEffect(() => {
    init();
  }, []);
  const snap = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
  const setLanguage = useCallback((lang: LearningLanguage) => setLearningLanguage(lang), []);
  return { language: snap.language, ready: snap.ready, setLanguage };
}
