"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { GermanLevelSelect } from "@/components/GermanLevelSelect";
import { PronunciationButton } from "@/components/PronunciationButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { ensureUserProfile } from "@/lib/supabase/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatSupabaseOrUnknownError } from "@/lib/supabase/errors";
import type { CefrLevel } from "@/lib/types";

const STORAGE_KEY_AUTO_PLAY = "german-reading-coach:autoPlayPronunciationOnClick";
const LOGIN_HREF = "/login?next=%2Fsettings";
const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

function normalizeCefrLevel(value: string | null | undefined): CefrLevel {
  return LEVELS.includes(value as CefrLevel) ? (value as CefrLevel) : "B1";
}

export default function SettingsPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [defaultLevel, setDefaultLevel] = useState<CefrLevel>("B1");
  const [defaultLevelLoading, setDefaultLevelLoading] = useState(true);
  const [defaultLevelSaving, setDefaultLevelSaving] = useState(false);
  const [defaultLevelError, setDefaultLevelError] = useState<string | null>(null);
  const [defaultLevelNotice, setDefaultLevelNotice] = useState<string | null>(null);
  const [autoPlayOnClick, setAutoPlayOnClick] = useState(false);
  const [directSpeakFeedback, setDirectSpeakFeedback] = useState<string | null>(
    null,
  );
  const directFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const refreshSession = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    setSession(s);
    return s;
  }, []);

  useEffect(() => {
    void refreshSession();
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, [refreshSession]);

  useEffect(() => {
    if (session === undefined) {
      return;
    }
    if (!session?.user) {
      setDefaultLevel("B1");
      setDefaultLevelLoading(false);
      setDefaultLevelError(null);
      return;
    }

    let cancelled = false;
    setDefaultLevelLoading(true);
    setDefaultLevelError(null);

    (async () => {
      try {
        const { profile } = await ensureUserProfile(session.user);
        if (cancelled) return;
        setDefaultLevel(normalizeCefrLevel(profile.self_selected_level));
      } catch (e) {
        if (cancelled) return;
        setDefaultLevelError(formatSupabaseOrUnknownError(e));
      } finally {
        if (!cancelled) {
          setDefaultLevelLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY_AUTO_PLAY);
      setAutoPlayOnClick(v === "true");
    } catch {
      setAutoPlayOnClick(false);
    }
  }, []);

  function onToggleAutoPlay(checked: boolean) {
    setAutoPlayOnClick(checked);
    try {
      localStorage.setItem(STORAGE_KEY_AUTO_PLAY, checked ? "true" : "false");
    } catch {
      /* ignore */
    }
  }

  async function onChangeDefaultLevel(nextLevel: CefrLevel) {
    if (!session?.user || defaultLevelSaving) return;
    setDefaultLevel(nextLevel);
    setDefaultLevelSaving(true);
    setDefaultLevelError(null);
    setDefaultLevelNotice(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("profiles")
        .update({ self_selected_level: nextLevel })
        .eq("id", session.user.id);
      if (error) {
        throw error;
      }
      setDefaultLevelNotice(`默认阅读水平已保存为 ${nextLevel}`);
    } catch (e) {
      setDefaultLevelError(formatSupabaseOrUnknownError(e));
    } finally {
      setDefaultLevelSaving(false);
    }
  }

  useEffect(() => {
    return () => {
      if (directFeedbackTimerRef.current !== null) {
        clearTimeout(directFeedbackTimerRef.current);
      }
    };
  }, []);

  function handleDirectSpeechTest(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    console.log("直接测试 speechSynthesis clicked");

    if (directFeedbackTimerRef.current !== null) {
      clearTimeout(directFeedbackTimerRef.current);
      directFeedbackTimerRef.current = null;
    }

    if (typeof window === "undefined" || !window.speechSynthesis) {
      setDirectSpeakFeedback("当前浏览器暂不支持发音");
      directFeedbackTimerRef.current = setTimeout(
        () => setDirectSpeakFeedback(null),
        3500,
      );
      return;
    }

    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance("Guten Tag");
    u.lang = "de-DE";
    window.speechSynthesis.speak(u);
    setDirectSpeakFeedback("已触发直接朗读（Guten Tag）");
    directFeedbackTimerRef.current = setTimeout(
      () => setDirectSpeakFeedback(null),
      3500,
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          设置
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          调整阅读水平、解释语言和发音相关选项。
        </p>
      </div>
      <Card className="space-y-5">
        <div className="space-y-3">
          <div>
            <CardTitle className="text-base">默认阅读水平</CardTitle>
            <CardDescription>
              导入文章时会自动带入这个水平；每篇文章保存前仍可临时修改。
            </CardDescription>
          </div>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            这个等级只用于调节阅读辅助强度（解释多少、提示频率等），不是完整 CEFR 能力评定。
          </p>
          {session === undefined || defaultLevelLoading ? (
            <p className="text-sm text-zinc-500">加载中…</p>
          ) : !session?.user ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              登录后可保存自己的默认阅读水平。{" "}
              <Link href={LOGIN_HREF} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                去登录
              </Link>
            </p>
          ) : (
            <GermanLevelSelect
              value={defaultLevel}
              onChange={(v) => void onChangeDefaultLevel(v)}
              name="settings-default-level"
            />
          )}
          {defaultLevelSaving ? (
            <p className="text-sm text-zinc-500">保存中…</p>
          ) : null}
          {defaultLevelNotice ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
              {defaultLevelNotice}
            </p>
          ) : null}
          {defaultLevelError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100" role="alert">
              {defaultLevelError}
            </p>
          ) : null}
        </div>

        <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">估计阅读辅助等级</CardTitle>
              <CardDescription>根据后续阅读表现估计，用来调整提示强度。</CardDescription>
            </div>
            <Badge tone="success" className="shrink-0">
              B1–B2
            </Badge>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            说明：这是系统根据您的阅读行为<strong>估计的辅助强度档位</strong>，用于调节提示多少，
            <strong>不是</strong>对您德语整体能力（听说读写）的完整 CEFR 评定。
          </p>
        </div>

        <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">解释语言</CardTitle>
              <CardDescription>词汇、语法和阅读提示优先使用的说明语言。</CardDescription>
            </div>
            <Badge tone="muted" className="shrink-0">
              简体中文
            </Badge>
          </div>
        </div>

        <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div>
            <CardTitle className="text-base">测试德语发音</CardTitle>
            <CardDescription>
              使用与阅读页、词库页相同的朗读逻辑（Web Speech API，默认 de-DE）。
            </CardDescription>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
              <PronunciationButton text="Guten Tag" label="测试德语发音" />
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 w-fit border border-dashed border-zinc-300 px-3 text-sm dark:border-zinc-600"
                  onClick={handleDirectSpeechTest}
                >
                  直接测试 speechSynthesis
                </Button>
                {directSpeakFeedback ? (
                  <p
                    className="text-sm text-emerald-700 dark:text-emerald-400"
                    role="status"
                  >
                    {directSpeakFeedback}
                  </p>
                ) : null}
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              若组件按钮无声音但「直接测试」有声，请看控制台
              <code className="mx-0.5 rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                PronunciationButton clicked
              </code>
              是否出现；二者都无声音时多为系统未装德语语音或浏览器禁用合成。
            </p>
          </div>
        </div>

        <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">点击后自动播放发音</CardTitle>
              <CardDescription>开启后，点击相关学习项时可自动播放德语发音。</CardDescription>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                默认关闭；当前仍以点击「发音」按钮为主。
              </p>
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={autoPlayOnClick}
                onChange={(e) => onToggleAutoPlay(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 accent-emerald-600 dark:border-zinc-600"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                {autoPlayOnClick ? "已开启" : "已关闭"}
              </span>
            </label>
          </div>
        </div>
      </Card>
    </div>
  );
}
