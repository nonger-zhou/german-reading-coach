# 词汇推荐实验（2026-05）

2026 年 5 月为排查「AI 推荐词汇偏名词」做的实验代码与报告，**不参与生产、不参与 `npm test` 与类型检查**（`tsconfig.json`、`vitest.config.ts` 已排除 `experiments/`）。

- `*.live.test.ts`：调用真实 OpenAI 的对照实验，需 `.env.local` 里的 `OPENAI_API_KEY` 与各文件头注明的环境变量；运行方式见 `package.json` 中 `vocab-*:try` 脚本，或 `npx vitest run --config vitest.live.config.ts <文件>`。
- 其余 `.ts`：实验用 prompt / schema / 拆分调用，以及已停用的「全名词自动重试」。
- `reports/`：各实验输出的 JSON 报告。
- 结论汇总见 `docs/VOCABULARY_EXPERIMENTS_SUMMARY_FOR_CHATGPT.md`、`docs/AI_VOCABULARY_NOUN_BIAS_FULL_BRIEF_FOR_CHATGPT.md`。

这些实验的结论促成了 2026-10-15 的「选词 v2」（`src/lib/vocabSelection/`）：选词改由程序按词频与用户词库完成，模型只负责解释与排序。

注：部分文件引用的模块在 5 月 17 日回退后已不存在（如 `ARTICLE_CORE_ANALYSIS_JSON_SCHEMA`），直接运行前需先修复。
