"use client";

import { useState } from "react";
import {
  LEARNING_LANGUAGES,
  LEARNING_LANGUAGE_LABEL_ZH,
  type LearningLanguage,
} from "@/lib/language/learningLanguage";
import { useLearningLanguage } from "@/lib/language/useLearningLanguage";

/**
 * 顶栏「当前学习语言」切换：文章库、词库、语法库、复习、导入默认语言、阅读水平都跟随这里。
 * 打开某一篇文章时，阅读页按文章自己的语言显示，不受这里影响。
 */
export function LearningLanguageSwitch() {
  const { language, ready, setLanguage } = useLearningLanguage();
  const [error, setError] = useState<string | null>(null);

  async function choose(lang: LearningLanguage) {
    if (lang === language) return;
    setError(null);
    const err = await setLanguage(lang);
    if (err) setError("已在本机切换，但同步到账号失败；换设备后可能需要重新选择。");
  }

  return (
    <div className="flex items-center gap-2">
      <div
        role="radiogroup"
        aria-label="当前学习语言"
        title="切换当前学习语言：文章库、词库、复习等只显示这种语言的内容"
        className="inline-flex shrink-0 rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
      >
        {LEARNING_LANGUAGES.map((lang) => {
          const active = ready && lang === language;
          return (
            <button
              key={lang}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => void choose(lang)}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                active
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {LEARNING_LANGUAGE_LABEL_ZH[lang]}
            </button>
          );
        })}
      </div>
      {error ? (
        <span className="text-[11px] text-amber-700 dark:text-amber-400" role="status">
          {error}
        </span>
      ) : null}
    </div>
  );
}
