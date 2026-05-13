/**
 * 历史占位模块：导出 no-op 形状的预留函数。
 * Phase 2.5 阅读页已改用 `@/lib/supabase/vocabulary` / `grammar`；此处保留以免旧 import 断裂。
 */

import type { ArticleGrammarItem } from "@/lib/articleReadingTypes";
import type { ArticleVocabItem } from "@/lib/articleReadingTypes";

/** 预留 API 表面；阅读页已直接调用 `persistManualVocabularyItem` 等，此处仍为 no-op。 */
export async function persistArticleVocabularyForArticle(args: {
  articleId: string;
  items: ArticleVocabItem[];
}): Promise<void> {
  void args;
}

/** 预留 API 表面；阅读页已直接调用 `persistManualGrammarItem`，此处仍为 no-op。 */
export async function persistArticleGrammarForArticle(args: {
  articleId: string;
  items: ArticleGrammarItem[];
}): Promise<void> {
  void args;
}
