# 开发记录（Development Log）

## 记录日期

2026-05-02

## 当前阶段

**Phase 2.5**、**Phase 3.0（Mock 演示）**、**Phase 3.1（OpenAI 预览）**、**Phase 3.2（真实 AI 确认保存）**、**Phase 3.5（文章页 AI 区：真实 AI 为主，Mock 仅开发工具）**、**Phase 3.6（学习项删除）**、**Phase 3.7（学习项状态语义 UI：学习中 + 已掌握折叠）** 已落地（见下方「更新记录」）。下方「已完成内容」含历史 **Phase 1 Mock** 记录，完整课文演示仍以 **`/articles/mock`** 为准。

## 已完成内容

- 使用 `create-next-app` 初始化项目（App Router、`src` 目录、TypeScript、Tailwind CSS v4）。
- 实现全局 `AppShell`：顶栏导航、页脚说明、响应式布局。
- 实现德语阅读 Mock 阅读器：桌面端左右分栏、移动端单栏 + 底部详情抽屉；文中词汇/语法高亮与右侧 Tabs 联动。
- 实现 `PronunciationButton`（Web Speech API，`lang` 默认 `de-DE`）及不支持时的提示文案。
- 实现 `GermanLevelSelect`：CEFR A1–C2，A2/B1/B2 视觉高亮与「推荐用于新闻阅读训练」标签。
- 词库与语法库页面：展示 Mock 列表，支持会话内修改 `mastery_status`。
- 导入页：URL、正文、水平选择；分析按钮跳转至固定 Mock 阅读页。
- 设置页：展示演示用配置字段（静态文案）。

## 创建的页面（App Router）

| 路由 | 文件 |
|------|------|
| `/` | `src/app/page.tsx` |
| `/dashboard` | `src/app/dashboard/page.tsx` |
| `/import` | `src/app/import/page.tsx` |
| `/articles` | `src/app/articles/page.tsx` |
| `/articles/mock` | `src/app/articles/mock/page.tsx` |
| `/vocabulary` | `src/app/vocabulary/page.tsx` |
| `/grammar` | `src/app/grammar/page.tsx` |
| `/settings` | `src/app/settings/page.tsx` |

## 创建的组件

| 组件 | 路径 |
|------|------|
| `AppShell` | `src/components/AppShell.tsx` |
| `GermanLevelSelect` | `src/components/GermanLevelSelect.tsx` |
| `MockArticleReader` | `src/components/MockArticleReader.tsx` |
| `PronunciationButton` | `src/components/PronunciationButton.tsx` |
| `Button` | `src/components/ui/Button.tsx` |
| `Card` / `CardTitle` / `CardDescription` | `src/components/ui/Card.tsx` |
| `Badge` | `src/components/ui/Badge.tsx` |
| `Tabs` | `src/components/ui/Tabs.tsx` |

## 数据与类型

- `src/data/mock.ts` — Mock 文章片段、词汇、语法、摘要与问题。
- `src/lib/types.ts` — `CefrLevel`、`MasteryStatus`、`VocabEntry`、`GrammarEntry`、`ArticleChunk` 等。

## 当前技术栈

- **框架**：Next.js 16（App Router）
- **语言**：TypeScript 5
- **UI**：React 19、Tailwind CSS v4（`@import "tailwindcss"`）
- **字体**：`next/font`（Geist Sans / Geist Mono）
- **包管理**：npm

## 已知问题

- **无持久化**：词库/语法掌握状态、导入表单内容刷新后即恢复 Mock 默认值。
- **导入「分析」**：仅跳转 `/articles/mock`，不解析粘贴正文或 URL。
- **发音**：依赖浏览器 `speechSynthesis`，音色与德语分词质量因系统/浏览器而异；部分环境可能不可用。
- **无障碍**：Tabs、高亮词与 hover 提示仍可继续优化（焦点顺序、屏幕阅读器文案等）。

## 下一步计划

1. 走查 Mock UI 与交互（桌面/移动、阅读页 Tabs、底部抽屉、发音按钮）。
2. 接入 **Supabase**（用户、文章、词汇/语法条目、掌握状态持久化）。
3. 规划 **OpenAI API**（或同类服务）用于文章分析、摘要与分级解释。
4. 可选：真实 **URL 抓取/解析** 管道与 **Vercel** 部署流程。

---

## 更新记录（按任务追加）

### 2026-05-13 — 词汇持久化：23505 唯一约束与重复卡片

**本次完成**

- **`src/lib/supabase/vocabularyItemUniqueKey.ts`**：`sameVocabPartOfSpeechForUnique`（库 `part_of_speech` 为 **null** 与 UI 空串 **""** 对齐）、`isPostgresUniqueViolation`。
- **`src/lib/supabase/vocabulary.ts`**：`persistManualVocabularyItem` 按 **`user_id + normalized_key`** 拉候选行，用上述匹配选已有行；**UPDATE** 时写回 **`part_of_speech`**；**INSERT** 遇 **23505** 时回查并走更新路径。
- **`src/components/InteractiveArticleReader.tsx`**：保存成功后 **`applyPersistedVocabToLocalItems`**，按 `normalized_key` **Map 去重**，避免同 key 两条卡片。
- **`src/lib/supabase/vocabularyPartOfSpeechMatch.test.ts`**：Vitest。

**验证**

- `npm.cmd test`、`npm.cmd run build`：已通过。

### 2026-05-13 — 阅读页：可分动词 / 句选用户词高亮与 occurrence 保留

**本次完成**

- **`src/lib/articleReadingModel.ts`**：`vocabOccurrenceToRanges` 支持在 occurrence 偏移窗口内按卡面 **「前段 … 后段」** 拆成**双段**高亮；`buildRunsFromReadingItems` 传入 `display_word`/`lemma` 上下文；`rebuildUserStyleVocabOccurrencesFromArticle` 在词典形无法全文连续匹配时**保留**仍可通过上述逻辑定位的 occurrence，避免误清空导致无高亮与保存失败；导出 **`splitEllipsisDisplayIntoTwoSurfaceParts`**（测试与将来复用）。
- **`src/components/InteractiveArticleReader.tsx`**：用户词重叠检测处传入相同上下文。
- **`src/app/api/enrich-vocabulary/route.ts`**：system prompt 收紧可分动词 **`surface_form`** 输出格式说明。
- **`src/lib/articleReadingModel.vocabRanges.test.ts`**：Vitest 覆盖省略号解析、双段范围与「词典形 + 句选」保留路径。
- **`docs/READING_HIGHLIGHTS_AND_OVERLAPS.md`**：新增 §6 说明。

**验证**

- `npm.cmd test`、`npm.cmd run build`：已通过。

### 2026-05-13 — `/import`：链接模式下「从剪贴板读取」为 secondary

**本次完成**

- **`src/app/import/page.tsx`**：`mode === "url"` 时剪贴板按钮 **`variant="secondary"`**；手动粘贴模式仍为 **`primary`**。
- **`src/app/import/mock/page.tsx`**：A 栏剪贴板按钮与默认链接态一致为 **secondary**；页脚说明补充。
- **`README.md`**、**`docs/PRD.md`**、**`PROJECT_STATUS.md`**、**`docs/IMPORT_UI_DISCUSSION.md`**：补充链接/粘贴模式下剪贴板按钮层级说明。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-13 — `/import`：移除「重新整理」、主卡标题「正文」、保存与剪贴板同排

**本次完成**

- **`src/app/import/page.tsx`**：删除 **`onCleanBody`** 与 **「重新整理」** 按钮；**`CardTitle`** 与相关用户可见文案由「将保存的正文」改为 **「正文」**；**「保存文章」** 与 **「从剪贴板读取」** 同一 `flex` 行（主按钮样式），去掉卡片底部重复的保存行；来源稿说明与校验/剪贴板/插件提示用语同步。
- **`src/app/import/mock/page.tsx`**：A 栏与正式页对齐；B 栏保留历史草案对照；页脚说明更新。
- **`docs/PRD.md`**、**`README.md`**、**`PROJECT_STATUS.md`**、**`docs/IMPORT_UI_DISCUSSION.md`**、**`docs/PERSONAL_USE_CHECKLIST.md`**：用语与行为描述同步。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-13 — 文档：`docs/IMPORT_UI_DISCUSSION.md`（导入主卡讨论备忘）

**本次完成**

- **`docs/IMPORT_UI_DISCUSSION.md`**：汇总来源稿 / 重新整理 / 剪贴板路径说明、去掉各块的利弊、与 **`/import/mock`** 关系；**「待实现摘要」** 以用户待确认项为准（**未改** `/import` 代码）。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-13 — `/import/mock`：导入主卡布局对照示意（静态）

**本次完成**

- **`src/app/import/mock/page.tsx`**：双栏静态示意（A≈当前主卡、B≈草案），无 Supabase、无抓取；顶栏不新增入口，路径 **`/import/mock`**。
- **`PROJECT_STATUS.md`**：可访问页面表增一行；**`DEVELOPMENT_LOG.md`** 本条。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-13 — 文档：线上仍为旧版阅读页时的部署排查

**本次完成**

- **`README.md`**、**`docs/DEPLOY_VERCEL.md`**：说明若线上仍见词汇卡底部「状态」、静态「学习中」徽标或重复「名词性」行，应核对 Vercel **Production** 最新部署、执行 **`npm.cmd run vercel:prod`**、硬刷新；并注明**无 `.git` 的本地拷贝**不会自动更新远程，须 CLI 或同步到有远程的仓库。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-13 — 词汇卡：主标题已有 der/die/das 时省略副标「名词性：…」

**本次完成**

- **`src/lib/vocabulary/grammaticalGender.ts`**：**`vocabHeadwordShowsLeadingDefiniteArticle`**、**`shouldShowGrammaticalGenderSubtitle`**（主标题已带定冠词则不再重复阴阳中性；**`unclear`** 且标题无定冠词时仍显示「名词性未标注或不确定」；不定冠词 lemma 等仍显示原副标）。
- **`src/components/InteractiveArticleReader.tsx`**、**`src/app/articles/[id]/page.tsx`**：列表 / 详情 / AI 候选预览统一改用 **`shouldShowGrammaticalGenderSubtitle`**。
- **`src/lib/vocabulary/grammaticalGender.test.ts`**：补充用例。
- **`docs/PRD.md`** Phase 3.1 一句与行为一致。

**验证**

- `npm.cmd test`、`npm.cmd run build`：已通过。

### 2026-05-13 — 阅读页：删除并入标题行右侧（与状态下拉同列）

**本次完成**

- **`src/components/InteractiveArticleReader.tsx`**：新增 **`ReadingMasteryTitleActions`**（状态下拉 + **删除**，`shrink-0` / `flex-nowrap`）；移除 **`ReadingMasteryFooter`**。列表卡与词汇/语法详情顶行右侧统一为「下拉 + 删除」（词汇详情旁保留 **发音**）。列表主行德语词包在 **`min-w-0 max-w-full break-words`** 内；详情 **`CardTitle`** 增加 **`min-w-0 break-words`**，长词在左侧换行，不把操作挤乱。
- **`docs/PRD.md` §5.3**：与上述布局约定对齐。

**验证**

- `npm.cmd test`、`npm.cmd run build`：已通过。

### 2026-05-13 — 阅读页学习状态下拉移至标题行

**本次完成**

- **`src/components/InteractiveArticleReader.tsx`**：移除顶行静态 **「学习中 / 已掌握 / 暂忽略」** 徽标与底部「状态」标签；新增 **`ReadingMasteryStatusSelect`**（`aria-label` / `title`：**学习状态**）；词汇/语法**列表卡**将 `button` 与下拉分离（合法 DOM）；**详情卡**顶行放置下拉；**`ReadingMasteryFooter`** 仅保留 **删除**。正文高亮、选区、持久化与 Mock 逻辑未改。
- **`docs/PRD.md` §5.3**：补充顶行下拉 + 底栏仅删除的界面约定。

**验证**

- `npm.cmd test`、`npm.cmd run build`：已通过。

### 2026-05-13 — 用户词汇徽标改为「用户」

**本次完成**

- **`src/components/InteractiveArticleReader.tsx`**：**`user_added`** 词汇徽标与 hover tooltip **「用户词汇」** 改为 **「用户」**。
- **`src/app/articles/mock/page.tsx`**、**`docs/PRD.md`**、**`docs/READING_HIGHLIGHTS_AND_OVERLAPS.md`** 同步表述。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-13 — 阅读页词汇/语法徽标与次数文案缩短

**本次完成**

- **`src/components/InteractiveArticleReader.tsx`**：**`ai` / `ai_mock`** 来源徽标 **「AI 推荐」** 改为 **「AI」**；列表与详情中 **「出现 n 次」** 改为 **「n 次」**。
- **`src/app/articles/[id]/page.tsx`**：保存提示中 **「AI 推荐词汇」** 改为 **「AI 词汇」**。
- **`docs/PRD.md`** Phase 3.0 一句与 badge 表述一致。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-13 — Vercel CLI：`vercel:prod:system-ca`

**本次完成**

- **`scripts/vercel-prod-use-system-ca.cjs`**、**`package.json`** 脚本 **`vercel:prod:system-ca`**：为 **`npx vercel --prod`** 子进程附加 **`NODE_OPTIONS=--use-system-ca`**（与 dev 脚本思路一致），减轻 Windows 下 **unable to verify the first certificate**。
- **`docs/DEPLOY_VERCEL.md`**、**`README.md`** 补充用法说明。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-13 — `/import` 单一主正文与来源稿折叠

**本次完成**

- **`src/app/import/page.tsx`**：移除与「将保存的正文」重复的 **「粘贴文章内容」** 独立大卡；主卡 **「将保存的正文」** 内 **textarea 绑定 `cleaned_text`**，**「从剪贴板读取」「重新整理」** 与之同卡；**`重新整理`** 在无来源稿时 **disabled**；**`hasPaste`** 时以 **`<details>`「来源稿（可选）」** 展示 **`rawPastedText`**，与定稿不一致时轻量样式提示；插件成功、剪贴板与校验提示文案同步。
- **`docs/PRD.md`**（Phase 2.3、§9 `/import` 行）、**`README.md`**、**`docs/PERSONAL_USE_CHECKLIST.md`**。

**已知问题**

- 助手本机 **`npm.cmd run vercel:prod`** 仍因 TLS **unable to verify the first certificate** 失败；需维护者在可信网络执行 CLI 或通过 **Git push / GitHub Actions** 部署。

**验证**

- `npm.cmd test`、`npm.cmd run build`：已通过。

### 2026-05-13 — 词汇主标题补全定冠词（der/die/das）

**本次完成**

- **`src/lib/vocabulary/grammaticalGender.ts`**：**`vocabularyHeadwordDe`**、**`stripLeadingDefiniteArticle`**；在 **`grammatical_gender` 为 m/f/n** 且 lemma 无定冠词时，主标题显示 **「冠词 + 词典形」**；lemma 以 **ein/eine…** 开头时不强行改写。
- **`src/app/articles/[id]/page.tsx`**（AI 预览候选）、**`InteractiveArticleReader.tsx`**（侧栏列表 / 详情 / 另一列表卡）：主标题改用 **`vocabularyHeadwordDe`**。
- **`src/lib/vocabulary/grammaticalGender.test.ts`**、**`docs/PRD.md` §Phase 3.1** 同步。

**验证**

- `npm.cmd test`、`npm.cmd run build`：已通过。

### 2026-05-13 — 名词性展示条件、自动部署流程与文档

**本次完成**

- **`src/lib/vocabulary/grammaticalGender.ts`**：**`shouldShowGrammaticalGenderRow`**、**`displayGrammaticalGenderLabelZh`**、**`effectiveGrammaticalGender`**、从 **lemma** 的 **der/die/das** 推断展示；**`isNounLikePartOfSpeech`** 排除占位 **「—」** 并识别 **Substantiv / subst.** 等。
- **`src/components/InteractiveArticleReader.tsx`**、**`src/app/articles/[id]/page.tsx`**：词汇 **列表卡 / 详情 / AI 预览** 统一用上述逻辑，避免「已写入 gender 但 part_of_speech 标成 phrase」时整行被隐藏。
- **`src/lib/articleAnalysis/openaiArticleAnalysis.ts`**：SYSTEM_PROMPT 要求 **单个/复合名词** 的 **part_of_speech 必须用 noun 或 compound_noun**。
- **`.github/workflows/vercel-production.yml`**：**push main** 时 build + **Vercel Production**（需配置 `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID`）。
- **`docs/DEPLOY_VERCEL.md` §七**、**`README.md`**、**`AGENTS.md`**、**`CLAUDE.md`**：自动部署与助手收尾时 **`vercel:prod`** 的说明。
- **`docs/PRD.md`**：§Phase 3.1 名词性展示范围与 lemma 推断一句。

**已知问题**

- 助手在本机执行 **`npm.cmd run vercel:prod`** 时因 **TLS「unable to verify the first certificate」** 失败；维护者需在可信网络 **`vercel login`** 后重试，或依赖 **Git 连 Vercel** / **GitHub Actions** 部署。

**验证**

- `npm.cmd test`、`npm.cmd run build`：已通过。

### 2026-05-13 — 文档：Windows PowerShell 拦截 npm.ps1

**本次完成**

- **`README.md`**：在「运行命令」代码块内提示 PowerShell 报错时把 **`npm`** 换成 **`npm.cmd`**；将原单行说明扩展为 **推荐 `npm.cmd`** 与 **可选 `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`**；生产构建代码块补充 `npm.cmd run build` 提示。
- **`docs/PERSONAL_USE_CHECKLIST.md`**：在 **`npm.cmd run dev:clean`** 之外补充同一可选执行策略说明。

**当前项目状态**

- 无应用代码变更；仅降低 Windows 用户因 **PSSecurityException** 无法启动开发服务器的困惑。

**已知问题**

- 无新增。

**下一步建议**

- 若仍无法启动：检查端口占用与 **`.env.local`**；或改用 **cmd.exe** 终端。

**验证**

- `npm.cmd run build`：已通过（由助手在本机执行）。

### 2026-05-13 — 词汇名词性（grammatical_gender）结构化与展示

**本次完成**

- **`src/lib/articleAnalysis/articleAnalysisJsonSchema.ts`**：vocabulary 项增加必填 **`grammatical_gender`**（`na` | `m` | `f` | `n` | `unclear`）。
- **`src/lib/articleAnalysis/types.ts`**、**`normalizeOpenAIArticleAnalysis`**、**`mockAnalyzeArticle`**、**`convertAnalysisToArticleItems`**：贯通该字段。
- **`src/lib/articleReadingTypes.ts`**、**`src/lib/types.ts`（VocabEntry）**、**`articleReadingModel`**：阅读模型与课文 seed 支持 **`grammatical_gender`**。
- **`src/lib/supabase/vocabulary.ts`**：读写 **`vocabulary_items.gender`**；**`src/lib/vocabulary/grammaticalGender.ts`**（中文标签、「名词类」判断含中文「名词」标签）、**`grammaticalGender.test.ts`**。
- **`src/components/InteractiveArticleReader.tsx`**、**`src/app/articles/[id]/page.tsx`（AI 预览）**：名词类展示 **「名词性：阳性（der）」** 等。
- **`src/data/mock.ts`**：演示词条补 **`grammatical_gender`**；**`docs/DATABASE.md`** 补充 **`gender`** 列说明。

**验证**

- `npm.cmd test`、`npm.cmd run build`：已通过。

### 2026-05-13 — AI 保存后 lemma 仍不更新（二次保存跳过词库）

**本次完成**

- **`src/app/articles/[id]/page.tsx`**：`handleSaveRealAiPreview` 不再仅在 `!realAiSavedToLibrary` 时写入词汇/语法；只要当前预览中有候选（`fv`/`fg` 非空），**每次点击保存**都会执行 `persistManualVocabularyItem` / `persistManualGrammarItem` 并 `loadAsideLearningData`，避免「已保存过一次后只点保存摘要」导致新 AI 的 **lemma** 永远不进库。按钮文案改为「保存预览并更新摘要」；预览列表增加「词典形（lemma）」一行便于核对模型输出。
- **`src/lib/supabase/vocabularyLemmaMerge.ts`** + **`vocabulary.ts`**：更新已存在 `vocabulary_items` 行时用 **`mergeLemmaForVocabularyPersist`**，在库中 lemma 曾被误写成句中形式时，优先采用带 **der/die/das** 的新 lemma。
- **`src/lib/articleAnalysis/openaiArticleAnalysis.ts`**：SYSTEM_PROMPT 对 **noun / compound_noun** 的 **lemma** 格式再收紧一句。
- **`src/lib/supabase/vocabularyLemma.test.ts`**：Vitest 覆盖合并逻辑。

**验证**

- `npm.cmd test`、`npm.cmd run build`：已通过。

### 2026-05-13 — 词汇持久化误覆盖 lemma（名词冠词/性消失）

**本次完成**

- **`src/lib/supabase/vocabulary.ts`**：`persistManualVocabularyItem` 在 **insert / update** `vocabulary_items` 时，`lemma` 改为使用 **`item.lemma` 非空则取之，否则回退 `item.display_word`**，不再把 `lemma` 写死为句中 `display_word`。此前会导致 AI 返回的词典形（如 **das Mandat**）在保存后被覆盖成文中片段，阅读页标题里 **der/die/das 等「性」线索** 消失。

**当前项目状态**

- 仅修复写入逻辑；**已错误写入库的旧行**不会自动改写，需对该词重新走 AI 保存或手动在总词库侧修正（若后续提供编辑 lemma 入口）。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-13 — 移动端语法抽屉挡课文与选词

**本次完成**

- **`src/components/InteractiveArticleReader.tsx`**：底部详情打开时的全屏变暗层改为 **`pointer-events-none`**，不再吞掉课文区域的触摸（可继续滑动、拖选蓝 / 紫语法内单词）；变暗区不再承担「点击关闭」；收起请用抽屉内「关闭」。抽屉 **`max-h`** 从 **70vh** 改为 **`min(360px, 50dvh)`** 并增加 **`safe-area-inset-bottom`** 内边距。窄屏在选中语法 / 词汇后短时延迟调用 **`scrollArticleToOccurrence`**，并传入 **`ensureGapBottom`**，配合 **`scrollElementIntoScrollContainer`** 新参数，把对应高亮滚到抽屉上方留白。课文说明区增加一句操作提示。
- **`docs/PRD.md`**、**`docs/READING_HIGHLIGHTS_AND_OVERLAPS.md`**：与上述行为对齐。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-13 — 语法高亮内可选词（移动端）

**本次完成**

- **`src/components/InteractiveArticleReader.tsx`**：课文语法（蓝）与用户语法（紫）改为 **`span role="button"`**，使用允许文本选择的样式；触摸时**不再**对语法高亮执行 `pointerdown` 的 `preventDefault` / 清选区逻辑，便于在手机端于语法片段内拖选单词并用浮层「加入词库」。点击语法时若已有非空选区则**不**打开语法详情，减少误触。
- **`docs/PRD.md`** §6：区分词汇高亮与语法高亮在移动端的触摸 / 选词策略。
- **`docs/READING_HIGHLIGHTS_AND_OVERLAPS.md`** §3：与实现对齐。

**当前项目状态**

- 词汇高亮（含已掌握）仍为 `button` + 触摸防护；仅语法高亮放开选词。

**验证**

- `npm.cmd run build`：已通过。

**已知问题 / 下一步**

- 个别 iOS / WebView 上选词手势仍可能不稳定；若反馈多，可再补语法详情内「从本句选词」入口。

### 2026-05-13 — 阅读页高亮与重叠说明文档

**本次完成**

- 新增 **`docs/READING_HIGHLIGHTS_AND_OVERLAPS.md`**：整理正文「单字符单一高亮色」、词汇 / 语法 / AI / 用户 / 已掌握锚点的优先级、先词后句与先句后词时的视觉表现、已掌握词默认不高亮与按需定位、语法高亮内继续标生词的当前限制与产品方向，以及给维护者的 Cursor「Run / 允许」说明（无法在仓库内替用户关闭 IDE 逐步确认）。
- **`docs/PRD.md` §8.0**：增加指向上述文档的交叉引用。
- **`README.md`**：文档索引中增加该说明链接。
- **`src/lib/articleReadingModel.ts`**：`buildRunsFromReadingItems` 上方补充 JSDoc，指向同一文档。

**当前项目状态**

- 产品行为未改；仅文档与代码注释便于后续用户手册摘编与开发对齐。

**验证**

- `npm.cmd run build`：已通过。

**已知问题 / 下一步**

- 语法块内选区标词若需桌面 / 手机分策略，仍待实现后再更新 PRD 与本说明文档。

### 2026-05-13 — 已掌握词默认不高亮

**本次完成**

- **`src/components/InteractiveArticleReader.tsx`**：已掌握词汇在正文中默认不再显示绿色 / 琥珀色常驻高亮，也不再显示 hover 发音 tooltip；视觉上接近普通正文。
- 已掌握词仍保留原文定位锚点：从右侧 **已掌握词汇** 折叠区、词汇卡片 occurrence 或总词库来源链接进入时，仍可滚动到原文位置并短暂 ring / flash。
- **`src/lib/articleReadingModel.ts`**：已掌握词汇锚点优先级降到最低，避免不可见的已掌握词覆盖仍需显示的语法或其它学习中高亮。

**当前项目状态**

- 学习中词汇继续常驻高亮；已掌握词默认减少阅读干扰，但可按需回溯定位。
- 本次未改语法高亮、暂忽略策略、AI 保存、词库状态管理或数据库结构。

**验证**

- `ReadLints`：相关文件无 linter errors。
- `npm.cmd test`：已通过（3 个测试文件、5 个测试）。
- `npm.cmd run build`：已通过。
- Vercel Production 部署：已通过，并已 alias 到 `https://german-reading-coach.vercel.app`。

**已知问题 / 下一步**

- 可在手机和桌面分别验证：已掌握词正文不显色；从已掌握折叠区或总词库点击仍能定位并短暂闪烁。

### 2026-05-13 — 深度笔记剪贴板内容清理

**本次完成**

- **`src/lib/text/normalizeDeepNoteMarkdown.ts`**：保存深度笔记前清除从 ChatGPT / 手机剪贴板复制内容中可能带来的空字符、控制字符、零宽字符与不间断空格，避免 Postgres `text` 字段保存失败。
- **`src/lib/text/normalizeDeepNoteMarkdown.test.ts`**：新增回归测试，覆盖 AI 笔记中的 Markdown 标记与不可见字符清理。
- **`src/components/InteractiveArticleReader.tsx`**：深度笔记保存过程补充异常捕获，若浏览器 / 网络 / Supabase 抛出异常，会在卡片内显示错误。

**当前项目状态**

- 手机端从 ChatGPT 复制单词或语法深度笔记后，再从剪贴板读取并保存时，会先做更严格的文本清理。
- 若错误提示为 **「深度笔记字段尚未添加」**，仍需在 Supabase SQL Editor 执行 **`supabase/fixes/008_learning_item_deep_notes.sql`**。

**验证**

- `ReadLints`：相关文件无 linter errors。
- `npm.cmd test -- normalizeDeepNoteMarkdown`：已通过。
- `npm.cmd test`：已通过（3 个测试文件、5 个测试）。
- `npm.cmd run build`：已通过。
- Vercel Production 部署：已通过，并已 alias 到 `https://german-reading-coach.vercel.app`。

**已知问题 / 下一步**

- 需要部署到 Production 后，在真实 iPhone Safari + ChatGPT 复制内容路径上复测。

### 2026-05-12 — 移动端高亮触摸交互优化

**本次完成**

- **`src/components/InteractiveArticleReader.tsx`**：为四类可点击原文高亮（系统词汇、用户词汇、系统语法、用户语法）添加移动端触摸保护样式：`user-select: none`、`-webkit-user-select: none`、`-webkit-touch-callout: none`、`touch-action: manipulation`。
- 高亮仍使用原有 `<button>`，保留键盘可访问性；触摸 / 手写笔 `pointerdown` 时阻止 iPhone Safari 原生文字选择 / 复制 / 搜索菜单，并打开现有词汇或语法详情。
- 阅读正文容器仍保留 `select-text`，普通正文可继续正常选择文字；未改高亮颜色、左右定位、右侧面板、移动端详情抽屉、AI、保存、词库或语法库逻辑。

**当前项目状态**

- 移动端点击已保存高亮词 / 语法片段时，应优先进入应用内详情交互，而不是弹出 Safari 系统文字菜单。
- 桌面端点击、hover tooltip 与键盘访问沿用原行为。

**验证**

- `ReadLints`：`src/components/InteractiveArticleReader.tsx` 无 linter errors。
- `npm.cmd test`：已通过（2 个测试文件、4 个测试）。
- `npm.cmd run build`：已通过。
- Vercel Production 部署：已通过，并已 alias 到 `https://german-reading-coach.vercel.app`。

**已知问题 / 下一步**

- 仍需在真实 iPhone Safari 上手测长按 / 点击行为；若个别 iOS 版本仍弹系统菜单，再追加更窄范围的 touch fallback。

### 2026-05-12 — AI 候选保存前整理

**本次完成**

- **`src/app/articles/[id]/page.tsx`**：真实 AI 分析生成后，预览区的词汇 / 语法从纯展示改为可整理的 **AI 候选清单**。
- 保存前可对单个 AI 候选执行 **删除候选**，或将状态改为 **学习中 / 已掌握 / 暂忽略**。
- 一键保存时只写入仍保留的 AI 候选，并把保存前选择的状态一起写入 `vocabulary_items.mastery_status` / `grammar_items.mastery_status`。
- 摘要与阅读问题仍随保存写入文章记录；若用户删除全部词汇或语法候选，仍可保存摘要与阅读问题。
- 保留原有阅读页高亮、左右定位、已保存条目的状态下拉菜单、删除 occurrence、摘要 / 阅读问题 Tab 等交互；本次未改 `InteractiveArticleReader`。

**当前项目状态**

- AI 结果仍不会自动入库；用户可先整理候选，再一键保存。
- 保存后条目继续进入原有右侧学习面板，并沿用原有高亮与状态管理逻辑。

**验证**

- `ReadLints`：`src/app/articles/[id]/page.tsx` 无 linter errors。
- `npm.cmd test`：已通过（2 个测试文件、4 个测试）。
- `npm.cmd run build`：已通过。
- `npm.cmd run lint`：本次文件中的 React Compiler 依赖提示已修复；项目级 lint 仍被既有问题阻塞：`scripts/*.cjs` 的 `require()` 规则、`src/app/articles/page.tsx` 与 `src/app/dashboard/page.tsx` 的删除回调依赖提示、`src/app/import/page.tsx` 的 `hasPaste` 未使用警告。

**已知问题 / 下一步**

- 候选整理仍在 AI 预览区内完成；后续若需要，可再评估把未保存候选直接融合到右侧词汇 / 语法 Tab 中。
- 项目级 lint 需要单独 cleanup；本次按用户要求未扩散修改其它页面功能。

### 2026-05-12 — Chrome 插件通用大字号标题扫描

**本次完成**

- **`browser-extension/chrome-mv3/background.js`**：标题候选扩展为扫描页面所有可见的大字号 / 粗体文字块，不再只依赖 `h1`、`h2`、`class/title/headline` 等结构化标记。
- **`src/app/import/page.tsx`**：插件传入的标题只要是合理文章标题，就优先于正文解析出的短标题，避免 URL / 面包屑短标题覆盖页面视觉大标题。
- **`browser-extension/chrome-mv3/manifest.json`**：插件版本更新到 `0.1.5`。

**当前项目状态**

- 面向 Tages-Anzeiger 这类站点，标题提取优先靠用户实际看到的视觉大标题。
- 未改阅读页、AI、词库、语法库与数据库结构。

**验证**

- `node --check`：`background.js`、`app-import-bridge.js` 已通过。
- `npm.cmd test -- cleanArticleText`：已通过。
- `ReadLints`：插件、导入页与同步文档无 linter errors。
- `npm.cmd run build`：已通过。
- Vercel Production 部署：已通过，并已 alias 到 `https://german-reading-coach.vercel.app`。

**已知问题 / 下一步**

- 若某站点标题由多段视觉元素拼接，仍可能需要站点特定规则。

### 2026-05-12 — Chrome 插件可见大标题修正

**本次完成**

- **`browser-extension/chrome-mv3/background.js`**：标题提取不再只看 `h1` / `meta`，改为扫描页面可见标题候选，并按字号、字重、位置、标签与 URL 相关性评分，优先选择用户在页面上看到的大标题。
- **`src/app/import/page.tsx`**：插件草稿同时包含正文解析标题与插件标题时，如果插件标题明显更完整，则优先使用插件标题，避免正文第一行短标题覆盖页面大标题。
- **`browser-extension/chrome-mv3/manifest.json`**：插件版本更新到 `0.1.4`，方便本地确认已刷新。

**当前项目状态**

- 针对 Tages-Anzeiger 这类页面，标题应优先保存页面视觉大标题，而不是面包屑 / URL / `meta` 短标题。
- 未改阅读页、AI、词库、语法库与已保存文章展示逻辑。

**验证**

- `node --check`：`background.js`、`app-import-bridge.js` 已通过。
- `npm.cmd test -- cleanArticleText`：已通过。
- `ReadLints`：插件、导入页与同步文档无 linter errors。
- `npm.cmd run build`：已通过。
- Vercel Production 部署：已通过，并已 alias 到 `https://german-reading-coach.vercel.app`。

**已知问题 / 下一步**

- 如果某个站点把真正标题拆成多个视觉块，仍可能需要继续按站点结构微调。

### 2026-05-12 — Chrome 插件标题优先级修正

**本次完成**

- **`browser-extension/chrome-mv3/background.js`**：标题提取改为优先使用页面可见 `h1`；当只有一个 `h1` 时直接采用，多个 `h1` 时再用 URL slug 相关性挑选，`meta` / Twitter 标题只作为无可用 `h1` 时的兜底。
- **`browser-extension/chrome-mv3/manifest.json`**：插件版本更新到 `0.1.3`，方便本地确认已刷新。

**当前项目状态**

- 修正 Tages-Anzeiger 等站点把面包屑 / URL 短标题保存为文章标题的问题。
- 未改阅读页、AI、词库、语法库与保存后的文章展示逻辑。

**验证**

- `node --check`：`background.js`、`app-import-bridge.js` 已通过。
- `npm.cmd test -- cleanArticleText`：已通过。
- `ReadLints`：插件与同步文档无 linter errors。
- `npm.cmd run build`：已通过。

**已知问题 / 下一步**

- 如个别站点存在多个 `h1` 且真实标题不在第一个，仍需按站点结构继续微调；用户也可在导入页保存前手动覆盖标题。

### 2026-05-12 — Chrome 插件提取范围与尾部清理修正

**本次完成**

- **`browser-extension/chrome-mv3/background.js`**：改进插件正文提取逻辑，不再简单取第一个 `article` / `main`；改为从多个候选区域中按正文段落密度、标题匹配度与 URL slug 相关性评分，减少导入 newsletter、栏目导航等杂项。
- 标题选择优先可信 `h1`，再用 URL slug 相关性兜底，避免面包屑 / 页面短标题覆盖真实标题。
- 导入正文会尝试从选中的文章标题处裁剪，去掉标题前的页面杂项。
- 插件端优先抽取 `h1` 与正文段落 `p`，跳过 newsletter、related/recommend、author/profile、share/social、comment 等容器，减少正文前后不相干内容混入。
- **`src/lib/text/cleanArticleText.ts`**：新增导入文本尾部截断兜底；当正文已有足够长度后遇到相关阅读、Newsletter、作者简介、评论等尾部信号时截断，避免保存原文结束后的推荐卡片。
- **`src/lib/text/cleanArticleText.test.ts`**：新增 Tages-Anzeiger 风格回归样例，确认正文保留、尾部相关阅读 / Newsletter / 作者介绍 / 评论被移除。
- **`src/app/import/page.tsx`**：插件草稿同时带标题和正文时，优先采用正文解析出的标题，避免插件候选标题误覆盖真实正文首行标题。
- **`browser-extension/chrome-mv3/manifest.json`**：插件版本更新到 `0.1.2`，方便本地确认已刷新。
- **`browser-extension/chrome-mv3/README.md`**：补充本地插件更新方式。
- **`README.md`**、**`docs/PRD.md`**、**`PROJECT_STATUS.md`**：同步插件正文范围与尾部清理策略。

**当前项目状态**

- 插件仍只读取用户当前浏览器里已经可见的内容，不绕过登录墙或付费墙。
- `/import` 保存流程、阅读页、AI、词库、语法库均未改动。

**验证**

- `node --check`：`background.js`、`app-import-bridge.js` 已通过。
- `npm.cmd test -- cleanArticleText`：已通过。
- `ReadLints`：插件、导入页、清理器与回归测试无 linter errors。
- `npm.cmd run build`：已通过。
- Vercel Production 部署：已通过，并已 alias 到 `https://german-reading-coach.vercel.app`。

**已知问题 / 下一步**

- 不同新闻站 HTML 结构差异较大；如果仍有个别站点识别不准，用户可先选中正文再点击插件导入，后续再按站点补充规则。

### 2026-05-12 — Chrome 插件导入 MVP

**本次完成**

- **`browser-extension/chrome-mv3/manifest.json`**：新增 Chrome Manifest V3 插件定义，包含工具栏按钮、右键菜单、当前页脚本执行权限与导入页桥接脚本。
- **`browser-extension/chrome-mv3/background.js`**：点击插件按钮或右键菜单 **「导入到 German Reading Coach」** 时，从当前页面读取用户已可见的标题、URL、来源、发布时间与正文；若用户已选中文本，则优先导入选中文本。
- **`browser-extension/chrome-mv3/app-import-bridge.js`**：导入页打开后，从插件本地存储读取草稿并通过 `window.postMessage` 发送给 Web App。
- **`src/app/import/page.tsx`**：新增插件草稿消息入口，接收草稿后自动切到手动粘贴、填入标题 / URL / 来源 / 发布时间 / 正文，并刷新保存前预览。
- **`browser-extension/chrome-mv3/README.md`**：记录本地加载插件步骤、使用方式与合规边界。
- **`docs/PRD.md`**、**`README.md`**、**`PROJECT_STATUS.md`**：同步 Chrome 插件 MVP 与 `/import` 预填能力。

**当前项目状态**

- 服务端 URL 抓取仍只用于公开可访问页面。
- 对登录页、会员页、付费墙页面，插件只读取用户浏览器中已经合法展示的内容，不绕过访问控制。
- 插件 MVP 当前为本地加载版，后续可再做图标、打包发布与更多站点正文识别优化。

**验证**

- `ReadLints`：`src/app/import/page.tsx`、插件文件与同步文档无 linter errors。
- `npm.cmd run build`：已通过。
- Vercel Production 部署：已通过，并已 alias 到 `https://german-reading-coach.vercel.app`。

**已知问题 / 下一步**

- 正文提取优先使用选中文本，其次使用 `<article>` / `<main>` / `body.innerText`；个别站点可能需要用户先选中正文再导入。
- 当前不自动保存文章；仍进入 `/import` 由用户确认预览、阅读水平与保存。

### 2026-05-11 — 两层阅读水平

**本次完成**

- **`src/app/settings/page.tsx`**：默认阅读水平从静态展示改为可编辑设置，登录后读取 / 创建当前用户 `profiles`，并将选择保存到 **`profiles.self_selected_level`**。
- 设置页新增用户向规则提示：默认阅读水平只用于调节阅读辅助强度，不代表完整 CEFR 能力评定。
- **`src/app/import/page.tsx`**：导入页进入后自动读取当前账户默认阅读水平并带入本篇；用户仍可在保存前临时修改本篇水平。
- 保存文章逻辑继续把本篇实际使用的水平写入 **`articles.user_level_at_analysis`**。
- **`/articles/[id]`** 已经基于文章记录中的 **`user_level_at_analysis`** 展示、运行真实 AI 分析和 enrich，本次未改该页逻辑。
- **`docs/PRD.md`**、**`README.md`**、**`PROJECT_STATUS.md`**：同步“两层阅读水平”产品规则。

**当前项目状态**

- 账户层：设置页保存默认阅读水平。
- 文章层：导入页可按篇临时修改，保存后本篇水平固定在文章记录中。
- 阅读 / AI 层：使用文章记录中的水平，不随之后默认值变化而改写旧文章。

**验证**

- `ReadLints`：`src/app/settings/page.tsx`、`src/app/import/page.tsx` 与同步文档无 linter errors。
- `npm.cmd run build`：已通过。

**已知问题 / 下一步**

- 当前只实现默认阅读水平；解释语言等其它账户偏好仍为展示项，后续可按同样模式逐步接入。

### 2026-05-11 — 设置页移除 Supabase 测试入口

**本次完成**

- **`src/app/settings/page.tsx`**：从普通设置页移除 **「测试 Supabase 连接」** 链接及“读取 profiles 表，不写入数据”说明。
- **`/settings/supabase-test`** 页面本身暂时保留为隐藏诊断页，方便后续排查连接、RLS 或环境变量问题时直接访问。
- **`README.md`**、**`PROJECT_STATUS.md`**：同步设置页不再展示 Supabase 排障入口。

**当前项目状态**

- `/settings` 只展示学习者可理解的设置项和发音测试，不暴露 Supabase / profiles 等实现细节。

**验证**

- `ReadLints`：`src/app/settings/page.tsx` 与同步文档无 linter errors。
- `npm.cmd run build`：已通过。

**已知问题 / 下一步**

- 诊断页仍可直接访问；如后续确认不再需要，可再决定删除路由与相关文档。

### 2026-05-11 — 设置页去字段名

**本次完成**

- **`src/app/settings/page.tsx`**：移除设置页中直接展示的内部字段名：
  - `self_selected_level`
  - `estimated_reading_level`
  - `explanation_language`
  - `autoPlayPronunciationOnClick`
- 设置页顶部说明从“演示数据 / 本地写入”改为用户向说明：“调整阅读水平、解释语言和发音相关选项。”
- 发音自动播放说明去掉 Mock / 后续版本等实现表述，改为当前用户能理解的说明。
- **`README.md`**、**`PROJECT_STATUS.md`**：同步设置页当前状态。

**当前项目状态**

- `/settings` 面向普通学习者展示设置含义，不再暴露数据库或本地存储字段名。

**验证**

- `ReadLints`：`src/app/settings/page.tsx` 无 linter errors。
- `npm.cmd run build`：已通过。

**已知问题 / 下一步**

- `/settings/supabase-test` 仍是偏排障的连接测试页面；如后续继续产品化，可从普通设置页弱化或移动到开发/诊断入口。

### 2026-05-11 — 顶栏账户头像

**本次完成**

- **`src/components/AuthNav.tsx`**：登录后顶栏账户入口从文字 **「账户」** 改为圆形小人头像按钮，点击进入账户页；按钮保留 `aria-label` / `title`，可提示当前邮箱。
- 旁边 **「退出」** 入口保持可见，避免把退出操作藏进二级菜单。
- **`README.md`**、**`PROJECT_STATUS.md`**：同步当前顶栏账户入口状态。

**当前项目状态**

- 未登录时仍显示 **登录 / 注册 / 账户** 入口。
- 已登录时显示头像按钮 + 退出按钮。

**验证**

- `ReadLints`：`src/components/AuthNav.tsx` 无 linter errors。
- `npm.cmd run build`：已通过。

**已知问题 / 下一步**

- 当前头像按钮不是下拉菜单；后续若需要更像常见网站，可扩展为点击头像打开「账户 / 设置 / 退出」菜单。
- 本次不新增依赖，不改认证逻辑。

### 2026-05-11 — 文章库分页

**本次完成**

- **`src/app/articles/page.tsx`**：新增完整文章库页面，读取当前登录账户的全部已保存文章，按保存时间倒序分页显示；每页 10 篇，底部提供页码、上一页、下一页与省略号分页。
- 文章库支持从列表继续阅读，也支持删除文章；删除逻辑与仪表盘一致：删除本文 `articles` 与本文 occurrences，保留长期词汇/语法主记录。
- **`src/app/dashboard/page.tsx`**：最近文章仍保持概览定位，只显示最近 10 篇，并新增 **「查看全部文章」** 入口。
- **`src/components/AppShell.tsx`**、**`src/app/page.tsx`**：顶栏与首页新增文章库入口。
- **`docs/PRD.md`**、**`README.md`**、**`PROJECT_STATUS.md`**：同步文章库分页能力与当前项目状态。

**当前项目状态**

- 仪表盘用于概览；完整文章管理入口为 **`/articles`**。
- 超过 10 篇文章后，旧文章不再只停留在数据库中不可见，可通过文章库分页继续访问。

**验证**

- `ReadLints`：`src/app/articles/page.tsx`、`src/app/dashboard/page.tsx`、`src/app/page.tsx`、`src/components/AppShell.tsx` 无 linter errors。
- `npm.cmd run build`：已通过，构建输出包含 **`/articles`** 路由。

**已知问题 / 下一步**

- 文章库当前先做分页和删除；搜索、等级筛选、时间筛选可作为下一步增强。
- 本次不改数据库 schema，不新增依赖。

### 2026-05-11 — Dashboard 真实统计

**本次完成**

- **`src/app/dashboard/page.tsx`**：顶部三张统计卡从演示数字改为当前账户真实数据：
  - **本周保存**：本周一以来保存的文章数。
  - **学习中词汇**：`vocabulary_items.mastery_status` 为 `new` / `learning` / `familiar` 的词汇数。
  - **语法点**：当前账户语法条目总数。
- 删除文章成功后会重新读取统计，避免卡片数字停留在旧状态。
- **`docs/PRD.md`**、**`README.md`**、**`PROJECT_STATUS.md`**：同步仪表盘当前能力。

**验证**

- `ReadLints`：`src/app/dashboard/page.tsx` 与同步文档无 linter errors。
- `npm.cmd run build`：已通过。

**已知问题 / 下一步**

- 本周保存按浏览器本地周一 00:00 计算；后续如需要可增加更完整的阅读进度字段（如已读 / 完成）。
- 本次只改统计口径与展示，不改数据库 schema。

### 2026-05-11 — 首页用户向精简

**本次完成**

- **`src/app/page.tsx`**：移除首页顶部“登录后可使用云端真实数据…”说明，以及已登录邮箱 / 云端已保存文章数量摘要。
- 删除未再使用的 **`src/components/HomeOverview.tsx`**。
- **`src/app/page.tsx`** 首页入口卡片去掉 `Supabase`、`Mock`、本地保存等偏实现说明，改为用户向文案。
- **`src/components/AppShell.tsx`**：全站页脚从“固定 Mock / Supabase 云端数据”改为产品向一句话。
- **`README.md`**、**`PROJECT_STATUS.md`**：同步首页当前状态。

**验证**

- `ReadLints`：无报错。
- `npm.cmd run build`：已通过。
- Vercel Production 部署：已通过；线上首页旧文案检查为 0。

**已知问题 / 下一步**

- 本次只清理首页与页脚。仍可继续逐页检查偏开发说明，例如导入错误提示、文章页开发工具说明、设置 / Supabase 测试页等。

### 2026-05-11 — 真实文章高亮图例补齐

**本次完成**

- **`src/app/articles/[id]/page.tsx`**：真实文章页传入 `legendMode="full"`，使左侧 **高亮含义** 与 `/articles/mock` 一致展示四项说明：绿色系统词汇、琥珀用户/确认词汇、蓝色系统语法、紫色用户语法。
- **`docs/PRD.md`**、**`README.md`**、**`PROJECT_STATUS.md`**：同步真实文章阅读页高亮图例行为。

**验证**

- `ReadLints`：无报错。
- `npm.cmd run build`：已通过。
- Vercel Production 部署：已通过。

**已知问题 / 下一步**

- 本次只统一图例说明，不改变任何高亮颜色、AI 分析、保存或定位逻辑。

### 2026-05-11 — `/import` 保存按钮位置调整

**本次完成**

- **`src/app/import/page.tsx`**：将 **保存文章** 按钮从德语阅读水平卡片中移到 **保存前预览** 正文下方，使保存动作紧贴将被保存的文章内容。
- **德语阅读水平**选择保留在保存按钮之后，作为后续设置项；保存逻辑、校验、Supabase 写入与跳转不变。
- **`docs/PRD.md`**、**`README.md`**、**`PROJECT_STATUS.md`**：同步导入页流程与当前状态。

**验证**

- `ReadLints`：无报错。
- `npm.cmd run build`：已通过。
- Vercel Production 部署：已通过。

**已知问题 / 下一步**

- 当前仍保持原有保存行为：点击保存会使用保存前预览文本与当前选择的德语阅读水平。

### 2026-05-11 — `/import` 移除清理详情

**本次完成**

- **`src/app/import/page.tsx`**：移除导入页底部 **「清理详情」** 折叠区，不再向普通用户展示识别项、字符数与删行统计。
- 清理统计相关前端 state 一并删除；**正文清理、标题自动填充、发布时间自动填充、保存前预览、可选来源信息与保存逻辑不变**。
- **`docs/PRD.md`**、**`README.md`**、**`PROJECT_STATUS.md`**：同步导入页用户界面规则、当前项目状态、已知问题与下一步建议。

**验证**

- `ReadLints`：无报错。
- `npm.cmd run build`：已通过。
- Vercel Production 部署：已通过。

**已知问题 / 下一步**

- 清理调试信息不再在普通 UI 展示；后续若需要排障，可考虑只在开发环境提供开发工具入口。

### 2026-05-11 — 状态操作改为下拉菜单

**本次完成**

- **`src/components/InteractiveArticleReader.tsx`**：阅读页与演示课文的词汇/语法卡片底部，将 **学习中 / 已掌握 / 暂忽略** 状态操作从显眼按钮组改为轻量下拉菜单；**删除**保持独立按钮，继续表示“从本文移除 occurrence”，不等于掌握或忽略。
- **`src/app/vocabulary/page.tsx`**、**`src/app/grammar/page.tsx`**：总词库与总语法库卡片将顶部原状态徽章直接替换为状态下拉菜单，并移除底部状态操作行，保留原有 Supabase 持久化逻辑与“保存中”提示。
- **`docs/PRD.md`**、**`README.md`**、**`PROJECT_STATUS.md`**：同步用户向语义、页面能力、当前状态、已知问题与下一步建议。
- 已部署到 **Vercel Production**，正式地址仍为 [`https://german-reading-coach.vercel.app`](https://german-reading-coach.vercel.app)。

**验证**

- `ReadLints`：无报错。
- `npm.cmd run build`：已通过。
- Vercel remote build：已通过。
- 2026-05-11 追加调整：`/vocabulary` 与 `/grammar` 已将顶部状态徽章位置直接改为下拉菜单，并移除底部状态行；`ReadLints` 无报错，`npm.cmd run build` 与 Vercel Production 部署已通过。

**已知问题 / 下一步**

- 状态下拉仍使用浏览器原生 select；后续如需要更统一的视觉表现，可抽象为共享 UI 组件。
- 本次不改状态枚举、数据库 schema、RLS、AI 推荐逻辑或删除语义。

### 2026-05-11 — Vercel Production 首次部署

**本次完成**

- 通过 **Vercel CLI** 创建并链接项目：`nonger-zhous-projects/german-reading-coach`。
- 将本地 `.env.local` 中的 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`OPENAI_API_KEY` 上传到 **Vercel Production** 环境。
- 完成 Production 部署，正式地址：[`https://german-reading-coach.vercel.app`](https://german-reading-coach.vercel.app)；部署 inspect 地址：[`https://vercel.com/nonger-zhous-projects/german-reading-coach/6KZ2dPysa4gx4GPLhuJNvtvYhFVw`](https://vercel.com/nonger-zhous-projects/german-reading-coach/6KZ2dPysa4gx4GPLhuJNvtvYhFVw)。
- **README.md**、**PROJECT_STATUS.md** 同步线上地址、当前状态、已知后续与下一步建议。

**验证**

- 本地 `npm.cmd run build`：已通过。
- Vercel remote build：已通过。
- 线上首页 `https://german-reading-coach.vercel.app`：HTTP `200`，页面标题为 `German Reading Coach`。

**已知问题 / 下一步**

- 需在 Supabase **Authentication → URL Configuration** 中将生产域名加入 **Site URL** 与 **Redirect URLs**，至少包含 `https://german-reading-coach.vercel.app/auth/recovery` 与站点回跳路径。
- 继续跑线上完整流程自检：登录 / 注册、重置密码、`/settings/supabase-test`、导入短文、AI 分析与保存。

### 2026-05-09 — dev：Next 经 `--use-system-ca` 启动（TLS / 代理证书）

**本次完成**

- 新增 **`scripts/next-dev-use-system-ca.cjs`**：在 Node **20.19+**、**22.9+**（及更高主版本）下以 **`node --use-system-ca …/next dist/bin/next dev`** 启动；若 **`NODE_OPTIONS`** 已含 **`--use-system-ca`** 则不再重复注入；过低版本回退为普通 **`next dev`** 并 stderr 提示升级。
- **`package.json`**：**`dev`**、**`dev:clean`** 改为经上述脚本启动。
- **`.env.example`**、**`README.md`**、**`docs/PERSONAL_USE_CHECKLIST.md`**：说明与 **unable to verify the first certificate** / 系统证书库的关系。

**验证**

- `npm run build`：已通过。

### 2026-05-09 — OpenAI：代理 env + undici 失败回退原生 fetch

**本次完成**

- **`createServerOpenAIClient`**：支持 **`OPENAI_HTTPS_PROXY`**（优先）、**`HTTPS_PROXY` / `https_proxy`**，经 **undici `ProxyAgent`**；**undici `fetch` 失败**时再试 **Node 原生 `globalThis.fetch`**。
- **`formatOpenAIRouteErrorMessage`**：展开多层 **`cause`**；对 **fetch failed** 等在无代理 env 时追加**配置代理**的简短说明。
- **`.env.example`**、**`docs/PERSONAL_USE_CHECKLIST.md`**：文档化代理。

**验证**

- `npm run build`：已通过。

### 2026-05-09 — Vercel 部署文档与 npm 脚本

**本次完成**

- 新增 **`docs/DEPLOY_VERCEL.md`**：Dashboard 导入 Git、环境变量表、Supabase **Redirect URLs / Site URL**、CLI (`npx vercel` / `--prod`)、**`maxDuration`** 与套餐说明、上线自检。
- **`package.json`**：`vercel`、`vercel:prod` 脚本（内部 `npx vercel`）。
- **`README.md`**：部署章节与文档索引；**`docs/PERSONAL_USE_CHECKLIST.md`**：§7 线上部署。
- **`PROJECT_STATUS.md`**：未完成项中 Vercel 表述更新。

**验证**

- `npm run build`：已通过。

### 2026-05-09 — `/vocabulary`：今日词汇记录（§12.5 NEW / 再遇）

**本次完成**

- **`src/app/vocabulary/page.tsx`**：**「今日」** Tab 更名为 **今日词汇记录**，筛选 = 本地自然日内 **`vocabulary_items` 首次创建** 或 当日 **`vocabulary_occurrences`** 有写入（与 PRD 一致）。
- **标签**：**新增**（当日新建主词条且当日 occurrence 仅来自至多一篇文章）· **再遇**（库中已有词条当日在新文章再次出现，或当日≥2 篇文章出现）。
- Tab 下方展示 **新增生词 n · 再次遇到 m** 计数；**昨日 / 近三日 / 本周** 与本周复盘卡逻辑**未改**。
- **`docs/PRD.md`**：§12.5 实现状态、§9 **`/vocabulary`** 行同步。

**验证**

- `npm run build`：已通过。

### 2026-05-09 — PRD §12.5：总词库「今日」NEW / REPEAT 规则（文档）

**本次完成**

- **`docs/PRD.md`**：新增 **§12.5**（今日 = 用户本地自然日；NEW = **`vocabulary_items` 当日首次创建**；REPEAT = **当日新 `vocabulary_occurrences`**；同日多文与并发合并；词性分主词条；语法库对齐；来源累积与定位）；原 §12.5–§12.7 顺延为 **§12.6–§12.8**（删除文章为 **§12.8**）。§9 **`/vocabulary`** 行与 **§12.6** 学习价值一处交叉引用已更新。
- **`docs/DATABASE.md`**：表用途归纳指向 **§12.5**。
- **`README.md`**：索引补充 **§12.5**，删除文章改为 **§12.8**。

**实现状态**

- **`/vocabulary` UI 尚未**按本节拆分「新增 / 再次遇到」，见 PRD §12.5「实现状态」。

**验证**

- `npm run build`：文档-only；可按惯例执行。

### 2026-05-09 — 阅读页： occurrence 定位闪光更易辨认

**本次完成**

- **`InteractiveArticleReader`**：右侧点击 occurrence 后左侧对应词的 **flash** 去掉 **`animate-pulse`**（脉冲低谷时 ring 几乎消失），改为 **不透明 amber ring + ring-offset + 外发光 shadow**，深浅色主题均提高对比。

**主要修改文件**

- `src/components/InteractiveArticleReader.tsx`

**验证**

- `npm run build`：已通过。

### 2026-05-09 — 链接导入：相邻段去重 + 省略与首段重复的 meta 摘要

**本次完成**

- **`pickBodyText`**：对 **`article` / 全局 `p`** 收集的段落先做 **相邻近重复合并**（词 Jaccard + 前缀/子串启发），减轻瑞士等媒体 **Lead 与正文首段两次出现** 的重复。
- **`importArticleFromUrl`**：若 **`og:description` / meta description** 与正文 **第一段** 高度重叠，则 **不再写入** `buildRawInputForCleaner` 的 excerpt 行，避免解析后仍重复；返回对象的 **`excerpt`** 仍保留原始 meta 供预览元数据。

**主要修改文件**

- `src/lib/import/importFromUrl.ts`

**验证**

- `npm run build`：已通过。

### 2026-05-09 — OpenAI 服务端：undici IPv4 + 错误 cause 透出（修复「Connection error.」）

**本次完成**

- 新增 **`src/lib/openai/createServerOpenAIClient.ts`**：**`dns.setDefaultResultOrder("ipv4first")`**，OpenAI SDK 使用 **undici `fetch` + `Agent`（`connect.family: 4`）**，与链接导入思路一致，减轻 Windows 上访问 **`api.openai.com`** 的默认连接失败。
- **可选 TLS 放宽**：**`ALLOW_INSECURE_OPENAI_TLS=1`**；本地 **`next dev`** 下若已设 **`ALLOW_INSECURE_IMPORT_TLS=1`**，亦会对 OpenAI 连接放宽（仅可信网络；生产慎用）。
- **`/api/analyze-article`、`/api/enrich-vocabulary`、`/api/enrich-grammar`**：统一改用 **`createServerOpenAIClient`**；catch 中用 **`formatOpenAIRouteErrorMessage`** 拼接 **`error.cause`**，避免界面只显示笼统的 **Connection error.**。
- **`/api/analyze-article`**：**`maxDuration`** **120 → 180**，与客户端 **180s** 超时对齐。
- 依赖：显式增加 **`undici`**（与 cheerio 同主版本线）。

**主要修改文件**

- `src/lib/openai/createServerOpenAIClient.ts`（新）
- `src/app/api/analyze-article/route.ts`
- `src/app/api/enrich-vocabulary/route.ts`
- `src/app/api/enrich-grammar/route.ts`
- `package.json`、`.env.example`
- `README.md`、`PROJECT_STATUS.md`、`docs/PERSONAL_USE_CHECKLIST.md`

**验证**

- `npm run build`：已通过。

**已知问题**

- 若仍失败，多为 **代理 / 防火墙 / 系统证书**；优先 **`NODE_EXTRA_CA_CERTS`** 指向企业根证书，其次再考虑 **`ALLOW_INSECURE_OPENAI_TLS`**。

### 2026-05-09 — 链接导入：Node `http(s)` 主通道 + IPv4 优先 + `import-url` 300s

**本次完成**

- **`importArticleFromUrl`**：优先使用 **`node:http` / `node:https`**（**`Agent` 强制 IPv4**）、**`dns.setDefaultResultOrder("ipv4first")`**，减轻 Windows 上 undici/fetch 对境外 HTTPS 长时间挂起；手动跟随最多 **8** 次 **3xx** 重定向；TLS 与既有 **`mayRelaxTlsForImport`** 一致（**`rejectUnauthorized`**）。
- **回退**：仅当主通道抛出 **`timeout`** 或 **`fetch_failed`** 时，再走 **`fetchHtmlForImport` + `res.text()`** 管线。
- **`POST /api/import-url`**：**`maxDuration`** **120 → 300**，避免 Vercel 等平台在正文仍下载时提前中断路由。

**主要修改文件**

- `src/lib/import/importFromUrl.ts`
- `src/app/api/import-url/route.ts`

**验证**

- `npm run build`：已通过。

**已知问题**

- 个别机器 **Node 与系统 HTTPS 信任链不一致** 时，仍可能需 **`ALLOW_INSECURE_IMPORT_TLS=1`**（生产慎用）或改 **手动粘贴**；**Supabase** 从 API 路由发起的 TLS 问题见历史 **`routeFromBearer`** / **`NODE_EXTRA_CA_CERTS`** 记录。

**下一步建议**

- 若 **`enrich-*`** 仍因本机校验 Supabase 证书失败，可单独文档化 **`NODE_EXTRA_CA_CERTS`** 或与导入对齐的 dev 宽松策略（须严格限定条件）。

### 2026-05-09 — 链接导入：响应头与正文分段超时

**本次完成**

- **`importArticleFromUrl`**：收到 **`Response` 后立即清除**「整段抓取」`Abort` 计时器，再 **`res.text()`**；正文单独 **120s** 上限，避免首包已返回但大 HTML 仍在传输时被旧逻辑整体判超时。
- **undici `Agent`**：设置 **`headersTimeout` / `bodyTimeout`** 与上两阶段对齐；头阶段 **90s**。

**验证**

- `npm run build`：已通过。

### 2026-05-09 — 链接导入：本地 dev 对 https 直走 undici（避免 Node fetch 挂满超时）

**本次完成**

- **`fetchHtmlForImport`**：在 **`NODE_ENV !== "production"`**（或 **`ALLOW_INSECURE_IMPORT_TLS=1`**）且 URL 为 **`https://`** 时，**不再先调用** 原生 `fetch`，直接使用 **undici + `rejectUnauthorized:false`**，避免 Windows 下原生 TLS 长时间挂起导致 **`import-url` 整段 45s/60s 后超时返回 400**。
- 总超时 **60s**（略延长）。
- **`README.md`** 同步说明。

**验证**

- `npm run build`：已通过。

### 2026-05-09 — 链接导入超时与 AI API 限时（稳定性，少动结构）

**本次完成**

- **`importFromUrl`**：抓取 **`AbortSignal` 超时** 由 **12s → 45s**（避免境外新闻站首包/HTML 较慢时误报「抓取超时」）；去掉 **Sec-Fetch-*** / **sec-ch-ua**（仅保留 UA + Accept + 语言），减少部分 CDN/WAF 异常慢响应风险；保留 **TLS 失败时 undici 重试**。
- **`/api/import-url`、`/api/analyze-article`、`/api/enrich-vocabulary`、`/api/enrich-grammar`**：增加 **`export const maxDuration = 120`**（部署平台支持时延长服务端允许运行时间）。
- **OpenAI 客户端**：**`analyze-article`** `timeout: 180_000`、`maxRetries: 1`；**enrich** 路由 `timeout: 120_000`、`maxRetries: 1`，减少长时间无响应。

**验证**

- `npm run build`：已通过。

### 2026-05-09 — 开发启动：`dev:clean` 释放 3000 端口（避免双进程看错站）

**本次完成**

- 新增 **`scripts/free-dev-port.cjs`**（无额外 npm 依赖）：Windows 用 **netstat + taskkill**、Unix 用 **lsof + kill** 结束监听 **3000** 的进程，再启动 **`next dev`**，避免「旧服务占 3000、新服务跑 3001」导致非技术用户始终打开旧页面。
- **`package.json`** 脚本 **`dev:clean`**：`node scripts/free-dev-port.cjs && next dev`。
- **`README.md`**、**`docs/PERSONAL_USE_CHECKLIST.md`**：推荐日常 **`npm run dev:clean`** / **`npm.cmd run dev:clean`**，并说明务必以终端 **Local** 地址为准。

**验证**

- `npm run build`：已通过。

### 2026-05-09 — 链接导入：Windows/Node TLS 校验失败自动重试（20min.ch 等）

**本次完成**

- **原因**：部分站点在 **浏览器**（系统证书库）可打开，但 **Node `fetch`** 使用自带 CA 时出现 **`UNABLE_TO_VERIFY_LEAF_SIGNATURE`**，与付费墙无关；原错误被统一映射成「站点拒绝抓取」易误解。
- **`importFromUrl`**：补充 **Sec-Fetch-*** / **sec-ch-ua**；在 **`NODE_ENV !== "production"`**（本地 `next dev`）下，若首次请求仅因 TLS 校验失败，则使用 **undici**  **`rejectUnauthorized: false`** 再试一次；生产环境需显式 **`ALLOW_INSECURE_IMPORT_TLS=1`**（见 **`.env.example`**）。
- **`/import`**：新增错误码 **`tls_verify_failed`** 的明确中文说明。
- **`.env.example`**：文档化 **`ALLOW_INSECURE_IMPORT_TLS`**。

**验证**

- `npm run build`：已通过。

### 2026-05-09 — 首页文案与链接导入抓取头（澄清真实数据 / 降低拒抓）

**本次完成**

- **首页**：去掉「全部为 Phase 1 Mock」的误导表述；卡片说明区分 **Supabase 真实能力** 与 **`/articles/mock` 演示课文**；新增 **`HomeOverview`**（已登录时展示云端文章篇数摘要）。
- **顶栏 / 页脚**：「阅读 (Mock)」改为 **「演示课文」**；页脚说明仅演示课文为 Mock，登录后词库等为云端数据。
- **链接导入**：**`importFromUrl`** 对公开 HTML 使用**接近桌面 Chrome** 的 **`User-Agent` / `Accept-Language`**，减轻部分新闻站对自定义爬虫 UA 的 **403**（仍不绕过付费墙或登录）。
- 文案对齐：**`dashboard` / `import` / `articles/[id]`** 等处「Mock 阅读页」统一为 **「演示课文」**（路由仍为 **`/articles/mock`**）。

**主要修改文件**

- `src/app/page.tsx`、`src/components/HomeOverview.tsx`、`src/components/AppShell.tsx`
- `src/lib/import/importFromUrl.ts`
- `src/app/dashboard/page.tsx`、`src/app/import/page.tsx`、`src/app/articles/[id]/page.tsx`
- `README.md`、`PROJECT_STATUS.md`

**验证**

- `npm run build`：已通过。

### 2026-05-09 — 登录/注册后回跳目标页（`next`）

**本次完成**

- 新增 **`src/lib/auth/post-auth-redirect.ts`**：校验查询参数 **`next`**（仅允许同源相对路径、排除 `/login` / `/signup` / `/auth/recovery`，防止开放重定向）；无有效 **`next`** 时登录/注册成功后落地 **`/`**。
- 新增 **`src/lib/auth/use-auth-entry-hrefs.ts`**：按当前路由与已有 **`next`** 生成 **`loginHref` / `signupHref`** 及 **`postAuthRedirect`**。
- **`/login`**、**`/signup`**：成功登录或注册（立即有 session）后 **`router.push(postAuthRedirect)`**；两页互相跳转时保留 **`next`**。
- **`AuthNav`** 与需登录占位页（**`/dashboard`**、**`/import`**、**`/vocabulary`**、**`/grammar`**、**`/account`**、**`/articles/[id]`**）的「去登录」链接携带 **`next`**（当前 path + query）。
- 使用 **`useSearchParams`** 的页面与 **`AuthNav`** 按 Next 要求增加 **`Suspense`** 边界。

**主要修改文件**

- `src/lib/auth/post-auth-redirect.ts`、`src/lib/auth/use-auth-entry-hrefs.ts`
- `src/app/login/page.tsx`、`src/app/signup/page.tsx`
- `src/components/AuthNav.tsx`
- `src/app/account/page.tsx`、`src/app/dashboard/page.tsx`、`src/app/import/page.tsx`、`src/app/vocabulary/page.tsx`、`src/app/grammar/page.tsx`、`src/app/articles/[id]/page.tsx`
- `docs/PRD.md`、`README.md`、`PROJECT_STATUS.md`

**当前项目状态**

- 行为对齐常见产品：**从受保护页进入登录/注册 → 成功后回到该页**；直接打开登录/注册且无有效 **`next`** → **`/`**。

**已知问题 / 限制**

- 未实现「整站中间件统一重定向并附带 **`next`**」；当前依赖各页入口链接与顶栏 **`AuthNav`** 传参。

**验证**

- `npm run build`：已通过。

### 2026-05-09 — 登录成功后跳转首页

**本次完成**

- 文件：`src/app/login/page.tsx`。
- 登录成功由 **`/account`** 改为跳转 **`/`**（首页），更符合常见产品预期；`ensureUserProfile` 等仍在首次使用业务页时按需触发。

**验证**

- `npm run build`：已通过。

### 2026-05-09 — 忘记密码与邮件重置落地页（`/auth/recovery`）

**本次完成**

- `src/lib/supabase/client.ts`：`createClient` 启用 **`detectSessionInUrl`**，便于从邮件链接的 URL hash 恢复会话。
- `src/components/AuthRecoveryHashBanner.tsx` + `src/components/AppShell.tsx`：若邮件将用户带回首页且 hash 含 **`error_code` / `error_description`**（如 **`otp_expired`**），顶部显示中文说明；若 hash 含 **`access_token`**，自动跳到 **`/auth/recovery`** 完成设密。
- `src/app/auth/recovery/page.tsx`：重置密码表单（新密码 + 确认）；解析 hash 错误并提示重新发邮件。
- `src/app/login/page.tsx`：**忘记密码**折叠区，调用 **`resetPasswordForEmail`**，`redirectTo` 指向 **`/auth/recovery`**。
- `docs/PRD.md`：补充 **`/auth/recovery`** 与登录页忘记密码说明；`docs/PERSONAL_USE_CHECKLIST.md`：Redirect URLs 配置说明；`README.md`：认证能力摘要。

**已知问题 / 限制**

- 邮件链接为**一次性且有时效**；邮箱「安全预览」可能提前消耗链接导致 **`otp_expired`**，需重新发送并重试。

**验证**

- `npm run build`：已通过。

### 2026-05-09 — 登录/注册页用户向文案（去掉 Supabase 品牌露出）

**本次完成**

- 文件：`src/app/login/page.tsx`、`src/app/signup/page.tsx`。
- 将「登录 Supabase 账户」「由 Supabase Auth 校验」等改为面向学习者的说明（登录后可访问文章与词库等）；注册页副标题与卡片说明同步，**不**改 Auth 逻辑与路由。

**验证**

- `npm run build`：已通过。

### 2026-05-08 — 阅读页词汇统计口径修正（生词去重、全文不去重）

**本次完成**

- 文件：`src/components/InteractiveArticleReader.tsx`。
- 按用户确认口径调整本篇词汇统计：
  - **全文总词数**：按文章 token 总次数统计，**不去重**；
  - **生词数**：按词条 token 统计，**去重**（同词多次出现算 1）；
  - **暂忽略**（`ignored`）**计入生词**；
  - **已掌握**（`mastered`）、已删除（已不在本文卡片）、未标注词不计入生词。
- 词汇区统计文案同步改为：
  - `生词数（去重，含暂忽略）`
  - `全文总词数（不去重）`
  - `生词占比`

**需求文档同步**

- `docs/PRD.md` 路线图补充：
  - 下阶段需求预留 **拍照读取文章（OCR）**；
  - 固定上述词汇统计口径。
- `README.md` 同步当前统计口径说明。
- `PROJECT_STATUS.md` 同步最近更新。

**当前项目状态**

- 阅读页已具备更贴近学习感知的生词占比统计（分母为全文总词次数，分子为去重生词数）。

**已知问题 / 限制**

- 当前词边界按字母词正则切分（含德语变音与 `-` / `'`），不做词形还原与更复杂 NLP 分词。

**下一步建议**

- 后续可增加“口径提示”悬浮说明，帮助用户快速理解“全文不去重、生词去重”。

**验证**

- 待本次统一构建校验。

### 2026-05-06 — /import 标题区下移到链接导入之后

**本次完成**

- 文件：`src/app/import/page.tsx`。
- 将“文章标题”卡片从导入方式之后调整为位于“链接导入/手动粘贴”区块之后。
- 标题说明文案改为“自动抓取优先，手动覆盖为辅”，匹配真实操作顺序：
  1. 先导入 URL；
  2. 自动抓取标题；
  3. 仅在抓取不到或希望自定义标题时手动填写。

**产品说明同步**

- `docs/PRD.md`：`/import` 路由描述补充“标题区位于链接导入后、自动抓取优先”。
- `README.md`：导入能力说明同步上述流程。
- `PROJECT_STATUS.md`：最近更新新增本条。

**当前项目状态**

- `/import` 的默认交互顺序已与“URL 自动抓取优先”的产品策略一致。

**已知问题 / 限制**

- 本次仅调整布局与文案，不改抓取 API 与保存链路。

**下一步建议**

- 可进一步在标题输入框旁增加“恢复自动标题”按钮（可选）。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-06 — 语法库对齐词库：时间分组 Tab + 本周复盘卡

**本次完成**

- 文件：`src/app/grammar/page.tsx`。
- 语法库页新增时间分组 Tab（今日/昨日/近三日/本周），按 `grammar_items.created_at` 分组。
- 新增本周复盘小卡（本周新增/学习中/已掌握/暂忽略），并支持点击联动筛选：
  - 点击 `本周新增`：切到本周 + 全部状态；
  - 点击 `学习中/已掌握/暂忽略`：切到本周 + 对应状态。
- 语法列表新增“学习时间”显示，来源文章缺失时显示“原文已被用户删除”。

**产品说明同步**

- `docs/PRD.md`：补充语法库时间分组与复盘卡能力。
- `README.md`：语法库能力说明补充本条。
- `PROJECT_STATUS.md`：当前状态、页面说明、最近更新同步本条。

**当前项目状态**

- 词库与语法库已具备一致的“时间分组 + 本周复盘 + 联动筛选”结构。

**已知问题 / 限制**

- 当前统计口径基于条目创建时间，不代表本周复现频次。

**下一步建议**

- 为语法库补充“近 7 天复现次数”统计，强化复习优先级判断。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-06 — 词库复盘小卡点击联动筛选

**本次完成**

- 文件：`src/app/vocabulary/page.tsx`。
- 本周复盘小卡改为可点击联动：
  - 点击 `本周新增`：切换到 `本周` 时间分组并清空状态筛选；
  - 点击 `学习中`：切换到 `本周` + 状态 `学习中`；
  - 点击 `已掌握`：切换到 `本周` + 状态 `已掌握`；
  - 点击 `暂忽略`：切换到 `本周` + 状态 `暂忽略`。
- 不改现有搜索、等级筛选与数据读取逻辑。

**产品说明同步**

- `README.md`：词库能力补充“复盘小卡点击联动筛选”。
- `PROJECT_STATUS.md`：最近更新新增本条。

**当前项目状态**

- 词库页已支持“时间分组 + 复盘小卡 + 点击联动筛选”组合流程。

**已知问题 / 限制**

- 联动仅作用于前端筛选状态，不写入用户偏好。

**下一步建议**

- 为小卡增加“当前已激活”视觉态，便于用户识别筛选来源。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-06 — 词库本周复盘小卡（新增/学习中/已掌握/暂忽略）

**本次完成**

- 文件：`src/app/vocabulary/page.tsx`。
- 在词库时间分组 Tab 上方新增本周复盘小卡，展示四项统计：
  - `本周新增`
  - `学习中`
  - `已掌握`
  - `暂忽略`
- 统计口径与时间分组一致：按 `vocabulary_items.created_at` 归入本周。

**产品说明同步**

- `README.md`：词库能力说明补充“本周复盘小卡”。
- `PROJECT_STATUS.md`：页面说明与最近更新同步本条。

**当前项目状态**

- 词库页已形成“本周概览 + 时间分组 + 状态/等级筛选”的复盘结构。

**已知问题 / 限制**

- 统计基于词条创建时间，不表示该词条在本周的复现频次。

**下一步建议**

- 增加“近 7 天复现次数”维度，用于补齐“新增”与“复现”的双视角。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-06 — 词库时间分组 Tab（今日 / 昨日 / 近三日 / 本周）

**本次完成**

- 文件：`src/app/vocabulary/page.tsx`。
- 词库页新增时间分组 Tab：
  - `今日单词`
  - `昨日单词`
  - `近三日单词`
  - `本周单词`
- 分组依据：`vocabulary_items.created_at`（词条进入总词库时间）。
- 每个 Tab 显示分组数量；保留原有搜索、状态筛选与等级筛选，并与时间分组叠加生效。
- 列表信息补充“学习时间”字段，便于用户按时间复盘。

**产品说明同步**

- `docs/PRD.md`：补充词库时间分组 Tab 已实现。
- `README.md`：词库能力说明补充时间分组 Tab。
- `PROJECT_STATUS.md`：当前状态、页面说明、最近更新同步本条。

**当前项目状态**

- 词库页已具备“按时间复盘 + 按状态/等级筛选”的组合视图。

**已知问题 / 限制**

- 当前按词条入库时间分组，不区分词条在不同文章中的多次复现时间（复现维度可后续扩展）。

**下一步建议**

- 增加“近 7 日/近 30 日”扩展分组与周复盘统计卡片。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-06 — 外部深入解释常驻提示文案改为“自动复制深度学习 Prompt”

**本次完成**

- 文件：`src/components/InteractiveArticleReader.tsx`。
- 词汇/语法卡「外部深入解释」常驻提示统一改为：
  - `提示：点击后会自动复制深度学习 Prompt，可在外部页面直接 Ctrl+V 粘贴发送。`
- 仅调整文案，不改按钮逻辑与跳转顺序。

**产品说明同步**

- `docs/PRD.md`：`§1.4.1` 外部深入解释提示文案同步更新。
- `README.md`：能力说明中的外部深入解释提示文案同步更新。
- `PROJECT_STATUS.md`：最近更新新增本条。

**当前项目状态**

- 外部深入解释流程仍为：点击后复制 Prompt + 打开外部页面；
- 文案强调“自动复制 + 深度学习 Prompt”。

**已知问题 / 限制**

- 该改动仅是用户可见文案调整；不涉及 API、数据库、权限策略。

**下一步建议**

- 若后续需要，可区分词汇/语法两套更具体的提示文案（当前保持统一）。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-06 — Phase 4.1 增量：删除轻提示 + 词库来源删除态文案

**本次完成**

- 文件：`src/app/dashboard/page.tsx`、`src/app/vocabulary/page.tsx`。
- ` /dashboard ` 最近文章删除成功后，新增轻提示（`已删除：文章标题`）。
- `/vocabulary` 来源文章区在“来源链接不存在但该词有历史出现次数”时，显示 **`原文已被用户删除`**，避免来源显示空白或误解为无来源。

**产品说明同步**

- `README.md`：同步 dashboard 轻提示与词库来源删除态文案。
- `PROJECT_STATUS.md`：最近更新新增本条。

**当前项目状态**

- 删除文章入口已覆盖文章页与 dashboard 列表；
- 词库来源在文章删除后有明确用户向文案。

**已知问题 / 限制**

- 来源删除态文案基于“无可跳转来源 + 有历史出现次数”判断；第一版不追溯展示已删除文章的原标题。

**下一步建议**

- 后续可增加“来源文章历史快照标题”（删除前写入冗余字段）以显示更细粒度来源历史。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-06 — Phase 4.1 增量：Dashboard 最近文章支持直接删除

**本次完成**

- 文件：`src/app/dashboard/page.tsx`。
- 在「最近保存的文章」每一行新增 **删除** 按钮（保留原有点击标题进入阅读页行为）。
- 删除流程与文章页一致：确认后依次删除本文 `vocabulary_occurrences`、`grammar_occurrences`、`articles`。
- 删除成功后在当前列表即时移除该条，无需刷新页面。

**产品说明同步**

- `docs/PRD.md`：`/dashboard` 页面描述补充“列表内直接删除文章”。
- `README.md`：`/dashboard` 能力说明同步本条。
- `PROJECT_STATUS.md`：可访问页面与最近更新同步本条。

**当前项目状态**

- 文章删除入口已覆盖：
  - `/articles/[id]`（文章页入口）
  - `/dashboard` 最近文章列表（快捷入口）

**已知问题 / 限制**

- 与 Phase 4.1 v1 保持一致：默认仅删除文章与 occurrences，长期词汇/语法主记录保留。

**下一步建议**

- 增加删除后的轻提示（toast）与“最近一次删除”操作记录（便于回溯）。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-06 — Phase 4.1：删除文章 v1（不改既有功能）

**本次完成**

- 文件：`src/app/articles/[id]/page.tsx`。
- 在已保存文章页新增 **删除文章** 入口（保留既有阅读/AI/导入行为不变）。
- 删除流程（确认后）：
  1. 删除 `vocabulary_occurrences` 中该 `article_id` 的记录；
  2. 删除 `grammar_occurrences` 中该 `article_id` 的记录；
  3. 删除 `articles` 中该文章记录；
  4. 成功后跳转回 `/dashboard`。
- 失败时在页面展示错误信息，便于定位权限或数据异常。

**产品说明同步**

- `docs/PRD.md`：`§1.4.1`、`§9`、`§10` 同步 Phase 4.1 已落地（删除文章 v1）。
- `README.md`：更新“当前能力”“未完成项”“/articles/[id] 说明”。
- `PROJECT_STATUS.md`：版本、当前状态、可访问页面、最近更新同步本条。

**当前项目状态**

- `/import` 链接导入与手动粘贴双模式保持不变；
- `/articles/[id]` 在原有学习与 AI 能力基础上，新增文章级删除能力（v1）。

**已知问题 / 限制**

- 第一版仅删除文章与本文 occurrences；长期 `vocabulary_items` / `vocabulary_senses` / `grammar_items` 默认保留（符合 PRD `§12.8`（删除文章））。
- 暂无“删除后恢复”与“孤儿主记录清理”能力（后续迭代项）。

**下一步建议**

- 在 `/dashboard` 增加文章管理入口（列表删除、筛选与搜索）；
- 评估“仅本篇唯一来源条目”的可选清理策略与确认层级。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-06 — /import 模式操作按钮视觉联动

**本次完成**

- 文件：`src/app/import/page.tsx`。
- 导入模式切换后，操作区与当前模式联动高亮：
  - 选 **链接导入** 时，**抓取文章** 按钮高亮；
  - 选 **手动粘贴** 时，**重新整理** 按钮高亮。
- 本轮增强：
  - 选 **链接导入** 时，URL 输入框边框与背景同步高亮；
  - 选 **手动粘贴** 时，粘贴文本框边框与背景同步高亮；
  - **重新整理** 按钮不再因空文本禁用，避免视觉变灰导致“未联动”误解。
- 高亮风格与顶部模式切换按钮保持一致（绿色主色系）。

**产品说明同步**

- `README.md`：`/import` 说明新增“模式对应操作按钮高亮”。
- `PROJECT_STATUS.md`：最近更新新增本条。

**未做**

- 未改抓取逻辑、保存链路、阅读页、AI 逻辑、数据库 schema 与 RLS。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-06 — /import 默认“链接导入”与标题策略调整

**本次完成**

- 文件：`src/app/import/page.tsx`。
- 导入方式默认从“手动粘贴”改为“链接导入”。
- 标题说明调整为：标题必填，但用户未手填时优先用自动抓取/识别结果；用户手填后可覆盖且不再被自动覆盖。
- 导入页顶部说明同步为“优先链接抓取，失败再切手动粘贴”。

**产品说明同步**

- `docs/PRD.md`：`/import` 路由描述补充“默认链接导入 + 标题自动抓取优先、手填可覆盖”。
- `README.md`：导入能力与 `/import` 说明同步上述策略。
- `PROJECT_STATUS.md`：页面列表与最近更新同步本条。

**未做**

- 未改 API 抓取逻辑、保存链路、阅读页、AI 逻辑、数据库 schema 与 RLS。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-06 — 外部深入解释提示可见性增强（常驻提示条）

**本次完成**

- 文件：`src/components/InteractiveArticleReader.tsx`。
- 将词汇/语法「外部深入解释」区的常驻提示从小灰字改为高对比提示条（边框 + 背景 + 强调色），降低用户忽略概率。
- 点击后的反馈文案颜色同步增强，保持“已复制，可直接 Ctrl+V 粘贴并发送”可读性。

**未做**

- 未改跳转与复制核心逻辑、AI 分析/保存链路、数据库 schema 与 RLS。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-06 — 外部深入解释修复：恢复“先复制再跳转”

**问题与修复**

- 用户反馈：点击外部 AI（ChatGPT/Claude/Gemini/DeepSeek）后，出现“跳转但剪贴板无 Prompt”与“跳转不稳定”。
- 修复文件：`src/components/InteractiveArticleReader.tsx`。
- 调整为稳定顺序：**先 `navigator.clipboard.writeText(prompt)`，再 `window.open(...)`**。
- 去除二次确认弹窗路径，保留直接跳转行为。
- 在词汇/语法两处“外部深入解释”区块增加常驻提示：
  - **“点击后会先复制 Prompt，可在外部页面直接 Ctrl+V 粘贴发送。”**

**未做**

- 未改 AI 分析、保存链路、数据库 schema、RLS、外部站点自动填充。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-06 — 外部深入解释：取消二次确认，点击后直接跳转

**本次完成**

- 文件：`src/components/InteractiveArticleReader.tsx`。
- 移除“跳转外部 AI 前确认弹窗”；点击 ChatGPT/Claude/Gemini/DeepSeek 后直接跳转。
- 为减少“点击确认后不跳转”的问题，将 `window.open(...)` 前移到用户点击事件链内，再执行剪贴板写入，降低被浏览器弹窗策略拦截概率。
- 保留并统一提示文案：**“Prompt 已复制，可直接 Ctrl+V 粘贴并发送。”**；若新页被拦截，提示检查浏览器弹窗拦截。

**产品说明同步**

- `docs/PRD.md`：从“跳转前确认”改为“直接跳转 + 页内粘贴提示”。
- `README.md`：能力描述同步为直接跳转。
- `PROJECT_STATUS.md`：最近更新改写为本条行为。

**未做**

- 未改 AI 分析、保存链路、数据库 schema、RLS、外部站点自动填充行为。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-06 — 外部深入解释：跳转前提醒与可直接粘贴提示

**本次完成**

- 文件：`src/components/InteractiveArticleReader.tsx`。
- 在词汇/语法卡「外部深入解释」按钮（ChatGPT / Claude / Gemini / DeepSeek）中，改为：
  1. 先复制 Prompt 到剪贴板；
  2. 跳转前弹确认提示（说明已复制，可直接 `Ctrl+V` 粘贴发送）；
  3. 用户确认后再打开外部站点。
- 通知文案统一为：**“Prompt 已复制，可直接 Ctrl+V 粘贴并发送。”**

**产品说明同步**

- `docs/PRD.md`：在阅读页外部深入解释规则中补充“跳转前确认提醒”。
- `PROJECT_STATUS.md`：最近更新新增本条。
- `README.md`：能力清单补充跳转前粘贴提示。

**未做**

- 未改 AI 分析、保存链路、数据库 schema、RLS、外部站点自动填充行为。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-06 — Phase 4.0 增量：抓取失败提示与手动粘贴兜底

**本次完成**

- 文件：`src/app/import/page.tsx`。
- URL 导入错误提示改为更明确的用户文案（按错误码映射）：
  - 站点拒绝抓取 / 可能需要登录（会员墙常见）
  - URL 无效、超时、正文提取失败等场景
- 当链接导入失败时，新增兜底按钮：
  - **「切换到手动粘贴（保留当前链接）」**
  - 用户不需重填 URL，即可改走手动粘贴流程。

**产品说明同步**

- `docs/PRD.md`：补充 `/import` 页面与 Phase 4 的失败兜底规则；Phase 7 增加插件阶段“浏览器登录上下文抓取”方向。
- `PROJECT_STATUS.md`：补充当前状态、下一步建议与最近更新。
- `README.md`：补充链接导入失败兜底说明与插件阶段计划。

**未做**

- 未改 schema / RLS / 阅读页核心逻辑 / AI 分析与保存链路 / 词汇语法与定位逻辑。

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-06 — Phase 4.0：URL 自动导入文章（`/import` + `/api/import-url`）

**本次完成**

- 新增服务端 URL 导入 API：**`POST /api/import-url`**（`src/app/api/import-url/route.ts`）。
- 新增抓取与解析模块：**`src/lib/import/importFromUrl.ts`**（`http/https` 校验、超时与错误码、服务端抓取 HTML、标题/来源/发布时间/正文提取、复用 `parseArticleFromRawInput` 清理）。
- 更新 **`/import`**（`src/app/import/page.tsx`）为两种模式：
  - **手动粘贴**（原有流程保留）
  - **链接导入**（输入 URL → 抓取文章 → 预览 → 保存文章）
- 保存逻辑仍复用既有 `buildArticleInsertRow` + Supabase `articles` 插入与跳转 **`/articles/[id]`**，未改阅读页与 AI 链路。

**实现要点（对齐 Phase 4.0 约束）**

- 抓取在服务端完成，前端不直接抓第三方网页（规避 CORS 与暴露抓取逻辑）。
- 正文提取优先 HTML 结构（`article` / `main article` / `[role="article"]` / `main` / 常见 `p` / `body` fallback）。
- 标题优先级：`h1` > `og:title` > `twitter:title` > `title`。
- 发布时间优先级：`time[datetime]` > `article:published_time` > JSON-LD `datePublished` > 明显发布时间文本。
- 来源优先级：`og:site_name` > `application-name` > hostname。
- URL 抓取与正文清理均**不调用 OpenAI**，不会产生 AI 成本。

**未做（按范围约束）**

- 未改阅读页核心逻辑、AI 分析与保存逻辑、手动添加/补充解释、外部深入解释、occurrence/高亮/左右定位、状态语义、全局词库/语法库。
- 未改 Supabase schema、未改 RLS SQL、未改 Chrome 插件、未改 Mock 分析。

**主要修改文件**

- `src/app/import/page.tsx`
- `src/app/api/import-url/route.ts`
- `src/lib/import/importFromUrl.ts`
- `package.json` / `package-lock.json`（新增依赖 `cheerio`）
- `docs/PRD.md`
- `PROJECT_STATUS.md`
- `README.md`

**验证**

- `npm.cmd run build`：已通过。

### 2026-05-05 — 仅文档：删除文章未来设计规则（PRD §12.7）

**范围**

- **`docs/PRD.md`**：新增 **§12.7 删除文章（未来产品规则）**——区分文章级数据与长期 **`vocabulary_items` / `grammar_items`**；删除 **`articles`**、摘要与阅读问题、该篇全部 **`vocabulary_occurrences` / `grammar_occurrences`**；不默认删除 items/senses；第一版保守保留仅单篇出现的主记录；后续可选清理/可选联动删除/归档；附删除确认文案建议。
- **`PROJECT_STATUS.md`**：**未完成** 增加「删除已保存文章」并指向 §12.7；**最近更新** 本条。
- **`README.md`**：PRD 索引与「未完成」一行指向 §12.7。

**未做**

- **未改**代码、数据库 schema、RLS SQL。

**验证**

- **`npm.cmd run build`**：已通过（仅文档变更后健康检查）。

### 2026-05-02 — Phase 3.7：学习项状态语义与「已掌握默认折叠」

**目标**

- 仅整理文章页状态文案与显示方式：默认状态文案从 **「新」** 改为 **「学习中」**；操作按钮 **「掌握」** 改为 **「已掌握」**；终态恢复按钮改为 **「恢复为学习中」**。
- 在词汇/语法面板增加简短说明：**学习中：保留并可继续推荐；已掌握：保留但以后少推荐；删除：从本文移除。**
- 单篇文章右侧列表：**学习中（非 mastered）** 默认主列表；**`mastered`** 默认折叠到 **「已掌握词汇（n）」/「已掌握语法（n）」** 区域，可展开查看；被选中已掌握项时自动展开对应折叠区，保持定位体验。

**实现**

- 文件：**`src/components/InteractiveArticleReader.tsx`**。
- 新增学习中/已掌握分组与折叠开关（仅展示层）；不改底层 **`mastery_status`** 值与保存 API。
- 删除语义与逻辑保持 **Phase 3.6**：删除仍为从当前文章移除，不等于已掌握。

**未改**

- Supabase schema / RLS / OpenAI route / prompt / 真实 AI 保存逻辑 / 手动添加与 enrich 逻辑 / occurrence 生成与统计 / 左右定位与 hover 高亮 / `/import` / `/dashboard` / Mock 分析。

**构建**：**`npm.cmd run build`**：已通过。

### 2026-05-02 — PRD：§5.1–§5.3 学习中 / 已掌握 / 删除（仅文档）

**内容**：**`docs/PRD.md`** 新增 **§5.1**（产品语义：学习中、已掌握、删除；与 **`mastery_status`**、**忽略** 区分）、**§5.2**（未来用户手册示例文案）、**§5.3**（单篇文章页右侧：学习中优先、已掌握折叠区、删除不展示）；并注明 **Phase 3.6** 当前实现与「总词库主记录」目标可**分阶段收敛**。**`PROJECT_STATUS.md`**、**`README.md`** 索引。**未改**代码、schema、prompt、阅读器 UI。

### 2026-05-02 — PRD：§8.1.1 补充 AI 主动推荐与表达型词汇（仅文档）

**内容**：在 **`docs/PRD.md` §8.1.1** 合并——**AI 全文分析**不单推单词，须覆盖短语/搭配/固定表达/介词与动词搭配/可分动词/新闻表达等八类示例；推荐目标（CEFR 阻碍理解、用户难自划选、主旨与细节、新闻复用）；**统一进词汇 Tab**、未来 **`item_type`** 中文标签；**可分动词**主动推荐示例；预留 **`occurrence_sentence`**、**`explanation`** 等与第一版「仍归 vocabulary item」原则。**§13.1** 增加与 §8.1.1 对齐句。**`PROJECT_STATUS.md`** 同步。**未改**代码、schema、prompt、阅读器 UI。

### 2026-05-02 — PRD：长文本选区「添加为词汇」设计原则（仅文档）

**背景**：用户可能选中较长片段后点 **「加入词库」**，意图常为**词汇/表达层面**（含短语、搭配、可分动词等），**非**默认按整句语法处理。

**记录位置**：**`docs/PRD.md` §8.1.1**（Lexical item 广义、与「标记语法」分工、未来 **`item_type`** / **`expression_type`** 与 AI 返回字段、可分动词示例、第一版仍仅两按钮）。**`PROJECT_STATUS.md`**、**`README.md`** 增加索引句。

**未改**：代码、数据库 schema、OpenAI prompt、阅读器 UI。

### 2026-05-02 — Phase 3.6：文章页学习项「删除」（与「忽略」区分）

**语义**

- **忽略（ignored）**：不想继续学，**记录仍保留**，可恢复；**`mastery_status`** 更新；适合「已会」或「暂不学」。
- **删除（remove）**：误添加、重复或错误保存，**从本文移除**；**`DELETE`** 该文章下该条目的 **全部 occurrence**（**`vocabulary_occurrences` / `grammar_occurrences`**，条件 **`user_id` + `article_id` + `vocabulary_item_id` / `grammar_item_id`**）；**不删** **`vocabulary_items` / `grammar_items`**（及 senses），**不影响**其它文章中的 occurrence。

**实现**

- **`deleteArticleVocabularyItemOccurrences`**（**`src/lib/supabase/vocabulary.ts`**）、**`deleteArticleGrammarItemOccurrences`**（**`src/lib/supabase/grammar.ts`**）。
- **`InteractiveArticleReader`**：列表与详情 **掌握 / 忽略 / 恢复** 旁 **「删除」**；**`window.confirm`** 文案：**确定从本文删除这个学习项吗？这不会表示你已掌握，只是移除误添加的项目。** 失败 **`emitPersistError`**（**`formatSupabaseOrUnknownError`**），**不清空**列表；成功则从 state 移除该卡并清除选中。无 **`dbItemId`** 或**未**开启持久化时仅本地移除。
- **未改**：OpenAI、Mock、schema、RLS、occurrence **生成**与统计公式、高亮定位、**`/import`**、**`/dashboard`**、摘要/阅读问题。

**构建**：**`npm.cmd run build`**：已通过。

### 2026-05-02 — Phase 3.5：文章页 AI 状态整理（Mock 降级为开发工具）

**目标**

- **`/articles/[id]`** **AI 区域**以**真实 OpenAI** 为主流程：主按钮 **`AI 分析本文`**（无预览）/ **`查看 AI 预览`**（有预览）；状态行（**`aria-live`**）：**尚未分析**、**已生成 AI 预览，尚未保存**、**AI 分析结果已保存**（会话已保存或 **`articles`** 已有摘要/阅读问题字段）、**分析中…**、**重新分析中…**、**保存中…**、**OpenAI API 错误**；**重新分析（会再次调用 OpenAI）** 保留；固定文案 **重新分析会再次调用 OpenAI 并产生 API 成本。**
- **Mock 分析**：仅在 **`process.env.NODE_ENV === "development"`** 时渲染；置于默认收起的 **「开发工具」**折叠区（**`<details>`**）；按钮 **Mock 分析（开发用）** + 说明 **不调用 OpenAI，仅用于开发测试 UI**。**Mock 不再写入 Supabase**（不写 **`ai_mock`** 词条）；仅存 **`mockStaging` / `aiAnalysisExtras`**，与 **`realAiPreview`** 分离；**不**参与 **「保存 AI 结果到词库/语法库」**；**不**覆盖已保存摘要/阅读问题（Tab 优先级仍为 **已持久化** > **`realAiPreview`** > **Mock 本地**）。
- **切换文章 `id`**：重置本页真实 AI / Mock 相关客户端 state，避免跨文章串状态。
- **错误展示**：**`/api/analyze-article`** 返回的 **`error.message`** 非字符串时走 **`formatSupabaseOrUnknownError`**；支持 **`error`** 为字符串。

**未改**：**`POST /api/analyze-article`**、OpenAI prompt、真实 AI 结果 schema、**`handleSaveRealAiPreview`**（词汇/语法与摘要/问题保存）、手动词条与 **enrich** API、**Supabase schema**、**RLS** SQL、**occurrence** / 高亮 / 左右定位、掌握状态、**`/import`**、**`/dashboard`**、Auth、**`/articles/mock`**。

**涉及文件**：**`src/app/articles/[id]/page.tsx`**。

**文档**：**`DEVELOPMENT_LOG.md`**、**`PROJECT_STATUS.md`**、**`README.md`**。

**构建**：**`npm.cmd run build`**：已通过。

### 2026-05-02 — Phase 3.4：保存文章级 AI 摘要与阅读问题

**目标**

- **`public.articles`**：在用户点击 **保存真实 AI 预览** 时，除既有词汇/语法 **`persistManual*`** 外，**`UPDATE`** **`summary_zh`**、**`summary_de_simple`**、**`reading_questions`**（**`jsonb`** 字符串数组）。新建库见 **`schema.sql`**；**已建库缺列**时执行 **`supabase/fixes/007_article_analysis_fields.sql`**（**`ADD COLUMN IF NOT EXISTS`** **`summary_zh` / `summary_de_simple` / `reading_questions`**，避免 **`42703`**）。**RLS** 不变。
- **阅读页**：**`summaryAndQuestionsForTabs`** 优先级为 **已持久化行** > **`realAiPreview`** > **Mock `aiAnalysisExtras`**；**`setArticle`** 在保存成功后合并摘要字段。首次保存：词汇/语法循环 + 文章 **UPDATE**；**`realAiSavedToLibrary`** 已为 true 时：仅文章 **UPDATE**（不重复插入词汇/语法）。保存按钮在已保存词汇/语法后文案为 **「保存摘要与阅读问题」**，仍可点击以刷新文章级字段。
- **`ArticleRow`** 增加可选 **`reading_questions`**；**`normalizeReadingQuestionsFromDb`** 规范化 Tab 列表。

**未改**：**`POST /api/analyze-article`**、OpenAI prompt、词汇/语法持久化核心逻辑、手动词条与 **enrich** API、**`/import`**、**`/dashboard`**、Auth、**vocabulary/grammar 表**、occurrence 与高亮。

**文档**：**`docs/DATABASE.md`**、**`PROJECT_STATUS.md`**、**`README.md`**。

**构建**：**`npm.cmd run build`**：已通过。

### 2026-05-02 — Fix：`articles.reading_questions` 远程库缺列（42703）

**问题**：Phase 3.4 阅读页 **`select`** **`reading_questions`**，远程 **`articles`** 未跑迁移时报 **`column … does not exist`**。

**处理**：新增 **`supabase/fixes/007_article_analysis_fields.sql`**，**`ADD COLUMN IF NOT EXISTS`** **`summary_zh`**、**`summary_de_simple`**、**`reading_questions`**；文档改指向该文件；**`007_articles_reading_questions.sql`** 仅保留合并说明。**未改**应用业务逻辑、RLS、词汇/语法。

**构建**：**`npm.cmd run build`**：已通过。

### 2026-05-02 — Phase 3.4 验证状态（仅文档，无代码变更）

**前提**：远程 **`public.articles`** 已在 SQL Editor 执行 **`supabase/fixes/007_article_analysis_fields.sql`**，三列存在。

| 验收项 | 状态说明 |
|--------|----------|
| **`articles.summary_zh`** | **schema.sql** 与 **007** 已定义；阅读页 **`select`** 含该列；真实 AI 保存时 **`UPDATE`** 写入。 |
| **`articles.summary_de_simple`** | 同上。 |
| **`articles.reading_questions`**（**`jsonb`**） | 同上；**`normalizeReadingQuestionsFromDb`** 供 Tab 列表解析。 |
| **不再出现 `42703` / `column … reading_questions does not exist`** | 迁移执行后 PostgREST **`select`** 与 **`update`** 与列定义一致即满足。 |
| **摘要 Tab** | 保存真实 AI 预览后展示中文摘要 + 简单德语摘要（及空字段时的空状态）；来源优先级：**已保存行** > **`realAiPreview`** > **Mock**。 |
| **阅读问题 Tab** | 展示 **`reading_questions`** 列表；同上优先级与空状态。 |
| **刷新 / 再次进入文章** | 自 **`articles`** 重新加载，摘要与问题仍显示（以库内为准）。 |
| **词汇/语法保存、高亮、左右定位、掌握/忽略/恢复** | **Phase 3.4** 未改相关模块；与 **Phase 3.4 前**行为一致（回归以人工走查为准）。 |

**构建**：**`npm.cmd run build`**：已通过（本条仅文档）。

### 2026-05-02 — Phase 3.4 学习闭环验证与状态（仅文档，无代码变更）

**产品取舍**：**当前不做**全局词库/语法业务页深化；**优先**保证 **`/articles/[id]`** 核心学习闭环稳定。

**前提（实机验收）**：用户已登录；**`OPENAI_API_KEY`** 已配置（服务端）；远程 **`articles`** 已执行 **`supabase/fixes/007_article_analysis_fields.sql`**；**`vocabulary_*` / `grammar_*`** 表 **GRANT** 已按 **`005` / `006`** 等脚本就绪。

**静态核对（本次任务）**：仓库内存在 **`POST /api/analyze-article`**、**`/api/enrich-vocabulary`**、**`/api/enrich-grammar`**（**`src/app/api/**/route.ts`**）；文章级 **`summary_zh` / `summary_de_simple` / `reading_questions`** 与 **007**、**`docs/DATABASE.md`** 一致；阅读页词汇/语法持久化、Mock、真实 AI 预览与保存、摘要 Tab 优先级、左右联动与 occurrence 等见本文件 **Phase 2.5 / 3.0–3.4** 历史条目。**本次未**在本地执行浏览器端到端或远程库写入。

| 验收项 | 状态记录 |
|--------|----------|
| 真实 **AI** 分析可以运行 | **设计**：**Phase 3.1** **`/api/analyze-article`** + 阅读页入口；**实机**依赖 **API Key** 与网络。 |
| 真实 **AI** 结果可保存到词汇/语法学习面板 | **设计**：**Phase 3.2** 用户确认保存 → **`source = ai`** 写入 **`vocabulary_*` / `grammar_*`**（与预览合并逻辑同历史条目）。 |
| 保存后词汇/语法刷新仍存在 | **设计**：读库重建 **`InteractiveArticleReader`** 数据；**实机**依赖 **RLS + GRANT**。 |
| 手动添加词汇可「补充 **AI** 解释」 | **设计**：**Phase 3.3** **`/api/enrich-vocabulary`** + 阅读器入口（**`needs_ai_enrichment`** 等）。 |
| 手动添加语法可「补充 **AI** 解释」 | **设计**：**Phase 3.3** **`/api/enrich-grammar`** + 阅读器入口。 |
| **`summary_zh`** 保存且刷新后显示 | **设计**：**Phase 3.4** 保存真实 **AI** 时 **`UPDATE articles`**；Tab 优先级 **已保存行** > 预览 > Mock；**实机**依赖 **007** 列存在。 |
| **`summary_de_simple`** 同上 | 同上。 |
| **`reading_questions`** 同上 | 同上；**`jsonb`** 经 **`normalizeReadingQuestionsFromDb`** 展示。 |
| 左侧高亮正常 | **设计**：**Phase 2.5** 起 markers / 全文 occurrence；**实机**走查。 |
| 点击左侧高亮 → 右侧定位正常 | **设计**：**Phase 2.5** **`scrollIntoView` / refs / flash**；见历史「左右联动」条目。 |
| 点击右侧 occurrence → 左侧定位正常 | **设计**：**`data-occurrence-id`** 滚动 + **flash**；见历史「hover / occurrence 定位」条目。 |
| 右侧卡片展开后解释在同一卡片内可见 | **设计**：详情与列表同一 **`InteractiveArticleReader`** 卡片结构（历史 **UI** 条目）。 |
| 掌握 / 忽略 / 恢复正常 | **设计**：**`dbItemId`** + **`UPDATE`** **`mastery_status`**（**Phase 2.5**）；见历史 **mastery** 条目。 |
| **`/import`** 不受影响 | **本次任务**：**未**修改 **`/import`**；导入链路与 **Phase 2.3** 文档一致。 |
| **`/dashboard`** 不受影响 | **本次任务**：**未**修改 **`/dashboard`**。 |

**发现问题（仅列出，本次不修复）**：**无**（未做端到端；若环境缺 **007**、**Key** 或策略，表现以现场为准，不在本条「代码修复」范围）。

**构建**：**`npm.cmd run build`**：已通过（本条仅文档）。

### 2026-05-02 — Bugfix：真实 AI 保存不得保留库内 ai_mock

**问题**：同一 `normalized_key` / 语法键下若先前已由 Mock 写入 **`source = ai_mock`**，`persistManual*` 的 **UPDATE** 未改写 **`source`**，保存真实 AI 后右侧仍显示 Mock 源与 Mock 释义。

**修复**：当 **`item.source === "ai"`** 时，**`vocabulary_items` / `grammar_items`** 的 update 增加 **`source = ai`**、**`needs_ai_enrichment = false`**；语法项同时 **UPDATE `name_zh`** 以同步真实 AI 标题文案。**未改**保存按钮 handler、convert、Mock 按钮、schema。

**说明**：Phase 3.2 仍只持久化真实 AI 的词汇/语法；**summary** / **reading_questions** 仍为预览，后续再定是否入库。

**构建**：**`npm.cmd run build`**：已通过。

### 2026-05-02 — Phase 3.2：真实 AI 预览确认保存到词汇/语法库

**目标**

- **`/articles/[id]`** 真实 AI 预览区增加 **「保存 AI 结果到词库/语法库」**；仍须用户点击保存，**不**自动写库。
- 复用 **`persistManualVocabularyItem` / `persistManualGrammarItem`**；分析项经 **`convertAnalysisResultToArticleItems(..., { itemSource: "ai" })`** + **`finalizeArticleVocabularyItems` / `expandGrammarItemsWithRepeatedSurface`** 与 Mock 路径一致。
- 数据库 **`vocabulary_items` / `grammar_items`** 的 **`source = ai`**，**`needs_ai_enrichment = false`**（schema 原有字段，**未**改 migration）。**`fetchArticleManualVocabulary` / `fetchArticleManualGrammar`** 的 **`source` 过滤** 增加 **`ai`**；阅读页 **`ArticleVocabSource` / `ArticleGrammarSource`** 增加 **`"ai"`**（UI badge 与 **`ai_mock`** 同为「AI 推荐」）。
- **未匹配原文**的 **`surface_form` / `selected_text`**（`listRealAiEntriesWithoutTextMatch`）：不写入对应 occurrence；保存成功后以 **`realAiSaveInfo`** 提示跳过项。
- 保存成功：**`loadAsideLearningData`** + **`asideSnapshotVersion`**；按钮 **「已保存」**；**不**清空预览、**不**重调 OpenAI。失败：**`realAiSaveError`**（`formatSupabaseOrUnknownError`），**不**清空 **`realAiPreview`** 与已有侧栏数据。再次 **OpenAI 分析** 时重置「已保存」状态。

**未改**：OpenAI API route、prompt、Mock 与手动持久化语义核心、`/import`、dashboard、Auth、schema/RLS SQL。

**构建**：**`npm.cmd run build`**：已通过。

### 2026-05-02 — Phase 3.1：OpenAI 服务端分析（预览，不写库）

**目标**

- 新增 **`POST /api/analyze-article`**（**`src/app/api/analyze-article/route.ts`**）：请求体 **`articleId`、`title`、`originalText`、`userLevel`**；**`OPENAI_API_KEY`** 仅服务端，缺失时错误信息 **「OPENAI_API_KEY 未配置」**；成功 **`{ ok: true, analysis, warning? }`**，失败 **`{ ok: false, error }`**。
- **OpenAI**：**`response_format.type = json_schema`**（**`src/lib/articleAnalysis/articleAnalysisJsonSchema.ts`**），与 **`ArticleAnalysisResult`** 对齐；系统/用户提示见 **`src/lib/articleAnalysis/openaiArticleAnalysis.ts`**；正文发送前截断至约 **10 000** 字符（常量 **`OPENAI_ANALYSIS_TEXT_CHAR_LIMIT`**），超长 **`warning`**：**「当前仅分析文章前半部分。」**
- **阅读页**：**`/articles/[id]`** 增加 **「真实 AI 分析测试」**，**`fetch`** 上述 API，**loading / 错误 / 预览** 独立 state；预览区标注 **「预览结果，尚未保存到词库/语法库」**；**不**调用 **`persistManual*`**、**不**改 **`aiStaging` / `aiAnalysisExtras`**、**不**破坏 **「AI 分析本文」** Mock 流。
- **依赖**：**`openai`** npm 包；**`.env.example`** 增加 **`OPENAI_API_KEY`** 说明。

**未改**：**`/import`**、**schema**、**RLS SQL**、手动/Mock 保存与高亮/occurrence/定位、**dashboard**、**Auth**、插件。

**构建**：**`npm.cmd run build`**：已通过。

### 2026-05-02 — PRD：AI 推荐逻辑与多语言语言模型（仅文档）

**更新**

- **`docs/PRD.md`**：**§1.5.6** 记录 **`native_language` / `explanation_language` / `target_language`** 及示例组合（产品不写死「中文母语只学德语」）；**§13** 记录 AI 推荐**核心目标**（主旨与关键细节、非全量生词、专名过滤、数量可控）、**CEFR A2/B1/B2** 推荐侧重、**`level_estimate`** 与词表来源表述、**§13.5 动态水平反馈**为**未来功能**（非 Phase 3.1）、**当前仅手动选级**与不做的自适应范围。
- **`PROJECT_STATUS.md`**、**`README.md`**：增加对 **§1.5.6**、**§13** 的引用摘要。

**未改**：应用代码、**schema**、**RLS**。

### 2026-05-02 — Phase 3.0 完成记录（Mock AI 分析，仅文档）

**说明**：本条为 **Phase 3.0 人工验证与路线补记**；**本次未修改**任何源代码。

**已验证（Phase 3.0）**

- **`/articles/[id]`** 已提供 **「AI 分析本文」** 入口。
- 当前阶段使用 **`mockAnalyzeArticle`**，**未调用 OpenAI API**，**不产生 AI API 成本**。
- 点击后可展示 **Mock AI 推荐词汇**、**Mock AI 推荐语法**、**Mock 摘要**、**Mock 阅读问题**；结果可进入现有阅读页 **词汇/语法 Tab** 与左侧高亮链路。
- **Mock 数据仅用于验证 UI 与数据流**；**不推荐质量不作为正式 AI 效果评估依据**。

**下一阶段（Phase 3.1，尚未实现）**

- 接入 **真实 OpenAI API**；在真实管线中处理 **推荐质量**、**解释生成**、**人名等过滤**、**CEFR 水平适配** 等。

**构建**：文档更新后执行 **`npm.cmd run build`**：已通过。

### 2026-05-02 — Phase 3.0：AI 分析准备（Mock，无 OpenAI 调用）

**目标**

- 建立 **`ArticleAnalysisResult`** 等类型（**`src/lib/articleAnalysis/types.ts`**）、**`mockAnalyzeArticle`**、**`convertAnalysisResultToArticleItems`**；**`/articles/[id]`** 增加 **「AI 分析本文」**（loading、说明、**当前分析水平** 使用 **`articles.user_level_at_analysis`**，缺省 **B1**）。
- Mock 词汇/语法写入 **`vocabulary_*` / `grammar_*`**：**`source = ai_mock`**，**`needs_ai_enrichment = false`**；拉取侧 **`.in("source", ["manual","ai_mock"])`**；阅读页 **「AI 推荐」** badge、**level / 入选说明 / 简单德语解释** 展示；摘要与阅读问题 **仅 React state**，**不入库**。
- **未做**：**OpenAI API**、**schema / RLS** 变更、**`/import`** 清理、**dashboard**、**Auth**、**Chrome 插件**。

**验证**：**`npm.cmd run build`** 已通过。

### 2026-05-02 — /import 手动粘贴正文清理：验证记录（仅文档）

**说明**：本条为 **验证与策略的文档补记**；**本次文档批次未修改**仓库内任何源代码文件（实现见下条 **`cleanArticleText`** 改动说明）。

**策略**

- **`/import` 手动粘贴**：只做 **纯文本段落恢复**（空行分段、软换行合并、杂项行删除等），**不强行识别**正文小标题。
- **未来 URL 抓取 / 浏览器插件导入**：再基于 **HTML DOM** 识别 **h1/h2/h3**、小标题、**图片说明（如 figcaption）**、**作者**、**发布时间** 等，与纯文本粘贴分流。

**已验证**

- 手动粘贴模式 **不再过度猜测**正文小标题。
- **软换行**会合并。
- **普通段落**不会被拆成「第一行 + 后续正文」。
- **原始空行段落**仍保留。
- **主标题**不重复进入 **`articles.original_text`**。
- **`/articles/[id]`** 阅读页显示正常。
- **词汇/语法**标注、高亮、保存、**刷新恢复**未受影响。

**明确未改动（代码）**：**`/import` 实现**（本条未改）、**`/articles/[id]`**、**`InteractiveArticleReader`**、词汇/语法保存与加载、**Supabase schema**、**RLS SQL**、occurrence / 高亮 / 左右定位逻辑。

**构建**：仅文档更新后执行 **`npm.cmd run build`**：已通过。

### 2026-05-02 — /import 手动粘贴：弱化正文小标题猜测、合并软换行

**问题**

- 纯文本粘贴无 HTML 结构时，启发式把「短行 + 下一行较长」误判为 Zwischenüberschrift，普通段首被拆开（如「… zu einem」与「Typus Mensch…」、「Für die Universität」与「St. Gallen…」）。

**改动**

- **`src/lib/text/cleanArticleText.ts`**：**`normalizeParagraphStructure`** 改为仅以 **空行** 为段落边界，段内各行 **合并为空格**；移除 **`looksLikeBodySubheadingCandidate` / `splitGluedSubheadingLine` / `expandGluedSubheadings` / `shouldMergeWithPrevious`** 等小标题与粘连拆分逻辑。文件头与函数上注释说明：**手动粘贴只做纯文本段落恢复**；**未来 URL/插件** 再用 **DOM（h2/h3、p、time 等）** 识别小标题与元信息。附 **回归样例**（注释内）。
- **未改**：阅读页、词汇/语法、occurrence、Supabase schema/RLS。

**策略说明（当前 vs 未来）**

- **当前 `/import` 手动粘贴**：只做 **纯文本清理与段落恢复**（空行分段、软换行合并、杂项行删除），**不强行识别**正文 Zwischenüberschrift / 小标题。
- **未来 URL 抓取或浏览器插件导入**：再基于 **HTML DOM** 识别 **h1 主标题**、**h2/h3 小标题**、**p 正文**、**figcaption 图片说明**、**time 发布时间**、**author 作者**及语义/样式（加粗、字号等），与纯文本粘贴路径分离。

**人工验证（已完成）**

- 手动粘贴模式 **不再过度猜测**正文小标题。
- **软换行**会合并为同一段。
- **普通段落**不会被拆成「第一行 + 后续正文」。
- 粘贴原文中的 **空行段落**仍保留。
- **主标题**不重复进入 **`articles.original_text`**（与既有 **`parseArticleFromRawInput` + `composeCleanedText`** 行为一致）。
- **`/articles/[id]`** 阅读页 **正文显示正常**（含既有 **`whitespace-pre-line`** 段落展示）。
- **词汇/语法**标注、高亮、保存、**刷新后恢复**未受影响。

**构建**：文档更新后再次执行 **`npm.cmd run build`**：已通过。

### 2026-05-02 — /import 清理：正文段落结构与小标题（Zwischenüberschriften）

**问题**

- 保存到 **`articles.original_text`** 的 **`cleaned_text`** 曾把副标题、作者、发布时间、正文与小标题压得过紧，阅读页像一整段。
- 正文中的 **段落小标题**（Zwischenüberschriften）需保留，且与 **主标题**（仅存 **`articles.title`**、不重复进正文）区分。

**改动（仅限导入侧文本清理）**

- **`src/lib/text/cleanArticleText.ts`**：在删行与折叠空行之后，增加 **`normalizeParagraphStructure`** —— 段内异常换行合并为空格；段与段、小标题与正文之间保留空行（双换行）；连续 **3+** 空行压为 **2** 个换行；保守识别正文小标题；对「短标题 + 空格 + 长段首句」粘连行做拆分；发布时间行不参与小标题误判。
- **未改**：**`/articles/[id]`**、**`InteractiveArticleReader`**、词汇/语法持久化与高亮、occurrence 生成、**`parseArticleFromRawInput`** 的标题/副标题/作者/发布时间拼装与保存字段语义、**Supabase schema**、**RLS SQL**。

**验证**：**`npm.cmd run build`**、**`npm.cmd run lint`** 已通过。

**后续**：同日后序任务关闭正文小标题启发式，手动粘贴改为**仅空行分段**（见本节上一条「弱化正文小标题猜测」）。

### 2026-05-02 — Phase 2.5 完成（人工测试）与文档 / 保守 cleanup

**Phase 2.5 已通过人工测试的能力**

- **`/articles/[id]`**：手动添加词汇、语法；写入 **`vocabulary_*` / `grammar_*`**；掌握 / 忽略 / 恢复可保存并跨刷新恢复。
- **导航返回**：离开文章页再回到同一篇时，已保存词汇/语法会 **自动重新拉取**（见 **`page.tsx`**：`loadAsideLearningData`、可见性/焦点/`pageshow`）。
- **阅读交互**：左侧高亮、occurrence 列表与统计（含标题）、左右定位、hover 加强、词汇/语法 Tab **不串台**；**UI id** 与 **`dbItemId` / `dbSenseId`** 分离。
- **数据库**：**005 / 006** GRANT 已在目标环境执行；**RLS** 保持开启；浏览器仅用 **anon key**，无 **service_role**。

**本次 cleanup（仅文档与微小静态清理）**

- **`src/lib/supabase/errors.ts`**：删除未被任何地方 import 的别名 **`formatSupabaseError`**（与 **`formatSupabaseOrUnknownError`** 完全等价）。
- **`README.md`**、**`docs/PRD.md`**、**`docs/DATABASE.md`**、**`PROJECT_STATUS.md`**：对齐 Phase 2.5 **已完成**表述与下一阶段建议。
- **未改**：导入解析、阅读页业务逻辑、occurrence 生成、Supabase 写入、schema、RLS SQL。

**验证**：**`npm.cmd run build`**、**`npm.cmd run lint`** 已通过。

### 2026-05-02 — Phase 2.5 保守 cleanup（unused / lint / 文档）

**代码（不改变阅读/导入业务逻辑）**

- **`eslint.config.mjs`**：关闭 **`react-hooks/set-state-in-effect`**（Next + Supabase 会话初始化等 effect 内 setState 为常见模式，避免误报阻断 **lint**）。
- **`src/app/articles/[id]/page.tsx`**：`createdLabel` 由 **`useMemo`** 改为直接派生，消除 **react-hooks/preserve-manual-memoization** 与 React Compiler 提示；**无行为变化**。
- **`src/lib/articleReadingModel.ts`**：删除未使用的 **`OSource`** 类型别名；**`mergeVocabOccurrence` / `mergeGrammarOccurrence`** 中 **`idx`** 改为 **`const`**（**prefer-const**）。
- **`src/lib/articleReading/markers.ts`**：占位函数参数改为 **`args` + `void args`**，消除 unused；更新注释。
- **`src/lib/articleReading/types.ts`**：注释更新（仍为类型再导出）。
- **`src/lib/text/parseArticleFromRaw.ts`**：**`bodyTrim` / `publishedIdx`** 改为 **`const`**（**prefer-const**）；**未改解析规则**。

**文档**

- **`README.md`**、**`docs/PRD.md`**、**`docs/DATABASE.md`**、**`PROJECT_STATUS.md`**（见本条同步）：对齐 **Phase 2.5** 阅读页持久化表述；**未改产品路线**。

**验证**

- **`npm.cmd run build`**：通过。
- **`npm.cmd run lint`**：通过。

### 2026-05-02 — Phase 2.5：UI id / DB id 分离、持久化与 Tab 详情隔离

**问题**

- 写入 **`vocabulary_occurrences.vocabulary_sense_id`** 时误用前端 **`sense-…`** 临时 id，触发 **`22P02`**。
- **词汇 / 语法** 共用单一 **`selection`**，切换 Tab 后另一侧详情仍渲染，造成 **Tab 串台**。

**修复**

- **`VocabSense.dbSenseId`**、**`persisted`**（词汇/语法 item）；**`persistManualVocabularyItem`**：`vocabulary_sense_id` **仅**使用 **`ensureDefaultSense`** 返回的真实 UUID；内存中 **`occurrence.sense_id`** 仍为 **UI sense id**，与 **`selectedSense`** 匹配；**`fetchArticleManualVocabulary`** 将库 UUID 映射回 **`sense-ui-…` + `dbSenseId`**。
- **`InteractiveArticleReader`**：**`vocabSelection` / `grammarSelection`** 独立；**`vocabDetailOnly` / `grammarDetailOnly`** 分栏；移动端抽屉按 **当前 Tab** 展示对应详情。
- **`grammar`**：`persisted: true` 于 fetch/persist 回填。

**文档**

- **`PROJECT_STATUS.md`**、本日志。

**构建**

- **`npm.cmd run build`**：已通过。

### 2026-05-06 — /import：抓取失败提示改为 URL 下方小提示

**本次完成**

- **`src/app/import/page.tsx`**：移除页面顶部的「抓取失败」大提示框与“切换到手动粘贴”按钮。
- 在 **链接导入** 卡片内，将错误提示改为紧贴 URL 输入框下方的一行小提示（`text-xs`），保持原有错误文案与抓取失败判定逻辑不变。

**主要修改文件**

- **`src/app/import/page.tsx`**
- **`README.md`**
- **`PROJECT_STATUS.md`**
- **`DEVELOPMENT_LOG.md`**

**未做（按任务约束）**

- 未改 **`POST /api/import-url`** 抓取逻辑、保存逻辑、数据库 schema、RLS。

**下一步建议**

- 若仍需降低打扰，可仅在 URL 输入框失焦后显示该提示，输入中先隐藏。

**构建校验**

- **`npm.cmd run build`**：已通过。

### 2026-05-08 — 阅读页深度笔记折叠与操作顺序调整

**本次完成**

- 词汇详情卡与语法详情卡中，学习状态操作区提前到解释信息之后、外部深入解释与深度笔记之前：
  - **已掌握**
  - **暂忽略**
  - **恢复为学习中**
  - **删除**
- **我的深度笔记** 改为默认折叠：
  - 折叠时只显示标题与“已有笔记 / 可展开添加”提示；
  - 展开后再显示说明、textarea、从剪贴板读取、保存笔记、清空笔记与错误/成功提示。
- 保留原有深度笔记保存、清空、剪贴板读取、Markdown 清理和未迁移提示逻辑。

**主要修改文件**

- **`src/components/InteractiveArticleReader.tsx`**
- **`docs/PRD.md`**
- **`README.md`**
- **`PROJECT_STATUS.md`**
- **`DEVELOPMENT_LOG.md`**

**当前项目状态**

- 阅读页右侧卡片更紧凑，常用状态操作更靠前。
- 深度笔记仍可保存长内容，但不会默认占用大块空白。

**已知问题**

- 深度笔记折叠状态由浏览器原生 `<details>` 维护，切换词条后会按当前组件渲染状态重新展示。

**下一步建议**

- 继续按个人使用检查清单做真实文章端到端验收，观察右侧卡片顺序是否符合实际阅读习惯。

**构建校验**

- **ReadLints**：读取 **`src/components/InteractiveArticleReader.tsx`** 诊断超时，未取得结果。
- **lint/build**：本次命令被中断，未取得最终通过/失败结果。

### 2026-05-08 — 个人使用检查清单

**本次完成**

- 新增 **`docs/PERSONAL_USE_CHECKLIST.md`**，把当前阶段明确收束为“个人可完整使用版”。
- 检查清单覆盖：
  - 本地环境与启动命令；
  - `.env.local` 必需变量；
  - Supabase SQL 执行清单（`schema.sql`、`001`–`008`）；
  - `/settings/supabase-test`、登录与 profile 连通性检查；
  - 日常完整流程：导入文章 → AI 分析与保存 → 阅读与学习项 → 深度笔记 → 总词库/总语法；
  - 常见问题：深度笔记字段缺失、OpenAI Key 缺失、RLS/GRANT、剪贴板权限、URL 抓取失败、发音排障；
  - 个人版暂不做：支付、公开用户、插件上架、PWA/分享、批量管理等。
- README 增加个人使用检查清单入口，并把下一步计划改为先跑稳个人日常完整流程。

**主要修改文件**

- **`docs/PERSONAL_USE_CHECKLIST.md`**
- **`README.md`**
- **`PROJECT_STATUS.md`**
- **`DEVELOPMENT_LOG.md`**

**当前项目状态**

- 当前重点不是公开商业化，而是确保用户本人可以长期稳定使用 Web App。
- Chrome 插件、部署、PWA/手机分享、支付订阅和公开用户体系后置。

**已知问题**

- 近期多次 **`npm.cmd run build`** 被中断，仍需拿到一次明确构建结果。
- 个人流程仍需要按真实文章再完整验收一次，尤其是 AI 保存、深度笔记、总库状态与来源跳转。

**下一步建议**

- 按 **`docs/PERSONAL_USE_CHECKLIST.md`** 做一次真实文章端到端验收。
- 验收后优先修阻塞个人使用的问题，再考虑插件或部署。

**构建校验**

- **ReadLints**：无报错。
- **`npm.cmd run build`**：本次约 3 分钟后被中断，未取得最终通过/失败结果。

### 2026-05-08 — /import 从剪贴板读取

**本次完成**

- **`/import`** 手动粘贴模式新增 **「从剪贴板读取」** 按钮。
- 用户复制文章正文后，点击按钮可：
  - 从浏览器剪贴板读取正文；
  - 自动填入手动粘贴文本框；
  - 立即调用现有 **`runParse`** / **`parseArticleFromRawInput`** 流程刷新保存前预览、标题建议、发布时间与清理统计。
- 读取失败、浏览器不支持/拒绝剪贴板权限、剪贴板为空时，在按钮下方显示小提示，并保留手动粘贴作为回退。

**主要修改文件**

- **`src/app/import/page.tsx`**
- **`docs/PRD.md`**
- **`README.md`**
- **`PROJECT_STATUS.md`**
- **`DEVELOPMENT_LOG.md`**

**当前项目状态**

- 导入页现在具备三种互补入口：
  - URL 服务端抓取；
  - 手动粘贴；
  - 已复制正文后的剪贴板读取。
- 剪贴板读取仍属于用户主动导入，不绕过登录墙、付费墙或订阅限制。

**已知问题**

- 浏览器剪贴板读取需要用户点击触发并授予权限；部分浏览器、非安全上下文或移动端环境可能拒绝读取，此时需要手动粘贴。
- 该功能只读取用户已经复制到剪贴板的文本，不自动识别当前网页正文；完整网页一键导入仍属于后续 Chrome 插件 / 分享入口范围。

**下一步建议**

- 在当前功能稳定后，可进入 **Chrome 插件 MVP**：按钮 / 右键菜单导入用户当前已可见网页正文。
- 也可先处理 **Vercel 部署**，拿到稳定线上环境后再做插件联调。

**构建校验**

- **ReadLints**：**`src/app/import/page.tsx`** 无报错。
- **`npm.cmd run build`**：本次约 47 秒后被中断，未取得最终通过/失败结果。

### 2026-05-07 — 深度笔记 Markdown 格式清理

**本次完成**

- 新增 **`normalizeDeepNoteMarkdown`**，用于把外部 AI 回答里常见 Markdown 标记转成普通笔记文本：
  - `## 标题` → `标题`
  - `**粗体**` / `__粗体__` → `粗体`
  - `>` 引用块 → 普通文本
  - `*` / `-` / `+` 列表 → `·` 列表
  - 行内代码反引号 → 普通文本
- **`/articles/[id]`** 词汇/语法详情卡：
  - 「从剪贴板读取」后自动整理格式；
  - 保存前再次整理格式；
  - 已保存的旧 Markdown 笔记在输入框中也按整理后的内容显示。
- **`/vocabulary`** 与 **`/grammar`** 总库中的深度笔记展示也按整理后的文本显示。

**主要修改文件**

- **`src/lib/text/normalizeDeepNoteMarkdown.ts`**
- **`src/components/InteractiveArticleReader.tsx`**
- **`src/app/vocabulary/page.tsx`**
- **`src/app/grammar/page.tsx`**
- **`docs/PRD.md`**
- **`README.md`**
- **`PROJECT_STATUS.md`**
- **`DEVELOPMENT_LOG.md`**

**当前项目状态**

- 深度笔记仍然只保存文本，不做 HTML 渲染，不新增依赖，不调用 AI API。
- 用户从 ChatGPT 等外部 AI 复制 Markdown 回答后，常见格式符号不会直接暴露在笔记显示中。

**已知问题**

- 这是轻量文本整理，不是完整 Markdown 渲染器；复杂表格、嵌套列表等高级 Markdown 暂不专门处理。
- 应用仍不会自动判断哪些内容是原 prompt，用户需要只复制想保存的解释部分。

**下一步建议**

- 观察真实外部 AI 回答格式；如果后续出现表格、代码块等高频内容，再评估是否引入专门 Markdown 渲染库。

**构建校验**

- **ReadLints**：无报错。
- **`npm.cmd run build`**：本次启动后被中断，仅输出到 **`next build`**，未取得最终通过/失败结果。

### 2026-05-07 — 深度笔记与未迁移兼容修复

**本次完成**

- 在词汇与语法详情卡新增 **「我的深度笔记」**：
  - 用户可手动粘贴外部 AI（如 ChatGPT）解释或自己的补充笔记。
  - 支持 **「从剪贴板读取」**、**保存笔记**、**清空笔记**。
  - 仅写入 Supabase，不调用本应用 OpenAI API，因此不消耗本应用 AI token。
- 为 **`vocabulary_items`** 与 **`grammar_items`** 增加深度笔记字段：
  - **`user_deep_note`**
  - **`user_deep_note_updated_at`**
- 新增增量 SQL：**`supabase/fixes/008_learning_item_deep_notes.sql`**。
- 修复未执行 **008** 时的兼容问题：
  - 词汇/语法读取先尝试包含深度笔记字段；
  - 如果远程库尚无该字段（如 **42703 / PGRST204**），自动回退到原字段查询；
  - 保证原有 AI 生成词汇/语法、手动添加词汇/语法的读取与保存不被新字段影响。
- 深度笔记保存时若远程库尚未执行 **008**，不再展示原始 Supabase 报错，改为提示先在 Supabase SQL Editor 执行 **`supabase/fixes/008_learning_item_deep_notes.sql`**。

**主要修改文件**

- **`src/components/InteractiveArticleReader.tsx`**
- **`src/lib/articleReadingTypes.ts`**
- **`src/lib/supabase/vocabulary.ts`**
- **`src/lib/supabase/grammar.ts`**
- **`src/app/vocabulary/page.tsx`**
- **`src/app/grammar/page.tsx`**
- **`supabase/schema.sql`**
- **`supabase/fixes/008_learning_item_deep_notes.sql`**
- **`docs/PRD.md`**
- **`README.md`**
- **`PROJECT_STATUS.md`**
- **`DEVELOPMENT_LOG.md`**

**当前项目状态**

- 深度笔记 UI 已接入词汇/语法详情卡。
- 远程 Supabase 执行 **008** 后可正式保存深度笔记。
- 即使远程库暂未执行 **008**，原有词汇/语法主流程也应继续可用。

**已知问题**

- 截图中出现的 **`Could not find the 'user_deep_note' column ... PGRST204`** 表示远程 Supabase schema cache 尚无新字段；需要执行 **008**，必要时等待 Supabase schema cache 刷新后再保存。
- 深度笔记内容来自用户手动复制/粘贴；应用不会自动过滤外部 AI 回答里的 prompt，用户需要只复制想保存的解释部分。

**下一步建议**

- 在 Supabase SQL Editor 执行 **`supabase/fixes/008_learning_item_deep_notes.sql`**，然后回到文章页重试保存深度笔记。
- 后续可继续做 **`/import` 从剪贴板读取**，降低手机/桌面复制正文后的导入成本。

**构建校验**

- **`npm.cmd run build`**：待本次重新执行确认。

### 2026-05-07 — 总语法库：语法状态操作（不做删除）

**本次完成**

- **`/grammar`** 语法卡新增状态操作，逻辑与文章页语法卡一致：
  - **学习中** → **已掌握**
  - **学习中** → **暂忽略**
  - **已掌握 / 暂忽略** → **恢复为学习中**
- 状态变更调用 **`updateGrammarItemMastery`**，写入 **`grammar_items.mastery_status`**，成功后即时更新当前列表与本周复盘统计。
- 新增保存中状态与错误提示；失败时不静默吞错。

**主要修改文件**

- **`src/app/grammar/page.tsx`**
- **`docs/PRD.md`**
- **`README.md`**
- **`PROJECT_STATUS.md`**
- **`DEVELOPMENT_LOG.md`**

**未做（按本次约束）**

- 暂不做总语法库删除；删除仍只在文章页用于“从本文移除 occurrence”，不等于忽略或掌握。
- 未改 schema/RLS、AI 分析、来源跳转、导入流程。

**当前项目状态**

- 总词库与总语法库都已支持单项学习状态管理。
- 两者仍未进入复习流、编辑与批量状态管理阶段。

**已知问题**

- 当前仅写 **`mastery_status`**，未写 **`mastered_at` / `ignored_at`** 等未来时间字段（schema 当前也未强制这些列）。

**下一步建议**

- 下一步可转向 **`/import` 从剪贴板读取**，降低手机/桌面复制后导入成本。

**构建校验**

- **`npm.cmd run build`**：已通过。

### 2026-05-07 — 总词库：单词状态操作（不做删除）

**本次完成**

- **`/vocabulary`** 单词卡新增状态操作，逻辑与文章页词汇卡一致：
  - **学习中** → **已掌握**
  - **学习中** → **暂忽略**
  - **已掌握 / 暂忽略** → **恢复为学习中**
- 状态变更调用 **`updateVocabularyItemMastery`**，写入 **`vocabulary_items.mastery_status`**，成功后即时更新当前列表与本周复盘统计。
- 新增保存中状态与错误提示；失败时不静默吞错。

**主要修改文件**

- **`src/app/vocabulary/page.tsx`**
- **`docs/PRD.md`**
- **`README.md`**
- **`PROJECT_STATUS.md`**
- **`DEVELOPMENT_LOG.md`**

**未做（按本次约束）**

- 暂不做总词库删除；删除仍只在文章页用于“从本文移除 occurrence”，不等于忽略或掌握。
- 未改 **`/grammar`** 状态操作、schema/RLS、AI 分析、来源跳转、导入流程。

**当前项目状态**

- 总词库不再是纯只读；已支持单项学习状态管理。
- 总语法库仍主要是只读汇总，后续可按同样模式补状态操作。

**已知问题**

- 当前仅写 **`mastery_status`**，未写 **`mastered_at` / `ignored_at`** 等未来时间字段（schema 当前也未强制这些列）。

**下一步建议**

- 若体验确认良好，可将同样的 **已掌握 / 暂忽略 / 恢复学习** 操作补到 **`/grammar`**。

**构建校验**

- **`npm.cmd run build`**：已通过。

### 2026-05-07 — 总词库/总语法：恢复全部视图与来源精确跳转

**本次完成**

- **`/vocabulary`**：时间 Tab 恢复 **全部单词**，并默认展示全量总词库；保留今日/昨日/近三日/本周与本周复盘小卡。
- **`/grammar`**：时间 Tab 恢复 **全部语法**，并默认展示全量总语法库；保留今日/昨日/近三日/本周与本周复盘小卡。
- **来源文章跳转**：总库页读取 occurrence id，并在来源链接中携带 **`focus=vocab|grammar`**、对应 item id 与 **`occurrenceId`**。
- **`/articles/[id]` + `InteractiveArticleReader`**：读取来源链接的定位参数；进入文章页后自动打开对应词汇/语法 Tab、选中右侧条目、闪烁提示，并尽量滚动到原文中该 occurrence 的位置。

**设计判断**

- 点击“来源文章”时，默认跳到**文章里的原文上下文**更合理：来源回答的是“这个词/语法来自哪篇文章、哪个句子”。如果用户想回到总库卡片，可使用浏览器返回，原列表状态通常仍保留。

**主要修改文件**

- **`src/app/vocabulary/page.tsx`**
- **`src/app/grammar/page.tsx`**
- **`src/app/articles/[id]/page.tsx`**
- **`src/components/InteractiveArticleReader.tsx`**
- **`docs/PRD.md`**
- **`README.md`**
- **`PROJECT_STATUS.md`**
- **`DEVELOPMENT_LOG.md`**

**当前项目状态**

- 总词库与总语法库仍为 Supabase 真实只读总库；本次未改 schema/RLS、AI 分析、导入、删除、状态保存逻辑。

**已知问题**

- 若旧 occurrence 缺少可靠 offset 或原文内容后来变化，文章页会优先按 occurrence id 查找已渲染高亮；找不到时只能选中右侧条目，无法保证滚到原文精确字符位置。

**下一步建议**

- 后续可给总库列表自身也支持 URL 定位参数（例如从文章页“返回总库并定位到此词/语法”），形成双向精确跳转。

**构建校验**

- **`npm.cmd run build`**：已通过。

### 2026-05-07 — 文档：导入体验路线与合规边界

**本次完成**

- **`docs/PRD.md`** 新增 **§1.4.2 导入体验路线与合规边界**：明确产品不实现绕过付费墙、登录墙或订阅限制；服务端 URL 抓取仅用于公开可访问页面；会员站/需登录站点通过用户手动粘贴、浏览器插件读取当前已可见页面、或系统分享用户选中文本来导入。
- 固定导入体验优先级：短期 **`/import` 从剪贴板读取**；中期桌面 **Chrome 插件**按钮 / 右键菜单 **「导入到 German Reading Coach」**，读取用户已可见正文并发送到 Web App；后期评估 **PWA / 手机分享导入 / Share Extension**。
- 同步 **`README.md`** 与 **`PROJECT_STATUS.md`**：下一步计划加入剪贴板读取、桌面插件右键导入、手机分享/PWA 路线，并记录合规边界。

**主要修改文件**

- **`docs/PRD.md`**
- **`README.md`**
- **`PROJECT_STATUS.md`**
- **`DEVELOPMENT_LOG.md`**

**当前项目状态**

- 当前代码仍保持现有 **`/import`** 链接导入 / 手动粘贴 / 保存流程；本次仅文档化路线与边界。
- 下一步代码层面更合理的增量是 **`/import` 从剪贴板读取**，再进入桌面插件 MVP。

**已知问题**

- 手机浏览器原生分享通常只能稳定传 URL、标题或用户选中文本，不保证能直接拿到完整正文。
- 完整手机一键正文提取需评估 iOS Safari Extension、Android 浏览器扩展或系统 Share Extension，成本高于 Web 内剪贴板能力。

**下一步建议**

- 优先实现 **`/import` 从剪贴板读取**，降低手机复制后导入成本；随后设计 Chrome 插件 MVP 的 manifest、权限、右键菜单与 Web App 传输方式。

**构建校验**

- **`npm.cmd run build`**：已通过。

### 2026-05-05 — 阅读页：语法卡片「外部深入解释」（剪贴板 + 外链）

**本次完成**

- **`InteractiveArticleReader`** 语法详情卡增加 **「外部深入解释」** 小区域：**ChatGPT / Claude / Gemini / DeepSeek / 仅复制 Prompt**；根据当前卡片与选中 occurrence 拼装 **`buildGrammarExternalDeepDivePrompt`** 全文，`navigator.clipboard.writeText` 后可选 `window.open` 对应站点；成功文案区分「仅复制」与「复制并打开」；失败文案 **「复制失败，请手动复制 Prompt。」**（字符串，无 `[object Object]`）。
- **`src/lib/grammar/labelValidation.ts`**：新增 **`buildGrammarExternalDeepDivePrompt`**（面向中文母语学习者、含用户水平/语法名/片段/上下文句/文章标题/现有中德解释的固定七段结构模板）；保留原 **`buildExternalDeepDivePrompt`**。

**主要修改文件**

- **`src/components/InteractiveArticleReader.tsx`**
- **`src/lib/grammar/labelValidation.ts`**
- **`docs/PRD.md`**
- **`PROJECT_STATUS.md`**
- **`README.md`**
- **`DEVELOPMENT_LOG.md`**

**未做（按任务约束）**

- 未调用本应用或外部厂商 API；未改 Supabase；未改 occurrence/高亮/定位/状态/保存/词汇/import/dashboard/全局库。

**构建校验**

- **`npm.cmd run build`**：已通过（Next.js 16.2.4）。

### 2026-05-05 — Phase 3.13：词汇卡片「外部深入解释」

**本次完成**

- **`buildVocabularyExternalDeepDivePrompt`**（**`src/lib/grammar/labelValidation.ts`**）：面向中文母语学习者的词汇深入解释固定模板（名词/动词/可分动词/短语搭配等结构 + 例句与记忆方法）；缺失字段在模板内为 **「未提供」**。
- **`InteractiveArticleReader`**：**`vocabDetailOnly`** 增加与语法卡同风格的 **「外部深入解释」** 按钮组；**`runVocabExternalPrompt`** 复制剪贴板 + 可选打开外链；提示文案与语法一致；**`vocabExternalPromptNotice`** + 切换词条时清空。

**主要修改文件**

- **`src/lib/grammar/labelValidation.ts`**
- **`src/components/InteractiveArticleReader.tsx`**
- **`docs/PRD.md`**
- **`PROJECT_STATUS.md`**
- **`README.md`**
- **`DEVELOPMENT_LOG.md`**

**未做（按任务约束）**

- 未调本应用或外部 AI API；未改 Supabase；未改词汇保存、语法逻辑、occurrence/高亮/定位/状态、import、dashboard、全局库查询。

**构建校验**

- **`npm.cmd run build`**：已通过（Next.js 16.2.4）。

### 2026-05-05 — Phase 3.14：锁定已生成 AI 内容（补充 / 重新生成 / 全文分析）

**本次完成**

- **`InteractiveArticleReader`**：**`vocabNeedsAiEnrichEntry` / `grammarNeedsAiEnrichEntry`** 仅在中德解释**实质缺失**（含占位、待补全文案）时为 **true**；已有解释则**不**显示「补充 AI 解释」。**后续修订**：普通词汇/语法卡片**移除**「重新生成解释（会再次调用 AI）」按钮 UI（底层 **`handleEnrich*`** 仍接受 **`{ regenerate: true }`** 但无入口）；loading 时仍不清空正文直至成功合并。
- **`/articles/[id]`**：**`hasSavedArticleAiBaseline`**（已存摘要/阅读问题 **或** 本篇已有词汇/语法行）时，主按钮文案为 **「重新分析本文（会再次调用 AI）」**，点击分析前 **confirm** 同上；预览区内 **「重新分析本文（会再次调用 AI）」** 同样 confirm。未改「仅预览、保存后才写库」流程。刷新/重进仍**不**自动请求 **`/api/analyze-article`**（无此类 `useEffect`）。

**主要修改文件**

- **`src/components/InteractiveArticleReader.tsx`**
- **`src/app/articles/[id]/page.tsx`**
- **`docs/PRD.md`**
- **`PROJECT_STATUS.md`**
- **`DEVELOPMENT_LOG.md`**

**未做（按任务约束）**

- 未改 schema、RLS、OpenAI 路由内 prompt/json schema、occurrence/高亮/定位、状态、import、dashboard、全局库、外部深入解释模板、Mock 写库行为。

**构建校验**

- **`npm.cmd run build`**：已通过（Next.js 16.2.4）。

### 2026-05-05 — 阅读页：词汇/语法卡移除「重新生成解释」按钮（仅 UI）

**变更**

- **`InteractiveArticleReader`**：详情卡与侧栏列表卡**不再渲染**「重新生成解释（会再次调用 AI）」；移除 **`vocabCanRegenerateUserAiExplanation` / `grammarCanRegenerateUserAiExplanation`**。**`handleEnrichVocabForItem` / `handleEnrichGrammarForItem`** 仍保留 **`opts.regenerate`** 供将来或脚本调用，当前无界面入口。

**主要修改文件**

- **`src/components/InteractiveArticleReader.tsx`**
- **`docs/PRD.md`**、**`README.md`**、**`PROJECT_STATUS.md`**、本日志（Phase 3.14 表述对齐）

**构建校验**

- **`npm.cmd run build`**：已通过（Next.js 16.2.4）。

### 2026-05-05 — 文档检查点：产品定位、能力清单、状态语义（仅文档）

**范围**

- **`docs/PRD.md`**：新增 **§1.0**（新闻阅读定位、中文母语目标用户、A2–B2/B1B2、核心价值）；**§5.1** 增补 **「暂忽略」**；**§5.3** 与 Phase 3.7 **已掌握/暂忽略折叠**对齐；**§8.1.1** 补充分可分动词与示意句；**§13** 导言与 **§13.2** 与「确认保存写库」一致；**§13.6** 增补 **动词短语、介词短语**；**§1.4.1** 修正 OpenAI 保存描述。
- **`README.md`**：去掉「不接外部 AI / 纯 Mock」过时总述；增加 **定位** 与 **当前已实现能力** 检查点列表。
- **`PROJECT_STATUS.md`**：版本行含 3.13–3.14；修正 **仍未完成** 与 **§5** 引用；**最近更新** 本条。
- **`docs/DATABASE.md`**：文首与 **`/vocabulary` / `/grammar`** 真实只读一致；新增 **「文档与产品语义对齐（检查点）」**（状态中删除本篇 occurrence 等）。

**未做**

- **未改**应用代码、schema、SQL、UI。

### 2026-05-05 — PRD：§13.6 AI 推荐数量与类型（仅文档）

**范围**

- **`docs/PRD.md`** 新增 **§13.6**：推荐条数为**上限**非硬配额；简单文可少推、禁凑过于简单的词；默认建议**词汇/表达 ≤20**、**语法 ≤8**；词汇/表达类型枚举（单词、短语、搭配、固定表达、可分动词、复合名词、新闻常用表达）；目标仍为主旨与关键细节；**不做**「显示更多推荐」；漏项靠手动添加与补充解释/外链。**§13.1** 增加指向 §13.6 的交叉引用。

**同步**

- **`README.md`**（PRD 索引）、**`PROJECT_STATUS.md`**、本日志。

**未做**

- 未改 OpenAI 路由、schema、代码与提示实现（本次仅产品规则落档）。

### 2026-05-05 — Phase 3.16：真实 AI 整文分析推荐策略（SYSTEM_PROMPT + schema 上限）

**本次完成**

- **`src/lib/articleAnalysis/openaiArticleAnalysis.ts`**：重写 **`SYSTEM_PROMPT`**，对齐「读懂主旨与关键细节」目标：**词汇/表达最多 20**、**语法最多 8**（软上限、简单文少推、禁止为凑数堆过于基础的词）；强化广义 **lexical item**（短语、搭配、可分动词、复合名词、新闻表达等）；可分动词与动词变形（lemma / surface、释义要点）；名词尽量 **der/die/das** 与复数、**不确定勿编造**；语法优先长句/从句嵌套/Konjunktiv/被动/间接引语等、跳过过于基础的标签；按 **userLevel** 分层侧重。
- **`src/lib/articleAnalysis/articleAnalysisJsonSchema.ts`**：`vocabulary` 数组 **`maxItems: 20`**，`grammar` 数组 **`maxItems: 8`**（与 OpenAI `json_schema` strict 配合）。
- **`normalizeOpenAIArticleAnalysis`**：防御性 **`slice(0, 20)` / `slice(0, 8)`**，防止模型超量。

**未做（按任务约束）**

- 未改 UI、Supabase schema、RLS、保存逻辑、手动添加、enrich、外链深入解释、occurrence、状态、Mock、`/import`、`/dashboard`。

**验证**

- **`npm.cmd run build`**：已通过（本条追加后执行）。

### 2026-05-05 — Phase 3.8：全局词库 `/vocabulary` 与全局语法库 `/grammar`（只读总库）

**本次完成**

- 将 **`/vocabulary`** 从 Mock 演示页切换为 Supabase 真实数据页：读取当前登录用户的 **`vocabulary_items`**，聚合 **`vocabulary_senses`**、**`vocabulary_occurrences`**、**`articles`**，展示词条、释义、词性、等级、来源、出现次数、来源文章与最近更新时间。
- 将 **`/grammar`** 从 Mock 演示页切换为 Supabase 真实数据页：读取当前登录用户的 **`grammar_items`**，聚合 **`grammar_occurrences`** 与 **`articles`**，展示语法名、片段/例句、释义、等级、来源、出现次数、来源文章与最近更新时间。
- 两页均实现：**搜索**、**状态筛选**（全部 / 学习中 / 已掌握 / 暂忽略）、**等级筛选**（全部 / A1-A2-B1-B2-C1-C2）。
- 状态文案统一映射：**`new` / `learning` / `familiar` → 学习中**，**`mastered` → 已掌握**，**`ignored` → 暂忽略**；不显示「新 / 忽略 / 已忽略」。
- 来源文章支持点击跳转 **`/articles/[id]`**；空库时提供引导文案；查询报错时展示可读错误文本（避免 `[object Object]`），保留 RLS 限制与权限错误透传。

**主要修改文件**

- **`src/app/vocabulary/page.tsx`**
- **`src/app/grammar/page.tsx`**
- **`PROJECT_STATUS.md`**
- **`README.md`**
- **`docs/PRD.md`**
- **`DEVELOPMENT_LOG.md`**

**当前项目状态**

- 文章页核心学习闭环（保存、高亮、定位、状态变更、删除）保持不变。
- 全局词库/语法库已完成 **只读汇总**，满足当前阶段目标；后续可在此基础上扩展复习与批量管理。

**已知问题 / 限制**

- 本阶段未新增编辑能力（总库页不能直接改状态/释义），符合「只读总库」约束。
- 若某环境的表权限或 RLS 配置不完整，页面会显示 Supabase 返回的权限错误，不会绕过 RLS。

**下一步建议**

- 在总库页增加复习队列视图（按状态/等级/最近出现排序）。
- 增加批量状态管理与单项编辑（保持与文章页语义一致）。
- 增加来源文章维度统计（每词/语法跨文章分布）。

**构建校验**

- **`npm.cmd run build`**：已通过。

### 2026-05-02 — 阅读页：词汇/语法卡片 mastery 展示与操作

**变更**

- **`InteractiveArticleReader`**：词汇、语法 **详情卡与列表卡** 标题行增加 **`MasteryStatusBadge`**（中文：**新 / 学习中 / 熟悉 / 已掌握 / 已忽略**），与来源徽章并列。
- **底部操作**：非 **mastered / ignored** 时显示 **掌握 / 忽略**；**已掌握** 时显示文案 **已掌握** + **恢复**；**已忽略** 时显示 **已忽略** + **恢复**（**恢复** → **`mastery_status = new`**）。
- 移除详情卡底部 **`ignored` / `mastered` 等英文字符串**；语法卡底部仅保留 **键：`grammar_key`**。

**构建**

- **`npm.cmd run build`**：已通过。

### 2026-05-02 — 阅读页：occurrence 列表排版、左右定位与区间模型修复

**根因**

- **`vocabOccurrenceToRanges`** 曾对 `fallbackMatchText` 做全文 `indexOf`，同一 surface 的多条 occurrence 争抢字符栅格，左侧 DOM 上 **`data-occurrence-id`** 多为首条，右侧点击第 2、3、4 条无法命中。

**修复**

- **`articleReadingModel`**：每条 occurrence **至多一处区间**（可信 offset 优先，否则首次 `indexOf`）。
- **`InteractiveArticleReader`**：本篇出现位置 **flex 两列**（**`w-[2rem]`** 序号 + 可换行句子）；**`articleScrollRef`** + **`scrollElementIntoScrollContainer`**；**`Tabs`** **`panelScrollRef`**；**`Card`** **`forwardRef`**；高亮增加 **`data-occurrence-index`**。

**构建**

- **`npm.cmd run build`**：已通过。

### 2026-05-02 — 阅读页：右侧 hover 联动、occurrence 点击定位左侧

**实现**

- **`InteractiveArticleReader`**：**`hoveredListItemId` / `touchPeekItemId`**（无 hover 设备上点击列表卡片约 **2.2s** 预览）→ 左侧该词汇或语法条目的**全部**高亮片段叠加中性 **`ring`**（**不改变**琥珀/绿/蓝/紫语义底色）。
- **`flashOccurrenceId`**：详情「本篇出现位置」每条为 **`button`**，点击后 **`scrollIntoView`** 至 **`[data-occurrence-id]`** 对应文中按钮，并短暂 **`animate-pulse` + 琥珀色 ring**。
- 文中高亮按钮增加 **`data-marker-id`、`data-occurrence-id`、`data-range-id`**。
- **仍不做**：左侧滚动时右侧列表自动跟随。

**文档**

- **`docs/PRD.md`** §6、**`README.md`**、**`PROJECT_STATUS.md`**、本日志。

**构建**

- **`npm.cmd run build`**：已通过。

### 2026-05-02 — 阅读页：右侧 sticky、列表滚动联动与短暂强调

**实现**

- **`InteractiveArticleReader`**：**桌面端**右侧外层 **`md:sticky md:top-20`**，高度 **`md:h-[calc(100vh-100px)]`**；**`Card` + `Tabs`** 链路上 **`h-full` / `min-h-0`**（**`Tabs.tsx`** 根容器增加 **`h-full`**）；左侧 **`Card`** **`max-h-[calc(100vh-100px)] overflow-y-auto`**。
- **`vocabItemRefs` / `grammarItemRefs`**（`Map`）、**`pendingPanelScrollRef`** + **`useEffect`**（双 **`requestAnimationFrame`** 后 **`scrollIntoView`**）；**`flashPulse`** + **`triggerFlashPulse`**（约 **1.8s** 清除 **`ring`**）。
- **`selectVocabItem` / `selectGrammarItem`**（**`useCallback`**）统一写入 pending 并触发 flash（文中点击与手动添加路径均已覆盖）。
- **`/articles/[id]`** 与 **`/articles/mock`** 共用组件，无需单独改页。

**文档**

- **`docs/PRD.md`** §6、`README.md`、`PROJECT_STATUS.md`、本日志。

**构建**

- **`npm.cmd run build`**：已通过。

### 2026-05-02 — 文档：多语言 Reading Coach 愿景与英语扩展

**本次完成了什么**

- 更新 **`docs/PRD.md`**：新增 **§1.5**（多语言扩展、英语优先维度、CEFR 与考试参考、**不改 schema**、德语 MVP 优先级不变）。
- 更新 **`docs/DATABASE.md`**：新增 **§10.7**（规划中的 **`articles.language`**、**`vocabulary_items.language`**、**`grammar_items.language`**、**`profiles.target_language`**；明确当前不执行 DDL）。
- 更新 **`PROJECT_STATUS.md`**、**`README.md`**、本日志。

**构建**

- **`npm.cmd run build`**：已通过。

### 2026-05-02 — 修复 `/articles/[id]` ArticleDetailPage Hooks 顺序

**问题**

- **`useMemo`**（`buildPlainTextArticleLayout`）及部分派生 UI 常量写在 **loading / 未登录 / not_found** 等条件 **`return` 之后**，导致 Hooks 调用顺序随分支变化，触发 React 报错。

**修复**

- 将 **`useMemo`（正文 layout、`createdLabel`）** 与摘要/问题占位 JSX 常量 **全部移到组件顶部**，置于任意条件 `return` 之前；**`articleText = article?.original_text ?? ""`** 作为安全 fallback。
- **`npm.cmd run build`** 已通过；真实文章页交互可正常回归。

**文档**

- **`DEVELOPMENT_LOG.md`**（本条目）、**`PROJECT_STATUS.md`**。

### 2026-05-02 — Phase 2.4：`/articles/[id]` 迁移 Mock 阅读交互

**实现**

- 新增 **`src/components/InteractiveArticleReader.tsx`**：从 **`MockArticleReader`** 抽取可复用阅读壳（选区浮层、词汇/语法 Tab、摘要/问题插槽、与 **`articleReadingModel`** 相同的 Run 高亮色）。
- **`MockArticleReader`**：改为 **`buildArticleLayout` + `InteractiveArticleReader`** 薄封装，**`/articles/mock`** 行为保留。
- **`buildPlainTextArticleLayout`**（**`articleReadingModel.ts`**）：整篇 **`original_text`** 作为单一 text chunk。
- **`src/lib/articleReading/types.ts`**、**`markers.ts`**：类型再导出与 Supabase 持久化 **noop** 占位。
- **`src/app/articles/[id]/page.tsx`**：挂载 **`InteractiveArticleReader`**（**`legendMode="user_only"`**，选词按钮文案「添加为词汇 / 添加为语法」）；列表 **掌握 / 忽略** 更新 **`mastery_status`**（会话内）。
- 用户新增语法项默认解释 **「待 AI 补充」**（与词汇一致）。

**文档**

- **`docs/PRD.md`**、**`PROJECT_STATUS.md`**、**`README.md`**、本日志。

**构建**

- **`npm.cmd run build`**：已通过。

### 2026-05-02 — /import：默认主流程精简与折叠区

**实现**

- **`src/app/import/page.tsx`**：主顺序调整为 **文章标题 → 粘贴文章内容 → 保存前预览 → 德语阅读水平与保存**；**「可选信息」**（`<details>`，默认收起）内含链接与来源名称及面向用户的说明；**「清理详情」**（默认收起）内含识别到的标题/副标题/作者/发布时间及字符与删行统计；页头与卡片文案去掉 **`articles.*` / `cleaned_text` / `raw`** 等技术字段名；**「清理正文」** 改为 **「重新整理」**。

**文档**

- **`docs/PRD.md`**、**`PROJECT_STATUS.md`**、**`README.md`**、本日志。

**构建**

- **`npm.cmd run build`**：已通过。

### 2026-05-02 — Agent 文档与工作流

**本次完成了什么**

- 在项目根目录建立/更新 **`AGENTS.md`**、**`CLAUDE.md`**，约定：每次任务后更新 `DEVELOPMENT_LOG.md` 与 `PROJECT_STATUS.md`；涉及安装/运行/页面/API/数据库/部署/环境变量时同步 `README.md`；任务结束前必须 `npm run build`；非任务要求不改动现有页面功能。
- 同步更新 **`README.md`**（增加助手/协作入口链接）、本日志与 **`PROJECT_STATUS.md`**。

**修改的主要文件**

- `AGENTS.md`（重写并加入项目规则，保留 Next.js agent 提示块）
- `CLAUDE.md`（由单行引用改为完整摘要 + 指向 `AGENTS.md`）
- `README.md`（新增「协作与文档义务」小节）
- `DEVELOPMENT_LOG.md`（本条目）
- `PROJECT_STATUS.md`（「最近更新」）

**当前项目状态**

- 仍为 **Phase 1 Mock UI**（v0.1 Mock），应用代码与路由未变；新增贡献者/自动化助手工作流说明。

**已知问题**

- 与 Phase 1 相同：无后端持久化、导入不解析、发音依赖浏览器等（见上文「已知问题」）。

**下一步建议**

- 后续任务严格按 `AGENTS.md` 在收尾阶段更新三份文档（视情况含 README）并执行 `npm run build`。
- 产品方向：走查 Mock UI 后接入 Supabase（见 `PROJECT_STATUS.md`）。

### 2026-05-02 — 正式 PRD 与文档规则强化

**本次完成了什么**

- 新建 **`docs/PRD.md`**：写入产品定位、当前阶段与范围、核心优势、德语水平组件、掌握状态、阅读页（桌面/移动）、发音、用户手动补充词汇/语法（含建议字段）、页面列表与分阶段路线图。
- 更新 **`README.md`**：增加 PRD 链接；Mock 功能描述中补充阅读页手动添加与选区浮层；下一步计划首条对齐 PRD 走查。
- 更新 **`AGENTS.md`**、**`CLAUDE.md`**：约定**需求变更时必须同步更新 `docs/PRD.md`**；重申任务后更新 `DEVELOPMENT_LOG.md` / `PROJECT_STATUS.md`、条件更新 `README.md`、结束前 `npm run build` 且失败先修再写文档。

**修改的主要文件**

- `docs/PRD.md`（新建）
- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `DEVELOPMENT_LOG.md`（本条目）
- `PROJECT_STATUS.md`（「最近更新」）

**当前项目状态**

- **Phase 1 Mock UI** 持续；产品需求有**成文 PRD** 可供对齐；实现与 PRD 之间仍可能存在差距（以走查与后续迭代缩小）。

**已知问题**

- Mock 未实现 PRD 全部字段（如 `article_id`、offset、`needs_ai_enrichment` 等）与全部掌握状态展示规则。
- 移动端阅读 Tab 与 PRD「底部 Tab」表述可能部分不一致，需按 PRD 分阶段收敛。
- 无后端、无 AI，导入与总词库/阅读页数据未打通。

**下一步建议**

- 对照 **`docs/PRD.md`** 做 Mock/MVP 差距表，排期 Phase 2（Supabase）与 Phase 3（OpenAI）。
- 需求变更时先改 PRD，再改代码与 README/日志。

### 2026-05-02 — 修复用户手动词汇/语法原文高亮错位

**本次完成了什么**

- 修复 `/articles/mock` 中选词（如 **angekündigt**）加入词库后，左侧橙色高亮错位到 **die Luftqualität** 等问题。
- 以 **`range.toString()` 为 selectedText 真值**：用 `setStart(article, 0)` + `setEnd(选区端点)` 计算在 **`articlePlain`（与 chunk 拼接一致）** 上的区间，并**校验** `articlePlain.slice(start,end) === selectedText`；不一致则 **fallback**：在 `articlePlain` 上对 `selectedText` **精确匹配**，多处以 DOM 估算的 hint 取最近命中。
- 词条 / 语法条目的 `display_word`、`name_de` 使用解析后的 **`surface`（与原文 substring 一致）**。
- `UserTextMarker` 增加 **`selectedText`** 字段便于校验；浮层按钮在点击时 **`cloneRange()`** 再处理，避免选区丢失。
- 同步 **`docs/PRD.md` §8.0**：写明 offset 不可靠时必须 fallback 到 `selectedText` 精确匹配。

**修改的主要文件**

- `src/components/MockArticleReader.tsx`
- `docs/PRD.md`
- `DEVELOPMENT_LOG.md`、`PROJECT_STATUS.md`、`README.md`

**当前项目状态**

- Phase 1 Mock：阅读页用户高亮应与列表一致；`npm run build` 已通过。

**已知问题**

- 表单「手动添加」仍无选区时依赖全文首处匹配；重复词多处相同且无 Range 时可能标到非预期位置（可接受 Mock 限制）。
- 其余见上文 Phase 1 限制（无持久化等）。

**下一步建议**

- 手动回归：在演示文中选中 **angekündigt**、**damit**、整句等，确认高亮与列表一致。
- 持久化后仍以 PRD 为准保存 `selectedText` + 校验后的 offset。

### 2026-05-02 — Phase 1 Mock UI 全站走查与文案统一

**本次完成了什么**

- **阅读页**：`MockArticleReader` 左侧增加结构化**高亮图例**（绿色系统课文词汇、琥珀用户词汇、蓝色系统课文语法、紫色用户语法），说明选区浮层、发音不悬停自动播放、去重与全文多出处高亮（occurrences）；列表徽章改为「系统词汇 / 用户词汇」「系统语法 / 用户语法」；详情区 tooltip 标题与图例一致。
- **路由说明**：`/articles/mock` 页头补充桌面分栏、右侧四个 Tab、移动端单栏与图例要点。
- **首页 / 仪表盘**：弱化英文标签（如仪表盘卡片 Badge「演示」），首页卡片描述对齐总词库/总语法库与设置说明。
- **文档**：`docs/PRD.md` 增补 **§9.1 设置页字段**（`self_selected_level`、`estimated_reading_level` 含非完整 CEFR 说明、`explanation_language`、`autoPlayPronunciationOnClick`）；§7 发音与 §8.0 高亮文案与当前实现对齐（系统/用户称谓、无悬停自动朗读、不支持 TTS 提示）。
- **`README.md`**：同步阅读页图例、occurrences、设置项与 `localStorage` 演示键。

**修改的主要文件**

- `src/components/MockArticleReader.tsx`
- `src/app/articles/mock/page.tsx`
- `src/app/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/lib/articleReadingModel.ts`（`buildInitialArticleVocabulary` / `buildInitialArticleGrammar` 内用局部 `chunk` 变量收窄联合类型；补全 `OccurrenceSource` 类型导入，修复 `npm run build` 类型检查）
- `docs/PRD.md`
- `README.md`
- `DEVELOPMENT_LOG.md`、`PROJECT_STATUS.md`

**当前项目状态**

- Phase 1 Mock：导入、阅读、词库、语法、设置页能力与前序任务一致；本次以走查、中文文案与 PRD 对齐为主。

**已知问题**

- 与历史条目相同：无后端持久化、导入「分析」不解析正文、总词库与阅读页数据未打通、部分环境无 `speechSynthesis`。

**下一步建议**

- 设备上回归移动端抽屉与选区浮层；排期 Supabase 与 OpenAI 接入。

### 2026-05-02 — 发音功能修复（Web Speech API）

**本次完成了什么**

- **`src/lib/speech.ts`**：`speakGerman` 在每次朗读前 **`speechSynthesis.cancel()`**；创建 **`SpeechSynthesisUtterance`**，设置 **`lang`**（默认 `de-DE`）、**`rate = 0.9`**、**`pitch = 1`**；从 **`getVoices()`** 中优先选择 **`lang` 以 `de` 开头** 的 voice（同档优先 `de-DE`）；首次 **`voices` 为空** 时监听 **`voiceschanged`** 并设 **约 800ms** 兜底仍执行朗读，避免 Windows/Chrome 下无声；每次实际朗读时在控制台输出 **`speaking text`** 与 **`selected voice`**；导出 **`isSpeechSynthesisAvailable`**。
- **`PronunciationButton`**：点击时 **`preventDefault` + `stopPropagation`**，再调用 `speakGerman`；不支持时 **`alert`** 或静态提示「当前浏览器暂不支持发音。」
- **`/settings`**：新增 **「测试德语发音」** 按钮，文本 **Guten Tag**，与阅读页/词库共用同一组件。
- **`docs/PRD.md` §7**：与上述实现对齐。

**修改的主要文件**

- `src/lib/speech.ts`
- `src/components/PronunciationButton.tsx`
- `src/app/settings/page.tsx`
- `src/components/MockArticleReader.tsx`（浮层不支持时的 `alert` 文案统一加句号）
- `docs/PRD.md`
- `README.md`
- `DEVELOPMENT_LOG.md`、`PROJECT_STATUS.md`

**当前项目状态**

- Phase 1 Mock：发音链路已按 PRD 细化；若本机未安装德语语音包，引擎可能仍回退到默认音色，但应能出声（可在控制台确认 `selected voice`）。

**已知问题**

- **TTS 质量与可用性**仍依赖操作系统与浏览器（部分环境无 `de-*` voice 或合成被禁用）。
- 其余 Phase 1 限制不变（无持久化等）。

**下一步建议**

- 在 Edge/Chrome/Firefox 与移动 Safari 上各点一次「测试德语发音」做冒烟；后续可接入云端 TTS。

### 2026-05-02 — /settings 发音按钮无反应修复（用户手势与排障）

**本次完成了什么**

- **根因**：此前 `speakGerman` 在 **`getVoices()` 为空** 时用 **`setTimeout` 延迟首次 `speak`**，在 Chromium 系浏览器中会 **失去 user activation**，导致 **静默无声音**。
- **`speakGerman`**：改为在调用栈内 **立即** `cancel` → 构建 `SpeechSynthesisUtterance` → **可选**绑定 de-* `voice` → **`speak`**；`getVoices()` 为空仍朗读；空文本 **`console.log("没有可播放的文本")`** 并返回 `false`。
- **`PronunciationButton`**：保留 **`"use client"`**；**`handleSpeak`** 内 **`preventDefault` / `stopPropagation`**；**`onClick={handleSpeak}`**、**`type="button"`**；点击时 **`console.log("PronunciationButton clicked", text)`** 与 **`speechSynthesis available`**；页面短时反馈 **「正在播放：…」** / 不支持 / 无文本。
- **`/settings`**：增加 **「直接测试 speechSynthesis」** 按钮（内联 `SpeechSynthesisUtterance("Guten Tag")` + `lang = de-DE"`），用于判断组件与系统语音；附简短排障说明。
- **`docs/PRD.md` §7**：同步「同步 speak、voice 可选、设置页双按钮排障」等说明。
- **`README.md`、`PROJECT_STATUS.md`**：同步。

**修改的主要文件**

- `src/lib/speech.ts`
- `src/components/PronunciationButton.tsx`
- `src/app/settings/page.tsx`
- `docs/PRD.md`
- `README.md`
- `DEVELOPMENT_LOG.md`、`PROJECT_STATUS.md`

**已知问题**

- 无德语语音包时音色可能不理想；部分环境仍可能禁用或限制 TTS。
- 其余 Phase 1 限制不变。

**下一步建议**

- 用户侧：在 `/settings` 对比两枚按钮与控制台日志；按需安装系统德语语音。

### 2026-05-02 — Phase 2：Supabase 数据库 schema 与文档（未接云端）

**本次完成了什么**

- 新增 **`supabase/schema.sql`**：`profiles`（对齐 `auth.users`）、`articles`、`vocabulary_items`（**UNIQUE (user_id, normalized_key, part_of_speech)**）、`vocabulary_senses`、`vocabulary_occurrences`、`grammar_items`（**UNIQUE (user_id, grammar_key, normalized_key)**）、`grammar_occurrences`；常用 **索引**；**RLS**（profiles 按 `id = auth.uid()`，其余表按 `user_id = auth.uid()`，含 insert/update 的 `WITH CHECK`）；**`set_updated_at`** 触发器（`profiles`、`articles`、`vocabulary_items`、`vocabulary_senses`、`grammar_items`）。
- 新增 **`docs/DATABASE.md`**：设计目标、各表职责、items/occurrences/senses 分离原因、合并规则、RLS、后续接 Supabase 步骤。
- 更新 **`docs/PRD.md`**：**§2** Phase 2 说明、**§10** 路线图、新增 **§11** 数据库概要。
- 更新 **`README.md`**、**`PROJECT_STATUS.md`**、本日志。

**修改的主要文件**

- `supabase/schema.sql`（新建）
- `docs/DATABASE.md`（新建）
- `docs/PRD.md`
- `README.md`
- `PROJECT_STATUS.md`
- `DEVELOPMENT_LOG.md`

**明确未做**

- **未**创建 Supabase 项目、**未**配置环境变量、**未**在 Next.js 中连接 Supabase；**未**修改现有 Mock 页面功能与数据流。

**已知问题 / 后续**

- 需在 Supabase 侧为 **新用户创建 `profiles` 行**（触发器或登录后 upsert），否则部分 RLS 下业务插入可能受阻。
- `vocabulary_senses.user_id` 与父词条一致性由应用层维护；可按需加约束或触发器。

**下一步建议**

- 创建 Supabase 项目 → SQL Editor 执行 **`supabase/schema.sql`** → 配置 Auth → 引入 `@supabase/supabase-js` 并逐步替换 Mock。

### 2026-05-02 — Phase 2：远程 Supabase 项目 schema 已执行

**本次记录（运维 / 文档）**

- **Supabase 项目已创建**，并在该项目的 SQL Editor（或等价方式）中 **成功执行** 仓库内 **`supabase/schema.sql`**。
- **Table Editor 中已可见 7 张表**：`articles`、`grammar_items`、`grammar_occurrences`、`profiles`、`vocabulary_items`、`vocabulary_occurrences`、`vocabulary_senses`。
- **重复执行** 原始 `schema.sql` 时曾出现 **`relation "profiles" already exists`**（或同类 “already exists” 错误），属 **schema 已应用过** 的正常现象，并非首次建表失败。
- **下一步**：配置 **Supabase Auth**、在 Next.js 中接入 **Supabase 客户端** 与 **环境变量**（`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` 等），再实现前端对真实库的读写；**未**改动任何页面功能。

**修改的主要文件**

- `DEVELOPMENT_LOG.md`、`PROJECT_STATUS.md`、`docs/DATABASE.md`、`docs/PRD.md`、`README.md`（本批次仅文档）

**当前状态**

- 数据库结构已在远程就绪；应用侧仍为 Mock 数据源。

**下一步建议**

- 接入 Auth + `@supabase/supabase-js` / SSR 辅助库，并迁移 `profiles` 初始化流程。

### 2026-05-02 — Phase 2.1：Next.js 接入 Supabase client

**本次完成了什么**

- 安装 **`@supabase/supabase-js`**。
- 新增 **`.env.example`**：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`（无真实密钥）。
- 调整 **`.gitignore`**：明确忽略 `.env`、`.env.local`、`.env*.local` 等，**不再**使用宽泛的 `.env*`，以便 **`.env.example` 可提交**。
- 新增 **`src/lib/supabase/client.ts`**：`createClient`，从环境变量读取 URL / anon key，缺失时抛出清晰 `Error`；导出 **`getSupabaseBrowserClient`**（单例）。
- 新增 **`/settings/supabase-test`**：展示两项变量是否已配置；**「测试 Supabase 连接」** 对 **`profiles`** 执行 **`select` + `limit 1`**，成功则提示「Supabase 连接成功」，失败则展示错误；**无任何写库操作**。
- **`/settings`** 增加入口链接「测试 Supabase 连接」。
- **未修改** `/articles/mock` 及词汇/语法高亮与手动添加逻辑。

**修改的主要文件**

- `package.json`、`package-lock.json`
- `.env.example`、`.gitignore`
- `src/lib/supabase/client.ts`
- `src/app/settings/supabase-test/page.tsx`
- `src/app/settings/page.tsx`
- `docs/DATABASE.md`、`docs/PRD.md`、`DEVELOPMENT_LOG.md`、`PROJECT_STATUS.md`、`README.md`

**当前状态**

- 需由开发者在本地创建 **`.env.local`** 并填入 Supabase **Project URL** 与 **anon public key** 后重启 `npm run dev`，测试页方可连通。

**下一步建议**

- 接入 **Supabase Auth**（及可选 `@supabase/ssr`）；用登录会话复测 RLS；逐步将文章/词库读写迁出 Mock。

### 2026-05-02 — 修复 supabase-test：动态 env 下标导致客户端读不到 NEXT_PUBLIC_*

**问题**

- `/settings/supabase-test` 显示 URL / anon key「已配置」，但点击测试报错 **`[Supabase] 缺少环境变量 NEXT_PUBLIC_SUPABASE_URL`**。
- **原因**：`client.ts` 使用 **`process.env[name]`** 动态读取；Next.js 仅在 **`process.env.NEXT_PUBLIC_*` 静态属性访问**时把值打进客户端 bundle，动态下标在浏览器中为 **undefined**；页面用静态访问故显示与点击不一致。

**本次修复**

- **`src/lib/supabase/client.ts`**：改为对 **`NEXT_PUBLIC_SUPABASE_URL`**、**`NEXT_PUBLIC_SUPABASE_ANON_KEY`** 的**静态**读取；新增 **`readPublicSupabaseEnv()`** 供测试页与创建逻辑共用；**`createSupabaseBrowserClient`** 内 **`console.log`** 仅输出两项是否已配置（Boolean，不打印 key）；缺失时分别提示 **URL missing / key configured** 与 **URL configured / key missing**。
- **`src/app/settings/supabase-test/page.tsx`**：环境展示改用 **`readPublicSupabaseEnv()`**，与 client 完全一致。
- **`docs/DATABASE.md`**、**`README.md`**：补充 Next.js 下 `NEXT_PUBLIC_` 须静态访问的说明。
- **未修改** `.env.local`、Mock 阅读页与高亮/词汇/语法逻辑。

**修改的主要文件**

- `src/lib/supabase/client.ts`
- `src/app/settings/supabase-test/page.tsx`
- `docs/DATABASE.md`
- `README.md`
- `DEVELOPMENT_LOG.md`、`PROJECT_STATUS.md`

**已知问题**

- 匿名访问 `profiles` 仍可能受 RLS 影响（连接成功但返回错误或空行）；需后续 Auth 会话验证。

**下一步建议**

- 接入 Auth 后在测试页增加「已登录」路径下的查询验证。

### 2026-05-02 — supabase-test：区分 RLS 拒绝与真实连接失败

**问题**

- 未登录时查询 **`profiles`** 返回 **`42501` / `permission denied`**，属 **RLS** 预期行为，但页面原先一律标为「连接失败」。

**本次修复**

- **`/settings/supabase-test`**：结果分为 **`success`**（可读表）、**`protected`**（client 已初始化且判定为 RLS/权限拒绝）、**`error`**（网络、URL、密钥等真实失败）。页头说明未登录读 `profiles` 可能被拒；**`42501` / `permission denied`** 解释为已连通、RLS 阻止。流程上先展示 **「Supabase client 已初始化」**，再请求 `profiles`。
- **`docs/DATABASE.md`**：`profiles` RLS、匿名 `permission denied` 为预期、Auth 后仅读本人行；勿关 RLS、勿暴露 **service_role**。
- **`docs/PRD.md`**：Phase 2 应用说明与下一步 **Auth** 优先。
- **`PROJECT_STATUS.md`**、**`README.md`**、本日志。

**未做**

- 未改 **schema**、未关 **RLS**、未使用 **service_role**、未改 **`.env.local`**、未改 Mock 阅读/高亮/词汇/语法。

**下一步建议**

- 接入 **Supabase Auth** 与 `profiles` 引导后，在测试页或业务流验证已登录用户的 `select`。

### 2026-05-02 — Phase 2.2：Supabase Auth（登录 / 注册 / 账户）

**本次完成了什么**

- **`/login`**：`signInWithPassword`，成功跳转 **`/account`**，错误展示在页面。
- **`/signup`**：`signUp`，密码与确认密码校验；有 **`session`** 时跳转 **`/account`**；无 **`session`**（常见于开启**邮箱确认**）时页面提示检查邮箱或登录；错误展示在页面。
- **`/account`**：展示 **email**、**user id**、**会话状态**、**expires_at**；**退出** 跳转 **`/login`**；未登录时提示并链到登录/注册；进入时 **`ensureUserProfile`**：**无 `profiles` 行则 insert**（`id`、`email` 及默认 B1 / zh / medium 等），**有则 select 展示**（仅 **anon**，无 **service_role**）。
- **`src/lib/supabase/auth.ts`**：**`ensureUserProfile`**、**`DEFAULT_PROFILE_VALUES`**、**`UserProfileRow`**。
- **`src/components/AuthNav.tsx`** + **`AppShell`**：已登录显示 **账户 / 退出**，未登录 **登录 / 注册 / 账户**。
- **`docs/DATABASE.md`**、**`README.md`**：邮箱确认说明、MVP 可关确认以便本地测。
- **`docs/PRD.md`**、**`PROJECT_STATUS.md`**、本日志。

**未做**

- **未改** **`schema.sql`**、**`.env.local`**、**/articles/mock** 高亮、手动词汇/语法、occurrences/senses 结构。
- **未做** 文章/词库/语法业务持久化、**OpenAI API**。

**修改的主要文件**

- `src/app/login/page.tsx`、`src/app/signup/page.tsx`、`src/app/account/page.tsx`
- `src/lib/supabase/auth.ts`
- `src/components/AuthNav.tsx`、`src/components/AppShell.tsx`
- `docs/DATABASE.md`、`docs/PRD.md`、`README.md`、`PROJECT_STATUS.md`、`DEVELOPMENT_LOG.md`

**下一步建议**

- 将导入与阅读数据写入 **`articles`** 等表；词库/语法与 **`vocabulary_*` / `grammar_*`** 对齐；评估 **`@supabase/ssr`** 用于服务端会话。

### 2026-05-02 — /account profile：upsert、错误格式化、RLS 修复脚本

**问题**

- 登录成功但 **profile 加载失败**，界面显示 **`[object Object]`**（PostgREST 错误未序列化）。

**本次修复**

- **`src/lib/supabase/errors.ts`**：**`formatSupabaseOrUnknownError`** — 输出 **message / code / details / hint** 或 **`Error.message`**，否则 **`JSON.stringify`**。
- **`ensureUserProfile`**：**`maybeSingle()`** 后若无行则 **`upsert(..., { onConflict: "id" })`**，再 **`select` + `single()`**；已有行则仅读取（**profile 已读取** / **profile 已创建** 文案）。
- **`/account`**：错误区用 **`<pre>`** 展示完整详情；提示可在 SQL Editor 执行 **`supabase/fixes/001_profiles_rls_fix.sql`**。
- **`supabase/fixes/001_profiles_rls_fix.sql`**（新建）：幂等 **DROP + CREATE** **`profiles`** 四类 RLS policy；**`schema.sql`** 顶部对 **profiles** 策略增加注释说明 upsert 依赖 **update** policy。
- **文档**：`docs/DATABASE.md`、`docs/PRD.md`、`PROJECT_STATUS.md`、`README.md`、本日志。

**未做**

- 未关闭 RLS、未使用 **service_role**、未改 Mock 阅读与高亮逻辑。

**下一步建议**

- 若仍报权限错误，在 Supabase 执行 **`001_profiles_rls_fix.sql`** 后重试 **/account**。

### 2026-05-02 — profiles：`authenticated` 表级 GRANT（002）

**问题**

- 已登录访问 **`/account`** 仍报 **`permission denied for table profiles`（42501）**，hint 指向 **`GRANT … TO authenticated`**：RLS policy 已具备，但 **`authenticated` 角色缺少对 `public.profiles` 的基础 DML 权限**。

**本次修复**

- 新增 **`supabase/fixes/002_profiles_grants_fix.sql`**（可重复执行）：**`GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;`**
- **`supabase/schema.sql`**：在 **`profiles` RLS policies** 之后补充同条 **GRANT**；明确 **不向 `anon` 授予 `profiles`**（个人资料仅登录用户；**`/settings/supabase-test`** 未登录探测仍预期失败）。
- **`docs/DATABASE.md`**：说明 RLS 与 GRANT 分工、**002** 使用场景。
- **`PROJECT_STATUS.md`**、**`README.md`**、本日志。

**未做**

- 未关闭 RLS、未使用 **service_role**、未改其他表 DDL、未给 **anon** 授权 **profiles**。

**下一步建议**

- 在 Supabase **SQL Editor** 执行 **`002_profiles_grants_fix.sql`** 后重试 **/account**；后续为 **`articles` 等表** 在新建库时同步补齐 **authenticated** 的 GRANT（另案处理）。

### 2026-05-02 — Phase 2.2 验证：Supabase Auth + `profiles` 已跑通（仅文档）

**已验证（手动测试，未改页面代码）**

1. **Supabase Auth**：用户可成功登录。
2. **`profiles` RLS**：策略与 **`001_profiles_rls_fix.sql`** 预期一致，已登录用户可读写本人行。
3. **`profiles` 表权限**：**`002_profiles_grants_fix.sql`** 的 **`GRANT … TO authenticated`** 已生效。
4. **`/account`**：可展示当前 **session**、**email**、**user id**，并成功读取 **profile**。

**样例 profile 字段（验证时观测）**

- `self_selected_level` = **B1**
- `estimated_reading_level` = **B1-B2**
- `explanation_language` = **zh**
- `explanation_intensity` = **medium**
- `auto_play_pronunciation_on_click` = **false**

**仍未完成**

- 导入文章写入 **`articles`**；词汇 **`vocabulary_*`**；语法 **`grammar_*`**；**OpenAI API** 分析文章；**Vercel** 部署。

**下一阶段**

- **Phase 2.3**：将 **`/import`** 接入 Supabase，粘贴文章后保存到 **`articles`** 并跳转真实文章详情页（实现另案；本次仅更新文档）。

### 2026-05-02 — Phase 2.3：`articles` 落库、`/articles/[id]`、仪表盘最近文章

**实现**

- **`/import`**（客户端）：**标题**（必填）、**URL** / **来源名称**（可选）、**正文**（必填）、**CEFR 水平**；**「保存文章」** 要求已登录，写入 **`public.articles`**（`user_id`、`topic`/`summary_*`/`detected_article_level` 等为 **null**），成功后 **`router.push(/articles/[id])`**。保存前 **`ensureUserProfile`** 以满足 **`articles.user_id` → `profiles` 外键**。
- **`/articles/[id]`**（新建）：已登录则从 **`articles`** **select** 单行；**RLS** 下他人/不存在则 **「文章不存在或无权访问」**；展示 **title、source_name、url、user_level_at_analysis、created_at、original_text**；桌面端**左右分栏**，右侧 **词汇 / 语法 / 摘要 / 阅读问题** 占位（待 AI）。**未**迁移 **`/articles/mock`** 高亮逻辑。
- **`/dashboard`**：已登录则列出当前用户 **最近 10 篇**（**title、created_at、user_level_at_analysis**），链接至 **`/articles/[id]`**；未登录提示登录。保留原 Mock 统计卡片与 **Mock 阅读** 入口。
- **SQL**：**`supabase/fixes/003_articles_grants_fix.sql`** — **`GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles TO authenticated`**（不授 **anon**）；**`004_articles_rls_fix.sql`** — **`articles`** 四类 policy 幂等重建（**`user_id = auth.uid()`**）。**`schema.sql`** 在 **`articles` policies** 后补充 **`articles` GRANT**。
- **代码**：**`src/lib/supabase/articles.ts`**（类型、`buildArticleInsertRow`、`isValidArticleId` 等）。

**仍未完成**

- **OpenAI API**；词汇/语法表持久化；将 **Mock 高亮** 迁到 **`/articles/[id]`**；**Vercel** 部署。

**说明**

- 未关闭 **RLS**；未使用 **service_role**；**`/articles/mock`** 仍保留。

### 2026-05-02 — 文档：Mock 定义与时间字段 / 学习进度设计

**范围**

- **`docs/PRD.md`**：新增 **§2.1 Mock 与真实文章**；新增 **§12 时间字段与学习进度**（**articles** 的 **read_status / finished_at**；**vocabulary_items / grammar_items** 的 **mastered_at / ignored_at**；**occurrence.created_at** 语义；学习价值与后续 DDL 建议）；**§11.1 / §11.2** 表描述与 occurrence 说明对齐。
- **`docs/DATABASE.md`**：文首 **Mock 与真实文章**；新增 **§10 时间字段与学习进度**（与 schema 现状对照 + 规划列）；原 §10/§11 顺延为 **§11 / §12**。

**原则**

- **当前不强制改 schema**：已有 **created_at / updated_at / last_seen_at**（items）及 **occurrence.created_at** 继续沿用；**read_status、finished_at、mastered_at、ignored_at** 记在 PRD/DATABASE 供后续迁移。

**同步**

- **`PROJECT_STATUS.md`**、**`README.md`**、本日志。

### 2026-05-02 — 文档：产品形态、多端入口与统一数据同步

**范围**

- **`docs/PRD.md`**：**§1.1 产品形态**（Web App 主体、Chrome 插件为桌面导入入口、手机 Web/粘贴/URL/未来 PWA·分享·Share Extension）、**§1.2 数据同步原则**（Supabase 统一 **`profiles` / `articles` / `vocabulary_*` / `grammar_*`**，凡业务数据带 **`user_id`**，跨设备一套学习数据）、**§1.3 商业化**（插件可免费装，计费绑定账号与额度）、**§1.4 开发路线**（Web 文章链路 → 插件 MVP → OpenAI → 手机分享/PWA；自动登录抓取非 MVP）。**§12** 仍为时间字段与学习进度章节。
- **`docs/DATABASE.md`**：**「统一云端与多入口（数据同步）」**；设计目标补充多入口共用 schema；**§10** 与 PRD **§12** 对齐表述。
- **`PROJECT_STATUS.md`**、**`README.md`**、本日志：产品方向、下一步、节号引用。

**未做**

- 未改页面或应用代码。

### 2026-05-02 — Phase 2.3 确认：`articles` 导入与详情页（实现已具备 + 文档对齐）

**代码（此前已合并，本轮核对）**

- **`/import`**：登录后 **`insert`** **`articles`**（**`user_id`、`title`、`url`、`source_name`、`original_text`、`user_level_at_analysis`** 等），跳转 **`/articles/[id]`**；未登录提示 **`/login`**。**后续**：已升级为 **raw → `cleanArticleText` → cleaned → `original_text`**（见本日志下一条目）。
- **`/articles/[id]`**：读库、RLS、左右分栏 + 右侧 AI 占位。
- **`/dashboard`**：最近 **10** 篇 **`articles`**。
- **权限**：**`003_articles_grants_fix.sql`**、**`004_articles_rls_fix.sql`**；**`schema.sql`** 含 **`articles` GRANT**；**RLS** **`user_id = auth.uid()`**；**anon key + 用户 JWT**，无 **service_role**。

**文档**

- **`docs/PRD.md`**、**`docs/DATABASE.md`**、**`PROJECT_STATUS.md`**、**`README.md`**：**Phase 2.3 已落地**；**仍未完成** 含 **OpenAI**、词/语法持久化、高亮迁移、**Vercel**、**Chrome 插件 MVP**。

**构建**

- **`npm.cmd run build`**：已通过。

### 2026-05-02 — /import：作者写入 cleaned 正文（去重）与元信息顺序

**实现**

- [`src/lib/text/parseArticleFromRaw.ts`](../src/lib/text/parseArticleFromRaw.ts)：**`collectAuthorLines`** 全文扫描（排除标题/副标题/发布时间行），**`authorKey`** 合并同一署名多次出现；**`composeCleanedText`** 顺序为 **副标题 → 作者块 → 发布时间行 → `cleanArticleText` 后正文**；**`stripLeadingTitleDuplicate`** 减少与识别标题重复的首行；作者保留原文样式（如 **`Von …`**），**不强制**「作者：」前缀。
- **`/import`**：识别结果与正文区文案标明 **作者与发布时间仅随 `original_text` 持久化**，无独立库字段。

**文档**

- **`docs/PRD.md`**、**`docs/DATABASE.md`**、**`PROJECT_STATUS.md`**、**`README.md`**、本日志。

**构建**

- **`npm.cmd run build`**：已通过。

### 2026-05-02 — /import：瑞士引号长标题与 lead 行识别

**问题**

- 首行 **`«…‹…›…»`** 类长标题中的 **`›` / `»`** 被 **`isBreadcrumbLine`** 误判为导航面包屑（**`bc >= 2`**），导致 **`findContentStart`** 跳过首行，**`suggestedTitle`** 落到下一行问句。
- 标题候选长度上限偏紧；副标题收集在 **第二行较长** 时过早 **`break`**，无法保留 **两行 lead**。

**修复（[`parseArticleFromRaw.ts`](../src/lib/text/parseArticleFromRaw.ts)）**

- **`looksLikeQuotedNewsHeadline`**：行首为 **`«` `‹` `„` `"`** 及常见 Unicode 弯引号时，**不作为面包屑**。
- **`isBadTitleCandidate`**：合法标题长度 **8～220** 字符（问句、引号标题均可）。
- **`collectSubtitleLines`**：**lead 最多 2 行**，去掉「已有 1 行且下一行 **>180** 即停止」的规则，保证问句 + 导语两行均可入库。
- 文件顶部增加 **瑞士媒体回归样例**注释；导出别名 **`parsePastedArticleText`**（与 **`parseArticleFromRawInput`** 相同）。

**未改**

- **schema、Auth、profiles、`/dashboard`、`/articles/[id]`、OpenAI、Chrome 插件**。

**构建**

- **`npm.cmd run build`**：已通过。

### 2026-05-02 — Phase 2.5：Supabase GRANT、dbItemId 与错误展示

**权限（42501）**

- 已核对 **[`supabase/fixes/005_vocabulary_grants_fix.sql`](../supabase/fixes/005_vocabulary_grants_fix.sql)**、**[`supabase/fixes/006_grammar_grants_fix.sql`](../supabase/fixes/006_grammar_grants_fix.sql)**：对 **`vocabulary_*` / `grammar_*`** 的 **`GRANT … TO authenticated`** 与 **`user_id = auth.uid()`** 的 RLS 幂等策略；文件头补充 **在 SQL Editor 执行** 的说明；**`supabase/schema.sql`** 尾部追加与两文件一致的 **GRANT**（新库即具备表级权限）。

**UI id 与数据库 uuid**

- **`ArticleVocabItem` / `ArticleGrammarItem`** 新增 **`dbItemId: string | null`**：**`id`** 仅作前端键（**`v-item-…` / `g-item-…`** 等）；**`dbItemId`** 为 **`vocabulary_items.id` / `grammar_items.id`**。
- **`fetchArticleManualVocabulary` / `fetchArticleManualGrammar`**：返回 **`id: \`vocab-${row.id}\`` / \`grammar-${row.id}\``**，**`dbItemId: row.id`**。
- **`persistManualVocabularyItem` / `persistManualGrammarItem`**：写库成功后 **`id` 保留传入项的 UI `id`**，**`dbItemId`** 设为服务端主键；词汇 occurrence 前端 **stable id** 为 **`${item.id}-${start}-${end}`**（与全文扫描一致）。
- **`InteractiveArticleReader`**：**掌握 / 忽略 / 恢复** 调用 **`updateVocabularyItemMastery` / `updateGrammarItemMastery`** 时传入 **`dbItemId`**；若 **`dbItemId === null`** 则提示「尚未保存到云端」。

**错误文案**

- **`formatSupabaseOrUnknownError`**：合并输出 **message、code、hint、details**。**`vocabulary.ts` / `grammar.ts`** 的 **`catch`** 与掌握状态 **UPDATE** 的错误返回值改用上述格式化。

**文档**

- **`docs/DATABASE.md`**：Phase 2.5 执行 **005 + 006** 的说明与 **dbItemId** 约定。

**未改**

- **`/import`、`/dashboard`、OpenAI、Chrome 插件**；**不关闭 RLS、不授 anon、不用 service_role**。

**构建**

- **`npm.cmd run build`**：已通过。

### 2026-05-02 — Phase 2.5：词汇 occurrence 全文扫描与 item 去耦

**问题**

- 仅对 **右侧词汇卡片/item** 去重（按 `normalized_key` / `vocabulary_item_id`）是正确的，但此前 **`expandVocabItemsWithRepeatedSurface`** 等路径容易让用户侧 occurrence **只剩一条**，左侧只高亮一处。

**修复**

- **`finalizeArticleVocabularyItems`**：用户侧词条（`user_added` / `ai_detected_then_user_confirmed`）调用 **`rebuildUserStyleVocabOccurrencesFromArticle`**，用 **`display_word`（及兜底 `fallbackMatchText`）** 在当前 **`articlePlain` 上全文扫描**（先精确子串，若无命中再大小写不敏感），生成 **全部 occurrence**，**仅按 start/end 隐含唯一**；**occurrence id** 统一为 **`${item.id}-${start}-${end}`**，按 **start 升序**。
- **课文 AI 词**（`ai_detected`）仍走 **`expandVocabItemsWithRepeatedSurface`**，语法不做全文扫描变更。
- **`/articles/[id]`**：**`buildPlainTextArticleLayout`** 的输入改为 **标题 + 空行 + 正文**（`articles.title` 与 `original_text` 拼接；无标题则仅正文），使 **标题中的词** 也计入 occurrence 与高亮偏移。
- **Supabase 恢复**：**`fetchArticleManualVocabulary`** 后同样 **`finalizeArticleVocabularyItems`**，前端展示以当前正文全文重算；数据库 occurrence 行仍可少于全文命中条数（持久化策略不变）。
- **`persistManualVocabularyItem`**：返回的 occurrence **id** 与 UI 一致，使用 **`${item.id}-${start}-${end}`**（UI item id），不再用 DB 行 uuid 覆盖（避免与左侧/右侧 **data-occurrence-id** 不一致）。

**辅助**

- **`alignVocabOccurrenceIdAfterFinalize` / `alignVocabOccurrenceIdAfterPersist`**：合并/保存后按 **start/end** 对齐用户选中的那一条 occurrence，供右侧选中与滚动定位。

**未改**

- **schema、Auth、profiles、`/import`、`/dashboard`、OpenAI、Chrome 插件**（按任务约束）。

**构建**

- **`npm.cmd run build`**：已通过。

### 2026-05-02 — /import：结构识别（标题/副标题/发布时间/作者）与正文合成

**实现（历史）**

- 初版 **`parseArticleFromRawInput`**：文首面包屑跳过、**标题** 与 **Lead/副标题**、全文首条发布时间行；**作者** 曾仅为预览、不写入正文（已由上条 **「作者写入 cleaned 正文」** 替代）。
- **`/import`**：粘贴后 **400ms 防抖**自动解析 + **「清理正文」**；**`title` 仅在为 empty 时用识别标题填充**；**识别结果** 卡片；**保存**：**`original_text = cleaned_text`**。
- **`cleanArticleText`**：面包屑、**Abo**、**仅 1–3 位纯数字行**（疑似评论数）等剔除。

**文档**

- **`docs/PRD.md`**、**`docs/DATABASE.md`**、**`PROJECT_STATUS.md`**、**`README.md`**、本日志。

**构建**

- **`npm.cmd run build`**：已通过。

### 2026-05-02 — /import：raw_pasted_text → cleanArticleText → cleaned_text → articles.original_text

**实现**

- 新增 [`src/lib/text/cleanArticleText.ts`](../src/lib/text/cleanArticleText.ts)：**`cleanArticleText(input)`** 返回 **`cleanedText`、`removedLineCount`、`originalCharCount`、`cleanedCharCount`**（`\r\n` 归一、合并空行、关键词/图片署名/短噪行等规则，偏保守）。
- **`/import`**：**粘贴原始内容**、**清理后的正文** 两区；**清理正文**、**保存文章**；保存前校验 **`cleaned_text`** 非空，否则提示「请先清理正文或填写清理后的正文」；**`buildArticleInsertRow.original_text`** 仅使用 **`cleaned_text`**。

**未改**

- **Auth**、**profiles**、**`/articles/mock`**、**`/articles/[id]`** 读字段、**`/dashboard`** 列表逻辑（仍读 **`original_text`**）。

**文档**

- **`docs/PRD.md`**、**`docs/DATABASE.md`**、**`PROJECT_STATUS.md`**、**`README.md`**、本日志。

**构建**

- **`npm.cmd run build`**：已通过。
