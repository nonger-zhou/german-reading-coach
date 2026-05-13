"use client";

import { useMemo } from "react";
import {
  initialGrammar,
  initialVocabulary,
  mockArticleChunks,
  mockArticleMeta,
} from "@/data/mock";
import { InteractiveArticleReader } from "@/components/InteractiveArticleReader";
import {
  buildArticleLayout,
  buildInitialArticleGrammar,
  buildInitialArticleVocabulary,
} from "@/lib/articleReadingModel";

export function MockArticleReader() {
  const { articlePlain, chunkIntervals } = useMemo(
    () => buildArticleLayout(mockArticleChunks),
    [],
  );

  const initialVocabularyItems = useMemo(
    () =>
      buildInitialArticleVocabulary(
        articlePlain,
        chunkIntervals,
        initialVocabulary,
      ),
    [articlePlain, chunkIntervals],
  );

  const initialGrammarItems = useMemo(
    () =>
      buildInitialArticleGrammar(
        articlePlain,
        chunkIntervals,
        initialGrammar,
      ),
    [articlePlain, chunkIntervals],
  );

  const summaryPanel = (
    <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
      {mockArticleMeta.summaryZh}
    </p>
  );

  const questionsPanel = (
    <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
      {mockArticleMeta.questions.map((q) => (
        <li key={q}>{q}</li>
      ))}
    </ol>
  );

  return (
    <InteractiveArticleReader
      articlePlain={articlePlain}
      chunkIntervals={chunkIntervals}
      metaTitle={mockArticleMeta.title}
      initialVocabularyItems={initialVocabularyItems}
      initialGrammarItems={initialGrammarItems}
      summaryPanel={summaryPanel}
      questionsPanel={questionsPanel}
      legendMode="full"
    />
  );
}
