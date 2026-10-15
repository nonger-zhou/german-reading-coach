# 开发记录（Development Log）

> 只保留近期记录；**2026-05-02 至 2026-05-19** 的全部记录（Phase 1–4、Grammar v2、词汇实验、导入与阅读页迭代等）已归档到 [`docs/archive/DEVELOPMENT_LOG_2026-05.md`](./docs/archive/DEVELOPMENT_LOG_2026-05.md)。
> 新条目加在「更新记录」最上方；单个文件超过约 60 KB 时再按月归档。

## 更新记录（按任务追加）

### 2026-10-15 — 英语扩展 · 第 1 步：语言字段与数据隔离（分支 `feat/english-language`，界面无变化）

**背景**：按 PRD §1.5 增加英语学习，德语、英语为两个独立学习空间（顶栏切换，文章库 / 词库 / 语法库 / 复习 / AI 推荐 / 水平设置都只针对当前语言），德语现有功能与数据不受影响。整体方案分 6 步，本条为第 1 步。

**本次完成**
- **迁移 `supabase/fixes/010_multilanguage.sql`**（须在 Supabase SQL Editor 执行，**先迁移、再部署**）：`articles` / `vocabulary_items` / `grammar_items` 增加 `language`（`de`/`en`，默认 `de`，已有数据全部为德语）；词库、语法库唯一键加入 `language`（德语 "die" 与英语 "die" 为两条词条）；`profiles` 增加 `target_language`（默认 `de`）与 `self_selected_level_en`。只加列、放宽唯一键，可重复执行。`schema.sql` 同步。
- **`src/lib/language/learningLanguage.ts`**：语言类型、默认德语、标签与 locale。**`useLearningLanguage.ts`**：当前学习语言（真相源 `profiles.target_language`，本机缓存首屏），尚无切换入口，所有人仍为德语。
- **读写全部带语言**：整文分析读取词库画像（已掌握 / 学习中 / 自适应分界线）与语法过滤**只读文章语言**（语言以数据库中的文章为准）；保存词汇 / 语法时按 (语言, 词) 查重与插入；补充解释时的词性冲突检查限定同语言；新文章写入 `language`（默认德语）。
- **列表按语言过滤**：仪表盘（最近文章与三项统计）、文章库、词库、语法库、复习。
- **复习排期按语言分开存**：德语沿用原 key `grc.review.v1.<userId>`（已有进度不丢）；英语用 `grc.review.v1.en.<userId>`。必须分开：复习时会清掉不在本次词表里的记录，共用 key 会导致英语复习清空德语进度。
- **测试 `src/lib/language/languageIsolation.test.ts`（10 条）**：默认德语；画像 / 已掌握键 / 语法过滤按语言查询；文章语言以库为准；英语 "die" 不并入德语词条；不传语言时保存路径仍为德语；复习 key 德语不变、英语复习不影响德语进度。

**主要文件**：`supabase/fixes/010_multilanguage.sql`、`supabase/schema.sql`、`src/lib/language/*`、`src/lib/supabase/{vocabulary,grammar,articles}.ts`、`src/lib/review/reviewQueue.ts`、`src/app/api/analyze-article/route.ts`、`src/app/{dashboard,articles,vocabulary,grammar,review}/page.tsx`、`src/app/articles/[id]/page.tsx`、`src/components/InteractiveArticleReader.tsx`（仅新增 `persistLanguage` 属性并传给保存函数）。

**影响面 / 德语回归**：德语路径只多了 `language = 'de'` 过滤与写入，选词、提示词、阅读交互未改；原有 96 条测试全部通过。
**当前状态**：未合并到 `main`；**迁移执行前，本分支代码不能上线**（查询 `language` 列会失败）。
**已知问题**：沙箱无法访问 Google Fonts，本地 build 时临时去掉字体加载验证（未提交）；Vercel 构建不受影响。
**下一步**：第 2 步 —— 语言配置层、英语词频表与英语选词引擎。
**验证**：`npm test`（106）/ `npm run build` 通过。

### 2026-10-15 — 阅读水平怎么选（对照表）

**本次完成**
- **`docs/USER_MANUAL.md` §4.4**：德语（歌德 / telc / ÖSD / TestDaF / DSH / 无证书自评）与英语（高考、四六级、考研、专四专八、雅思、托福 → 词汇量 → CEFR）对照表；说明词汇量比等级更重要、可按词汇量测试结果选、系统会自动校准。
- **软件内 `/help`** 新增「阅读水平怎么选」（德语对照表）；**设置页 / 导入页**的水平选择提示后加「不知道选哪个？看对照表 →」（`GermanLevelSelect.tsx`）。
- **`docs/PRD.md` §1.5.3**：写入英语对照表，并规定英语功能上线时须在水平选择处与 `/help` 展示该表；英语词频分界线须按词汇量另行标定。
**验证**：`npm test` / `npm run build` 通过。

### 2026-10-15 — 软件内使用说明 `/help`

**原因**：推荐规则、状态含义、长文、复习等此前只写在仓库文档里，使用者在软件内看不到；词库页副标题仍写「后续可扩展复习」。
**本次完成**
- 新页面 **`src/app/help/page.tsx`**（服务端静态页）：一篇文章怎么学、导入方式（含插件读全文）、AI 推荐哪些词（学习中必推 / 已掌握不推 / 词频与水平 / 搭配 / 自适应 / 专名过滤 / 不设上限）、学习状态与「又不会了」怎么办、长文章、复习规则、外部深入解释与全文翻译、常见问题。
- 入口：首页简介 + 「复习」「使用说明」两张卡片；页脚链接；阅读页「阅读帮助」新增一句推荐规则 + 「完整说明 →」；词库页副标题改为状态效果说明并链接复习与说明；语法库副标题去掉过时文字。
- 规则：`AGENTS.md` / `CLAUDE.md` 要求改动用户可感知规则时同步更新 `/help` 与 `USER_MANUAL.md`；`USER_MANUAL.md` 顶部注明两者须一致。
**验证**：`npm test` / `npm run build` 通过。

### 2026-10-15 — 协作规则：开始前先 pull

`CLAUDE.md` / `AGENTS.md` 增加「开始前先 `git pull origin main`」，与「改完即提交」配对，避免多个 AI 工具 / 多台设备在旧代码上各改各的。（文档-only，未改代码。）

### 2026-10-15 — 阅读页组件拆分（第一步，行为不变）

**本次完成**：把 `InteractiveArticleReader.tsx` 顶部约 540 行与组件状态无关的代码原样移到 `src/components/articleReader/`：
- `domSelection.ts`：滚动定位、选区矩形、选区弹层位置、点按取词、高亮命中判断。
- `learningItemHelpers.tsx`：提示文案常量、外部深入解释链接、AI 补充解释合并、词性中文、解释完整性判断、来源徽标。
- `ReadingMasteryControls.tsx`：学习状态下拉与标题操作区。
主文件从 4596 行降到约 4110 行；代码逐字移动，仅加 `export` 与 import，`tsc` / eslint 零报错。
**未做**：组件主体（约 3900 行，状态与事件高度耦合）未拆；建议今后每次改到某块功能时顺手拆出该块，并在线上手动点验（点按高亮、拖选加词、外部深入解释、AI 预览保存）。
**验证**：`npm test`（96）/ `npm run build` 通过。

### 2026-10-15 — 复习功能 `/review`

**本次完成**
- 新页面 **`src/app/review/page.tsx`**，顶部导航新增「复习」（`AppShell.tsx`）。
- 复习总词库「学习中」词条，每组 ≤20：正面德语词头（名词带冠词）+ 最近一次原文例句（高亮本词）+ 发音；翻面看中文与简单德语解释、可跳原文。
- 三个操作：还不熟（明天再来）/ 记住了（间隔 1→3→7→14→30 天）/ 已掌握（调用 `updateVocabularyItemMastery` 写入总词库，此后选词 v2 不再推荐）。
- 调度逻辑 **`src/lib/review/reviewQueue.ts`**（纯函数 + 单测 5 项）：到期优先，其次从未复习（最近遇到优先）；排期存 localStorage（按账号），**不改数据库结构**；载入时清理已不在学习中的记录。
- 文档：PRD §5.0、USER_MANUAL §10.5、README、PROJECT_STATUS 页面表。
**已知限制**：排期不跨设备同步（需新表，后续可选）。
**验证**：`npm test`（96）/ `npm run build` 通过（`/review` 静态路由）。

### 2026-10-15 — 文档归档 + 提交 / 部署规则

**本次完成**
- **`DEVELOPMENT_LOG.md`**：2026-05-02 至 05-19 的 212 条记录归档到 `docs/archive/DEVELOPMENT_LOG_2026-05.md`，主文件从 246 KB 降到约 8 KB。
- **`PROJECT_STATUS.md`**：「最近更新」中 175 条 2026-05 及更早条目归档到 `docs/archive/PROJECT_STATUS_UPDATES_2026-05.md`，主文件从 74 KB 降到约 18 KB。
- **`AGENTS.md` / `CLAUDE.md`**：部署规则改为「改完即 commit + push 到 main；部署只走 Git；禁止本机 `vercel:prod`」；开发日志改为在顶部追加、无需读归档。原规则要求助手本机 `vercel:prod`，正是 5 月本机改动未提交、三处版本不一致的根源。
- **`README.md`**：部署说明同步。
**验证**：`npm test` / `npm run build` 通过。

### 2026-10-15 — 实验代码移出正式代码

**本次完成**
- 新建 **`experiments/vocabulary-2026-05/`**（含 README）：移入 11 个 `*.live.test.ts` OpenAI 对照实验、10 个生产未引用的实验模块（实验 prompt / schema / 拆分调用、已停用的全名词重试与诊断及其单测）、`run-vocabulary-strategy-compare.mjs`，以及 `scripts/*-report.json`、根目录 `vocab-gaullismus-report.json`（→ `reports/`）。
- 移动后的文件里，对仍在 `src/lib/articleAnalysis/` 的模块改为 `@/lib/articleAnalysis/...` 引用；报告输出路径改到 `experiments/vocabulary-2026-05/reports/`；`package.json` 的 `vocab-*:try` 脚本与审计脚本输出路径同步。
- `tsconfig.json` 排除 `experiments`；`vitest.config.ts` 默认测试排除 `experiments/**`；`vitest.live.config.ts` 包含 `experiments/**/*.live.test.ts`。
- 结果：`tsc --noEmit` **零报错**（原有 4 个 live 测试类型错误不再计入）；`npm test` 91 项通过（少的 6 项是已停用代码的单测，随代码移走）；`npm run build` 通过。

### 2026-10-15 — 部署前自动测试

**本次完成**
- `package.json` 新增 **`vercel-build`**：`vitest run && next build`。Vercel 构建优先执行该脚本，单元测试失败则构建失败、不上线。
- `.github/workflows/vercel-production.yml` 改为 **CI**：push / PR 时跑 `npm test` + `npm run build`，去掉原 vercel-action 部署步骤（部署统一走 Vercel Git 集成，避免重复部署；原步骤依赖未配置的 secrets）。
- `docs/DEPLOY_VERCEL.md` §八补充说明。
**注**：上述两个文件的改动已在提交 `c0b4e29` 中推送（提交信息误写为 "probe"，内容即本条；为不改写 main 历史未强推修正）。

### 2026-10-15 — 长文分段分析

**原因**：整文分析只送正文前 1 万字符，用插件导入的付费长文后半篇没有任何推荐。
**本次完成**
- 新增 `src/lib/articleAnalysis/splitArticleForAnalysis.ts`：按段落（必要时按句子）切成 ≤1 万字符的段，最多 4 段。
- `analyze-article/route.ts`（默认词汇模式）：第 2–4 段与第 1 段**并行**请求，各段独立做选词 v2 过滤（候选词、学习中必推都按该段计算），再用 `mergeVocabularyLists` 按词典形去重合并；阅读问题只取第一段；某段失败只加 warning。legacy（含 grammar）路径不变，仍只分析第一段。
- 费用：长文按段数线性增加（4 段约为短文 4 倍）；耗时基本不增加（并行）。
**验证**：`npm test`（97）/ `npm run build` 通过。

### 2026-10-15 — 选词 v2：过滤专有名词

**原因**：词频表把人名 / 政党名当成「罕见词」放进候选，例如词库里出现 `das Rassemblement`（法国政党）。
**本次完成**
- `articleCandidates.ts`：候选词标注「疑似专名」（全大写缩写，或大写、不在词表、也拆不成已知复合词——复合词按 2–3 段已知词 + 连接成分 s/es/n/en/e 判断）。仅作为给模型的提示，不直接删除。
- `selectVocabulary.ts`：输出后剔除——模型释义写明是人名、地名、政党、公司、品牌、机构、媒体等，或原文为全大写缩写；**学习中的词不受影响**。路由日志新增 `droppedProperNames`。
**已知限制**：维基词表也收录常见人名（如 Gianluigi、Köhler），这类只能靠模型释义判断。
**验证**：`npm test`（95）/ `npm run build` 通过。

### 2026-10-15 — 总词库分页

**原因**：词库约 700 条时一次性渲染全部卡片，浏览器明显卡顿。
**本次完成**：`src/app/vocabulary/page.tsx` 每页 50 条，列表上下各一个分页栏（上一页 / 下一页 / 第 x–y 条）；切换搜索、状态、等级、时间分组时回到第 1 页；统计卡与各 Tab 计数仍按全部词条计算。
**验证**：`npm test` / `npm run build` 通过。

### 2026-10-15 — 修复：总词库「读取词库失败 Bad Request」

**原因**：`/vocabulary` 用 `.in("vocabulary_item_id", 全部 ID)` 一次查释义与出处；词库约 700 条时 URL 超长，Supabase 返回 400。数据本身完好（核对：698 词、1487 出处、62 篇文章、27 条语法）。与选词 v2 无关，词条数增长到一定量即触发。

**本次完成**
- 新增 **`src/lib/supabase/inChunks.ts`**（`selectInChunks`，每批 100 个 ID）。
- **`src/app/vocabulary/page.tsx`**：释义、出处、文章标题改为分批查询；主词条列表改为每页 1000 行分页读取（避免超过 1000 条后被静默截断）。
- **`src/app/grammar/page.tsx`**：出处与文章标题同样分批（预防）。

**验证**：`npm test`（93）/ `npm run build` 通过。

### 2026-10-15 — 选词 v2：只推用户不认识的词（词频表 + 词库画像）

**背景**：本地 5 月 17–19 日的工作此前未提交到 GitHub（线上为 5 月 25 日 CLI 部署）；本次先原样提交为 `local-work` 分支，再在其上叠加选词 v2。

**问题**：推荐词几乎全是名词、偏简单（很多已掌握），真正不会的词（动词、副词、连接词）反而漏推。原因：
- 选词完全由 `gpt-4o-mini` 凭感觉完成，只有一个 CEFR 标签可参考；
- 已掌握剔除要求 `normalized_key` + 词性**完全一致**，而两者都由模型自由生成，常对不上；
- 手动再次添加已掌握的词时，状态不变，仍被剔除。

**本次完成**
- **新增 `src/lib/vocabSelection/`**：德语词频表（8 万词，OpenSubtitles + 德语维基合并；生成脚本 `scripts/build-german-frequency.py`）、`frequency.ts`（屈折回退、瑞士 ss→ß、去冠词比对键）、`userVocabProfile.ts`（等级分界线 + 自适应）、`articleCandidates.ts`、`selectVocabulary.ts`（候选/必推 prompt 段 + 输出后确定性过滤）。
- **`src/app/api/analyze-article/route.ts`**：vocab-first 与 legacy 两条路径都接入选词 v2；模型改为 **`gpt-5-mini`**（`reasoning_effort: low`），`OPENAI_ANALYSIS_MODEL` 可覆盖。
- **`openaiArticleAnalysis.ts`**：两个 SYSTEM_PROMPT 均加【用户词汇画像优先】段。
- **`src/lib/supabase/vocabulary.ts`**：`fetchVocabularyProfileRowsForArticleAnalysis`；`persistManualVocabularyItem` 新增 `reactivateIfMastered`。
- **`InteractiveArticleReader.tsx`**：框选添加、表单添加两处传 `reactivateIfMastered: true`（仅此 2 行）。
- **未改动**：外部深入解释、整篇翻译外链、框选、高亮、保存流程、按需语法解释、导入。

**验证**：`npm test` 全部通过；`npm run build` 通过。未做真实 OpenAI 调用，需在 App 内重新分析文章实测。

**已知问题**：词频是近似，需靠用户标记校准；复合词多不在词频表内，一律进入候选。

**部署**：PR #2 合并到 main（`ecaabe8`），已 Promote 为 Production。过程中曾误把基于旧 GitHub 代码的 PR #1 自动部署上线，已 Instant Rollback 到 5 月 25 日版本后再上线 PR #2。今后**只走 Git 合并部署**，不再本机 `vercel:prod`（见 `docs/DEPLOY_VERCEL.md` §八）。

**文档**：`docs/USER_MANUAL.md` §7.2、§8.1–8.2、§9.2 改为选词 v2 规则；`docs/DEPLOY_VERCEL.md` 新增 §八。
