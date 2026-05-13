"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { isSpeechSynthesisAvailable, speakGerman } from "@/lib/speech";

const UNSUPPORTED_MSG = "当前浏览器暂不支持发音";

export function PronunciationButton({
  text,
  lang = "de-DE",
  className = "",
  size = "md",
  label = "发音",
}: {
  text: string;
  lang?: string;
  className?: string;
  size?: "sm" | "md";
  label?: string;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const clearFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    setSupported(isSpeechSynthesisAvailable());
  }, []);

  useEffect(() => {
    return () => {
      if (clearFeedbackTimerRef.current !== null) {
        clearTimeout(clearFeedbackTimerRef.current);
      }
    };
  }, []);

  const handleSpeak = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      console.log("PronunciationButton clicked", text);
      console.log("speechSynthesis available", !!window.speechSynthesis);

      if (clearFeedbackTimerRef.current !== null) {
        clearTimeout(clearFeedbackTimerRef.current);
        clearFeedbackTimerRef.current = null;
      }

      if (!isSpeechSynthesisAvailable()) {
        setFeedback(UNSUPPORTED_MSG);
        clearFeedbackTimerRef.current = setTimeout(() => setFeedback(null), 3500);
        return;
      }

      const trimmed = text.trim();
      if (!trimmed) {
        setFeedback("没有可播放的文本");
        clearFeedbackTimerRef.current = setTimeout(() => setFeedback(null), 3500);
        return;
      }

      const ok = speakGerman(text, lang);
      if (!ok) {
        setFeedback(UNSUPPORTED_MSG);
      } else {
        setFeedback(`正在播放：${trimmed}`);
      }
      clearFeedbackTimerRef.current = setTimeout(() => setFeedback(null), 3500);
    },
    [text, lang],
  );

  if (supported === false) {
    return (
      <div className="space-y-1">
        <span className="text-xs text-amber-700 dark:text-amber-400">
          {UNSUPPORTED_MSG}
        </span>
      </div>
    );
  }

  if (supported === null) {
    return (
      <span
        className={`inline-block h-8 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800 ${className}`}
        aria-hidden
      />
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        onClick={handleSpeak}
        className={`${size === "sm" ? "h-8 px-2 py-1 text-xs" : "h-9 px-3 text-sm"} ${className}`}
        title={`朗读：${text}`}
      >
        <span aria-hidden>🔊</span>
        {label}
      </Button>
      {feedback ? (
        <p
          className="text-sm text-emerald-700 dark:text-emerald-400"
          role="status"
        >
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
