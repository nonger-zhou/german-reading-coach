"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LEARNING_LANGUAGE, type LearningLanguage } from "./learningLanguage";

/**
 * 当前内容的语言（阅读页 = 文章语言；词库 / 复习页 = 当前学习语言）。
 * 发音按钮等组件据此选朗读语言；没有 Provider 时为德语，与以前一致。
 */
const ContentLanguageContext = createContext<LearningLanguage>(DEFAULT_LEARNING_LANGUAGE);

export function ContentLanguageProvider({
  language,
  children,
}: {
  language: LearningLanguage;
  children: ReactNode;
}) {
  return (
    <ContentLanguageContext.Provider value={language}>{children}</ContentLanguageContext.Provider>
  );
}

export function useContentLanguage(): LearningLanguage {
  return useContext(ContentLanguageContext);
}
