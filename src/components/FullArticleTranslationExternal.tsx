"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { buildFullArticleTranslationPrompt } from "@/lib/articleAnalysis/buildFullArticleTranslationPrompt";
import {
  copyTextAndOpenExternalSite,
  FULL_ARTICLE_TRANSLATION_PROVIDERS,
  type ExternalTranslationProvider,
} from "@/lib/externalTranslationLinks";

type Props = {
  articlePlain: string;
  title?: string;
  disabled?: boolean;
};

export function FullArticleTranslationExternal({
  articlePlain,
  title,
  disabled = false,
}: Props) {
  const [notice, setNotice] = useState<string | null>(null);

  const run = useCallback(
    async (provider: ExternalTranslationProvider | null) => {
      if (!articlePlain.trim()) {
        setNotice("正文为空，无法生成翻译 Prompt。");
        return;
      }
      const prompt = buildFullArticleTranslationPrompt({
        articleText: articlePlain,
        title,
      });
      const { ok, message } = await copyTextAndOpenExternalSite(
        prompt,
        provider?.url ?? null,
      );
      setNotice(message);
      if (!ok) return;
    },
    [articlePlain, title],
  );

  const overseas = FULL_ARTICLE_TRANSLATION_PROVIDERS.filter(
    (p) => p.region === "overseas",
  );
  const domestic = FULL_ARTICLE_TRANSLATION_PROVIDERS.filter(
    (p) => p.region === "domestic",
  );

  const btnClass = "px-2 py-1 text-xs font-normal";

  return (
    <div className="w-full min-w-0">
      <details className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 dark:border-zinc-700/80 dark:bg-zinc-900/35">
        <summary className="cursor-pointer select-none px-2.5 py-2 text-xs font-medium text-zinc-700 marker:hidden dark:text-zinc-300 [&::-webkit-details-marker]:hidden">
          全文翻译为中文（外接 AI，可选）
        </summary>
        <div className="space-y-2 border-t border-zinc-200/80 px-2.5 pb-2.5 pt-2 dark:border-zinc-700/80">
          <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
            复制 Prompt 后在外部网站粘贴；本应用不调用 API、不入库。
          </p>
          <div>
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              海外可用
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {overseas.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant="secondary"
                  className={btnClass}
                  disabled={disabled}
                  onClick={() => void run(p)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              国内可用
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {domestic.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant="secondary"
                  className={btnClass}
                  disabled={disabled}
                  onClick={() => void run(p)}
                >
                  {p.label}
                </Button>
              ))}
              <Button
                type="button"
                variant="secondary"
                className={btnClass}
                disabled={disabled}
                onClick={() => void run(null)}
              >
                仅复制 Prompt
              </Button>
            </div>
          </div>
        </div>
      </details>
      {notice ? (
        <p className="mt-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-200/90">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
