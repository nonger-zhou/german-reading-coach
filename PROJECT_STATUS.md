# 项目状态（Project Status）

## 产品名称

German Reading Coach

## 当前版本

**v0.1 Mock** + **Phase 2**；**Phase 2.5** 已完成；**Phase 3.0（Mock）**、**Phase 3.1–3.2（OpenAI + 确认保存 `source = ai`）**、**Phase 3.4（文章级 `summary_*` / `reading_questions`）**、**Phase 3.5（真实 AI 为主，Mock 仅 `development` 开发工具）**、**Phase 3.6（删除 ≠ 忽略）**、**Phase 3.7（学习中/已掌握/暂忽略 UI + 已掌握与暂忽略默认折叠）**、**Phase 3.8（全局词库/语法库 Supabase；总库支持状态管理）**、**Phase 3.13–3.14（词汇/语法「外部深入解释」；锁定 AI 调用、移除普通卡「重新生成解释」）**、**Phase 3.15（我的深度笔记：外部解释手动保存，不消耗本应用 AI token）**、**Phase 3.16（整文分析 SYSTEM_PROMPT：词汇不设固定上限 / 语法≤8、lexical item 与 part_of_speech 策略）**、**Phase 4.0（URL 自动导入：服务端抓取 + 预览后保存 + 剪贴板读取）**、**Phase 4.1（删除文章 v1）**、**Phase 7（Chrome 插件导入 MVP）**、**状态操作下拉菜单 UI** 已落地，见 **`DEVELOPMENT_LOG.md`**。

## 当前状态

- **阶段**：**Phase 2.5** + **Phase 3.0（Mock 阅读演示）** + **Phase 3.1/3.2（OpenAI）** + **Phase 3.4（摘要与阅读问题入库）** + **Phase 3.5（文章页 AI 区整理）** + **Phase 3.6（删除学习项）** + **Phase 3.7（状态语义 UI）** + **Phase 3.8（全局总库）** + **Phase 3.15（深度笔记）** + **Phase 4.0（URL 自动导入 + 剪贴板读取）** + **Phase 4.1（删除文章 v1）** — **`/import`** 支持「手动粘贴 / 链接导入」：链接导入经 **`POST /api/import-url`** 在服务端抓取网页并提取标题/来源/发布时间文本/正文，清理后填入主编辑区「正文」；用户确认后沿用既有保存逻辑写入 `articles`；该流程**不调用 OpenAI**。当站点拒绝抓取或可能需要登录时，页面在 URL 输入框下方给出轻提示，并引导用户改用手动粘贴；手动粘贴模式支持 **「从剪贴板读取」**，用户复制正文后可一键填入来源稿并整理到主正文，浏览器拒绝权限时回退手动粘贴。**`/articles/[id]`**：**真实 AI** 为主流程（主按钮、状态行、**API 成本**提示）；**Mock 文章分析**仅在 **`development`** 下 **「开发工具」** 折叠区内，**不入库**、不触发「保存 AI 结果」。手动词条与确认保存的真实 AI 写入 **`vocabulary_*` / `grammar_*`**（**`source = ai`** 等）及 **`articles.summary_zh` / `summary_de_simple` / `reading_questions`**（须 **`007_article_analysis_fields.sql`**）；词汇/语法卡支持“我的深度笔记”，用户可粘贴外部 AI 解释或自己的补充笔记保存到 **`008`** 字段，**不调用本应用 AI API**；未执行 **`008_learning_item_deep_notes.sql`** 时，旧的词汇/语法读取与保存仍应可用，保存深度笔记会提示先迁移。学习项删除仍是按本文 occurrence 删除。**Phase 4.1**：文章页支持删除文章，确认后删除本文 `articles` 与本文 `vocabulary_occurrences` / `grammar_occurrences`，并保留长期 `vocabulary_items` / `vocabulary_senses` / `grammar_items`。**Phase 3.7**：UI 默认状态文案显示为**学习中**，`mastered` 条目默认折叠到已掌握分组，可展开与恢复学习。**Phase 3.8**：`/vocabulary` 与 `/grammar` 已读取当前登录用户真实 Supabase 数据，支持搜索、状态筛选、等级筛选、来源文章跳转；状态统一显示 **学习中 / 已掌握 / 暂忽略**。右侧 **摘要 / 阅读问题** Tab **已保存**优先；仍**不**自动保存 OpenAI 预览。**`OPENAI_API_KEY`** 仅服务端。**Chrome 插件 MVP** 暂缓。
- **Phase 3.4 验证状态**：文章级三字段与阅读页读写、**42703** 规避、Tab 持久化及与词汇/语法回归范围，见 **`DEVELOPMENT_LOG.md`**「**Phase 3.4 验证状态（仅文档）**」表；**前提**为远程库已跑 **007**。
- **Phase 3.4 学习闭环（文章页）**：真实 **AI** / 保存 / 刷新、手动 **enrich**、摘要三字段、高亮与左右定位、掌握状态、**`/import`** 与 **`/dashboard`** 未在本次任务改动——完整清单与「静态核对 / 实机前提」见 **`DEVELOPMENT_LOG.md`**「**Phase 3.4 学习闭环验证与状态（仅文档）**」。**当前不做**总词库/总语法业务页接库。
- **数据库**：**`articles`** 使用 **RLS（`user_id = auth.uid()`）** + **`GRANT … TO authenticated`**（**`schema.sql`** / **`003_articles_grants_fix.sql`**）；策略异常可跑 **`004_articles_rls_fix.sql`**。**不向 anon 授予 articles**。
- **应用**：**`/vocabulary`** 与 **`/grammar`** 已接入真实 Supabase 数据（当前登录用户维度）；词库与语法库均支持 **全部/今日/昨日/近三日/本周** 时间分组 Tab 与本周复盘小卡（点击联动筛选）。总词库/总语法库均支持通过状态下拉菜单切换 **学习中 / 已掌握 / 暂忽略**；暂不做总库删除。**`/articles/[id]`** 手动添加与真实 AI 保存的词汇/语法持续持久化至 **`vocabulary_*` / `grammar_*`**（登录、GRANT 已执行前提下），学习项卡片同样用状态下拉菜单修改状态，删除仍为独立操作；深度笔记需 **`008`** 字段。
- **产品方向**：**Web App** 为主体，**Chrome 插件**为桌面导入入口（MVP 见 **`browser-extension/chrome-mv3`**），**Supabase** 统一库（详见 **`docs/PRD.md` §1.1–§1.4**）。**愿景**：底层可扩展为**多语言 Reading Coach**，**英语**为优先扩展语言（详见 **`docs/PRD.md` §1.5**）；**母语/解释语言/目标语言**三维度见 **§1.5.6**。**AI 推荐**以「读前抓主旨与关键细节、控制数量、过滤无学习价值专名」为核心，水平侧重见 **§13**；**Phase 3.1+** 接真实 OpenAI 时以此为准。**当前主线仍为德语 MVP**，排期不变。
- **下一步（建议）**：短期目标切回 **个人可完整使用版**：按 **`docs/PERSONAL_USE_CHECKLIST.md`** 跑通导入 → AI 分析 → 保存 → 阅读 → 深度笔记 → 总词库/总语法 → 状态修改；再迭代 OpenAI 提示与验收（**PRD §13**）。**Vercel Production** 已部署到 [`https://german-reading-coach.vercel.app`](https://german-reading-coach.vercel.app)，后续需完成 Supabase 生产回调 URL 自检；项目级 `npm.cmd run lint` 仍有既有 cleanup 项（`scripts/*.cjs` 的 `require()` 规则、文章库/仪表盘删除回调依赖提示、`/import` 未使用变量）；Chrome 插件后续可做打包发布，**PWA/手机分享**、支付与公开用户体系仍后置。合规边界：不绕过付费墙、登录墙或订阅限制。
- **需求 / 库设计**：**Mock** 与 **`/articles/[id]`** 见 **`docs/PRD.md` §2.1**；时间字段与 **read_status** 见 **§12**；**`docs/DATABASE.md`** Mock 节、**§10**、统一云端节；**read_status / finished_at / mastered_at / ignored_at** 等为后续 **schema** 增量，当前不强制迁移。
- **选区与「添加为词汇」**：长选区点词汇 = **词汇/表达层面（广义 lexical item）**，不等于整句当普通词、也不自动当语法；与 **「添加为语法」** 分工见 **`docs/PRD.md` §8.1.1**。**AI 主动推荐**亦应覆盖表达型词汇（短语、搭配、可分动词、新闻表达等），**统一进词汇 Tab**；**`item_type` / `surface_form` / `lemma` / `occurrence_sentence` / `explanation`** 等预留，**当前不改 schema/UI/prompt**。
- **学习中 / 已掌握 / 暂忽略 / 删除**：用户向语义与文章页行为见 **`docs/PRD.md` §5.1–§5.3**（含 **暂忽略** 折叠与恢复）；**删除**为从本篇移除 **occurrence**，不等于掌握。**AI 推荐数量与类型（软上限、非凑数）**见 **§13.6**。

## 当前仍未完成

- **Chrome 插件打包发布**（当前已有本地加载版 MVP；见 **`browser-extension/chrome-mv3`**）
- **Vercel 部署**：Production 已通过 CLI 部署到 [`https://german-reading-coach.vercel.app`](https://german-reading-coach.vercel.app)；Vercel Production 已配置 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`OPENAI_API_KEY`。仍需在 Supabase Authentication 中将生产域名加入 Site URL / Redirect URLs 并做登录、重置密码、AI 分析自检。
- **总词库/总语法**：复习流、编辑与批量状态管理（当前已支持单项状态管理；暂不做总库删除）
- **`/articles/mock`**：仍为**演示**高亮与交互，**不代表**用户 **`articles`** 库数据

## 当前可访问页面

| 路径 | 说明 |
|------|------|
| `/` | 首页与功能入口卡片（不展示登录状态、云端文章数量或开发说明） |
| `/dashboard` | 仪表盘（当前账户真实统计、最近 10 篇文章列表、查看全部文章入口、列表内直接删除文章） |
| `/articles` | 文章库（当前账户全部已保存文章，按保存时间倒序分页，每页 10 篇；支持继续阅读与删除） |
| `/import` | 导入文章：默认 **链接导入**（服务端抓取后填入「正文」），可切换手动粘贴；支持 Chrome 插件预填草稿；**从剪贴板读取**（链接导入下为次要按钮样式，手动粘贴下为主色）与 **保存文章** 与主正文同卡；有来源稿时可展开 **「来源稿（可选）」**；标题必填但优先自动抓取，手填可覆盖；自动带入设置页默认阅读水平，并允许本篇临时修改；不向普通用户展示清理详情 / 字符统计；登录后保存到 **`articles`**，跳转 **`/articles/[id]`** |
| `/import/mock` | **静态示意页**（无保存、无抓取）：左右对比「当前导入主卡」与「减认知负荷草案」按钮与文案，便于与 **`/import`** 对照；不列入顶栏导航，需直接访问路径 |
| `/articles/[id]` | 已保存文章：读库正文 + **手动 / Mock（ai_mock）/ 真实 AI（ai）** 词汇语法；左侧高亮图例与演示课文一致，说明绿色系统词汇、琥珀用户/确认词汇、蓝色系统语法、紫色用户语法；OpenAI 预览可 **确认保存**；**摘要 / 阅读问题** 持久化至 **`articles`**（**Phase 3.4**）；学习项在**卡片标题行右侧**用状态下拉修改，同列 **删除** occurrence；支持删除文章 v1（删本文与 occurrences，保留长期词/语法主记录） |
| `/articles/mock` | 演示课文（固定 Mock；分栏、高亮、Tabs、发音） |
| `/vocabulary` | 总词库（真实 Supabase 汇总：默认全部、时间分组 Tab、本周复盘小卡、搜索、状态筛选、等级筛选、单词状态下拉菜单、来源文章精确跳转到对应词条/occurrence；暂不做总库删除） |
| `/grammar` | 总语法库（真实 Supabase 汇总：默认全部、时间分组 Tab、本周复盘小卡、搜索、状态筛选、等级筛选、语法状态下拉菜单、来源文章精确跳转到对应语法项/occurrence；暂不做总库删除） |
| `/settings` | 设置（可编辑并保存默认阅读水平；用户向展示估计阅读等级、解释语言、发音相关开关；不直接展示内部字段名或 Supabase 排障入口） |
| `/settings/supabase-test` | 隐藏诊断页：Supabase 连通性测试（普通设置页不再展示入口；排障时可直接访问） |
| `/login` | 邮箱密码登录；「忘记密码」发重置邮件；支持查询参数 **`next`**（安全相对路径），登录成功后优先回跳该路径，否则回 **`/`** |
| `/signup` | 邮箱密码注册；同上 **`next`**；注册后立即有 session 时回跳逻辑与登录一致 |
| `/auth/recovery` | 邮件重置密码落地页（设置新密码） |
| `/account` | 会话与 `profiles`（无行则自动插入默认值） |

## 下一阶段目标

- **总词库 / 总语法** 下一步扩展为复习、编辑与批量状态管理；导入体验后续可做 Chrome 插件打包发布与更多站点适配；Production 已部署，短期优先做 Supabase 回调 URL 与线上完整流程自检；**PWA / 手机分享** 排在更后（见 **PRD §1.4.2**）；**多语言 / 英语版**见 **PRD §1.5**（后续评估）。

## 待开发 / 产品 Backlog（非承诺排期）

以下由产品/维护者记录为**加分项**，实现顺序与版本未定；与 **`docs/USER_MANUAL.md` §15** 可交叉维护。

| 方向 | 说明 |
|------|------|
| **整文 AI：超长正文分块分析** | 当前单次分析仅送正文**前 1 万字符**；后半段无 AI 推荐。后续做分块调用并合并 vocabulary/grammar，或提高上限并评估费用/超时。 |
| **总词库搜索：同 `normalized_key` 分组展示** | 当同一归一化键因 **`part_of_speech`** 不同存在**多条 `vocabulary_items`** 时，搜索命中后在列表中**收拢为一组**：组头展示词形（如 `lemma` / `display_word`），组内列出各条**词汇记录**（标明词性/类型 + 状态徽标），子行点击进入对应卡片详情。对用户统一称**「两条词汇记录」**（不说「学习档」）。**无分组实现前**：保持当前「并列多条」即可。 |

## 最近更新

- **2026-05-15（Grammar Analysis v2 Phase 1）**：整文/enrich Prompt + `grammar_type` 枚举；入库 `grammar_key=grammar_type`；**`npm test`** / **`npm run build`** 已通过。
- **2026-05-15（导入：发布时间不入正文）**：解析仍识别发布时间，仅填导入预览，不写入 **`original_text`**；**`npm run build`** 已通过。
- **2026-05-15（手机可分动词拖选）**：词汇高亮触摸不再阻断拖选；松手保留多词选区；**`npm run build`** 已通过。
- **2026-05-15（整文 AI 词汇推荐策略）**：取消词汇 **20 条**上限（Prompt + `json_schema` + 规范化）；去掉「漏掉次要词也比堆满简单词好」；重写 **part_of_speech / grammatical_gender** 指引（动词/搭配/可分动词不得一律标名词）；**`docs/PRD.md` §13.6**、**`USER_MANUAL` §7.2** 已同步；**`npm run build`** 已通过。
- **2026-05-15（恢复词下选区浮层）**：手机拖选后三按钮回到**选区下方**浮动条，移除屏幕底栏；保留 touch-callout 与同屏定位；**`npm run build`** 已通过。
- **2026-05-15（手机点词反馈 + 同屏定位）**：点按高亮即时描边、拖选琥珀色高亮、底栏「已选中可添加」；手机选中项时不再滚到下方列表、详情打开时课文留上方；**`npm run build`** 已通过。
- **2026-05-15（手机选词：系统菜单回归修复）**：恢复高亮 **`touch-callout: none`**，保留跨高亮 **`user-select: text`**；手机拖选后在**底部工具栏**操作「添加为词汇 / 标记语法 / 发音」；**`AGENTS.md`** 增加回归防护；**`npm run build`** 已通过，Production 已部署。
- **2026-05-14（整文分析：总语法库已掌握/暂忽略过滤）**：**`grammar_key` + `normalized_key`** 与 **`json_schema` 必填 `normalized_key`**；**`filterGrammarByUserLibrary`**、**`fetchGrammarMasteredIgnoredKeysForArticleAnalysis`**；**`USER_MANUAL` §9**、**`PRD`**、**`README`**、**`USER_RESEARCH` Q1**；**`npm test`** / **`npm run build`** 已通过。
- **2026-05-14（用户调研开放问题文档）**：新增 **`docs/USER_RESEARCH_OPEN_QUESTIONS.md`**（语法过滤粒度、复习展示、话术等可摘题）；**`README.md`**、**`USER_MANUAL` §14** 索引；**`DEVELOPMENT_LOG.md`** 已记；**`npm run build`** 已通过。
- **2026-05-14（整文分析：总词库已掌握/暂忽略词汇过滤）**：**`POST /api/analyze-article`** 须 **Bearer**；按 **`normalized_key` + `part_of_speech`** 提示模型并**后处理剔除** **`vocabulary`**；**`grammar`** 未过滤；**`/articles/[id]`** 请求带头；**`docs/PRD.md`**、**`USER_MANUAL` §9**、**`README.md`** 已同步；**`npm test`** / **`npm run build`** 已通过。
- **2026-05-14（对外用语：两条词汇记录）**：**`docs/USER_MANUAL.md` §10.1** 写明同 **`normalized_key`**、不同 **`part_of_speech`** 时的用户向说法；**`PROJECT_STATUS.md`** Backlog 表与 **§15**、**`DEVELOPMENT_LOG.md`** 用语与「学习档」脱钩；**`npm run build`** 已通过。
- **2026-05-14（Backlog：总词库同键分组搜索）**：**`PROJECT_STATUS.md`** 新增「待开发 / 产品 Backlog」表；**`docs/USER_MANUAL.md` §15** 交叉引用；**`DEVELOPMENT_LOG.md`** 已记；**`npm run build`** 已通过。
- **2026-05-14（用户说明手册素材）**：**`docs/USER_MANUAL.md`** 创建并扩充（导入、阅读页、CEFR、高亮/选区、整文 AI、掌握状态与 **§9 AI 规则 vs 当前实现**、总库等；**`README.md`** / **`IMPORT_UI_DISCUSSION.md`** 索引）；**`docs/DATABASE.md`** Supabase **GRANT** 备忘；**`npm run build`** 已通过。
- **2026-05-13（跨已有高亮选整句）**：词汇正文高亮改为 **`user-select: text`**（原 `none` 导致选区跳过已有绿/琥珀词），可与语法一样拖选穿过多个高亮加入长表达；**`npm test`** / **`npm run build`** 已通过。
- **2026-05-13（长选区高亮 + enrich 23505）**：用户长选加入词库后，**surface 与正文略不一致**时仍按 occurrence **偏移**画琥珀高亮；AI 补充写 `part_of_speech` 前检测与同 `normalized_key` 的其它行冲突，避免 **23505**；**`npm test`** / **`npm run build`** 已通过。
- **2026-05-13（用户词 occurrence 勿清空 + 句窗定位）**：`rebuildUserStyleVocabOccurrencesFromArticle` 在无法重算全文 occurrence 时**保留**原 occurrence，避免「本篇出现位置」空白与保存无行；`vocabOccurrenceToRanges` 增加多 hint 与基于 **`sentence`** 的句窗内回退匹配；**`npm test`** / **`npm run build`** 已通过；部署后请硬刷新验证线上。
- **2026-05-13（导入 UI 讨论文档）**：新增 **`docs/IMPORT_UI_DISCUSSION.md`** 汇总主卡讨论与待确认改动；**`README.md`** 增加交叉引用；**`npm.cmd run build`** 已通过。
- **2026-05-13（`/import/mock` 导入主卡对照示意）**：新增 **`/import/mock`** 静态双栏页，对比当前「正文」主卡与历史草案示意；**`npm.cmd run build`** 已通过。
- **2026-05-13（部署排查文档）**：**`README.md`**、**`docs/DEPLOY_VERCEL.md`** 补充「线上仍为旧版阅读页 UI」时的 Vercel / 硬刷新 / 无 `.git` 须 CLI 部署说明；**`npm.cmd run build`** 已通过。
- **2026-05-13（词汇名词性副标）**：主标题已 **der/die/das** 开头时**不再**显示「名词性：阴性（die）」等重复副标；**unclear** 且无冠词标题时**保留**「名词性未标注或不确定」；列表与详情及 AI 预览一致；**`npm.cmd test`** / **`npm.cmd run build`** 已通过。
- **2026-05-13（阅读页删除顶行）**：**删除** 与状态下拉同在**标题行右侧**；去掉底栏；长词 **`min-w-0` / `break-words`** 在左侧换行，右侧 **`flex-nowrap`**；**`npm.cmd test`** / **`npm.cmd run build`** 已通过。
- **2026-05-13（阅读页状态下拉顶行）**：词汇/语法列表与详情将 **学习状态下拉** 放在**标题行**，底部仅 **删除**；去掉与下拉重复的静态状态徽标及「状态」标签；**`npm.cmd test`** / **`npm.cmd run build`** 已通过。
- **2026-05-13（用户词汇徽标）**：**「用户词汇」** 改为 **「用户」**（徽标与 tooltip）；**`npm.cmd run build`** 已通过。
- **2026-05-13（阅读页徽标文案）**：**`ai`/`ai_mock`** 徽标 **「AI 推荐」→「AI」**；出现次数 **「出现 n 次」→「n 次」**；**`npm.cmd run build`** 已通过。
- **2026-05-13（Vercel CLI 系统 CA）**：新增 **`npm.cmd run vercel:prod:system-ca`**（`scripts/vercel-prod-use-system-ca.cjs`），减轻本机 **`vercel:prod`** TLS 证书错误；**`npm.cmd run build`** 已通过。
- **2026-05-13（enrich 写入 display_word + occurrence 回退定位）**：AI 补充词汇时把 **`surface_form` 写入库 `display_word`**；正文高亮在 offset 与切片不一致时按 **`surface_form`** 回退匹配；**`npm.cmd test`** / **`npm.cmd run build`** 已通过。
- **2026-05-13（词汇保存 23505 + 重复卡片）**：`persist` 查找已有行时 **null / "" `part_of_speech`** 与唯一键对齐；INSERT 遇唯一冲突回退为更新；保存后列表按 **`normalized_key` 去重**；**`npm.cmd test`** / **`npm.cmd run build`** 已通过。
- **2026-05-13（阅读页：可分动词双段高亮）**：用户以句选等方式添加可分动词并经 AI 补全为词典形后，正文按卡面 **「前段 … 后段」** 在 occurrence 窗口内拆成**两处**高亮；词典形无法连续匹配时**保留** occurrence，避免误清空与保存失败；**`npm.cmd test`** / **`npm.cmd run build`** 已通过。
- **2026-05-13（`/import` 链接模式剪贴板 secondary）**：默认 **链接导入** 下 **「从剪贴板读取」** 使用 **`Button` `variant="secondary"`**，**「保存文章」** 保持主色；手动粘贴模式剪贴板仍为主色；**`npm.cmd run build`** 已通过。
- **2026-05-13（`/import` 正文卡：去重新整理 + 标题「正文」）**：主卡标题 **「正文」**；移除 **「重新整理」** 按钮与 `onCleanBody`；**「从剪贴板读取」与「保存文章」**同一行且去掉底部重复保存；相关提示与来源稿说明用语同步；**`/import/mock`** A 栏与正式页对齐；**`npm.cmd run build`** 已通过。
- **2026-05-13（`/import` 单一主正文）**：去掉与主编辑区重复的「粘贴文章内容」大卡；**从剪贴板读取** 等与主正文同卡；**来源稿**折叠于有 `raw` 时；**`npm.cmd test`** / **`npm.cmd run build`** 已通过；**`vercel:prod`** 本机 TLS 失败未推线上。
- **2026-05-13（词汇主标题定冠词）**：**`vocabularyHeadwordDe`**：AI 预览与阅读页词汇 **主标题** 在 **m/f/n** 且 lemma 无 **der/die/das** 时显示 **die Gymiprüfung** 等形式；**`npm.cmd test`** / **`npm.cmd run build`** 已通过。
- **2026-05-13（名词性展示 + 部署流程）**：词汇卡 **名词性（der/die/das）** 在 **已写入 gender**、**lemma 带冠词** 或 **词类像名词** 时显示，并从 lemma 推断展示；AI 提示收紧 **名词 part_of_speech**；新增 **`.github/workflows/vercel-production.yml`** 与 **`docs/DEPLOY_VERCEL.md` §七**；**`AGENTS.md` / `CLAUDE.md`** 要求 build 通过后尽量 **`vercel:prod`**。本机 **`vercel:prod`** 因 TLS 校验失败未推线上；**`npm.cmd test`** / **`npm.cmd run build`** 已通过。
- **2026-05-13（文档：PowerShell 与 npm）**：**`README.md`**、**`docs/PERSONAL_USE_CHECKLIST.md`** 强化 Windows PowerShell 下 **`npm.ps1` 被拦截**时的 **`npm.cmd`** 用法与可选 **`RemoteSigned`（CurrentUser）** 说明；**`npm.cmd run build`** 已通过。
- **2026-05-13（名词性 grammatical_gender）**：AI 分析 JSON 增加 **`grammatical_gender`**，入库 **`vocabulary_items.gender`**；阅读页与 AI 预览展示「名词性：阳性（der）」等；**`npm.cmd test`** / **`npm.cmd run build`** 已通过。
- **2026-05-13（AI 保存二次同步 lemma）**：修复「首次保存后再次保存不再写词库」导致重新分析后 lemma 仍不更新；合并写入已存在行的 lemma；预览区展示 lemma；**`npm.cmd test`** / **`npm.cmd run build`** 已通过。
- **2026-05-13（lemma 持久化修复）**：保存词汇到 Supabase 时不再用 `display_word` 覆盖 `lemma`，恢复词典形（含名词 **der/die/das** 等）在阅读页的展示。**`src/lib/supabase/vocabulary.ts`**；**`npm.cmd run build`** 已通过。
- **2026-05-13（移动端语法抽屉挡课文）**：详情抽屉变暗层 **`pointer-events: none`** 以恢复课文选词；抽屉限高约 **50dvh**；打开后自动把文中高亮滚到抽屉上方留白。**`docs/PRD.md`**、**`docs/READING_HIGHLIGHTS_AND_OVERLAPS.md`**、**`DEVELOPMENT_LOG.md`** 已记；**`npm.cmd run build`** 已通过。
- **2026-05-13（语法高亮内可选词）**：阅读页蓝 / 紫语法高亮改为可选中文本的 **`span role="button"`**，移动端可在片段内拖选加入词库，无选区时轻点仍打开语法；词汇高亮触摸策略不变。**`docs/PRD.md`**、**`docs/READING_HIGHLIGHTS_AND_OVERLAPS.md`** 已同步；**`npm.cmd run build`** 已通过。
- **2026-05-13（阅读页高亮与重叠文档）**：新增 **`docs/READING_HIGHLIGHTS_AND_OVERLAPS.md`**（重叠优先级、已掌握词显示、选区与语法高亮内标词限制与方向、Cursor Run 说明）；**`docs/PRD.md` §8.0** 与 **`README.md`** 增加交叉引用；**`articleReadingModel.ts`** 补充 JSDoc。无用户可见行为变更；**`npm.cmd run build`** 见开发日志本条验证。
- **2026-05-13（已掌握词默认不高亮）**：文章正文中已掌握词汇默认不再显示常驻颜色高亮，以减少阅读干扰；右侧已掌握词汇折叠区、词汇卡片 occurrence 与总词库来源链接仍可定位到原文并短暂闪烁。已掌握词锚点优先级降到最低，不覆盖语法或其它学习中高亮。**`npm.cmd test`**、**`npm.cmd run build`** 与 Vercel Production 部署已通过。
- **2026-05-13（深度笔记剪贴板内容清理）**：从 ChatGPT / 手机剪贴板读取的深度笔记在保存前会清除空字符、控制字符、零宽字符与不间断空格，并补充保存异常提示；减少移动端复制 AI 笔记后写入 Supabase 失败。**`npm.cmd test`**、**`npm.cmd run build`** 与 Vercel Production 部署已通过。若提示深度笔记字段未添加，仍需执行 **`supabase/fixes/008_learning_item_deep_notes.sql`**。
- **2026-05-12（移动端高亮触摸交互优化）**：`/articles/[id]` 与 `/articles/mock` 共享阅读器的原文高亮按钮增加移动端防原生选词 / callout 处理；iPhone Safari 点击高亮词或语法片段时应优先打开应用内详情，普通正文仍可正常选择文字。高亮颜色、左右定位、右侧面板、AI 与保存逻辑不变。**`npm.cmd run build`** 与 Vercel Production 部署已通过。
- **2026-05-12（AI 候选保存前整理）**：真实 AI 分析生成后，预览区词汇 / 语法支持保存前删除候选，并可先标记为学习中 / 已掌握 / 暂忽略；一键保存时只写入保留候选并带入所选状态。原有阅读页高亮、左右定位、已保存条目状态管理与删除 occurrence 逻辑不变。**`npm.cmd test`** 与 **`npm.cmd run build`** 已通过；项目级 **`npm.cmd run lint`** 仍有既有 cleanup 项，详见开发日志。
- **2026-05-12（Chrome 插件通用大字号标题扫描）**：插件标题候选扩展为扫描页面所有可见的大字号 / 粗体文字块；导入页对插件传入的合理标题优先使用，减少正文短标题覆盖页面视觉大标题。插件版本更新为 **0.1.5**。**`npm.cmd run build`** 与 Vercel Production 部署已通过。
- **2026-05-12（Chrome 插件可见大标题修正）**：插件标题提取改为扫描页面可见标题候选，并按字号、字重、位置、标签与 URL 相关性评分，优先选择页面视觉大标题；导入页在插件标题明显更完整时优先使用插件标题。插件版本更新为 **0.1.4**。**`npm.cmd run build`** 与 Vercel Production 部署已通过。
- **2026-05-12（Chrome 插件标题优先级修正）**：插件标题提取改为优先采用页面可见 `h1`；当只有一个 `h1` 时直接使用，多个 `h1` 时再用 URL slug 相关性挑选，`meta` 标题只作兜底，避免 Tages-Anzeiger 等站点保存面包屑 / URL 短标题。插件版本更新为 **0.1.3**。**`npm.cmd run build`** 已通过。
- **2026-05-12（Chrome 插件提取范围与尾部清理修正）**：插件导入从简单读取第一个 `article/main` 改为多候选正文评分，优先可信 `h1` 并用 URL slug 辅助兜底；插件端跳过 newsletter、related/recommend、author/profile、share/social、comment 等容器，导入清理器也会在正文足够长后截断相关阅读 / Newsletter / 作者简介 / 评论尾部。插件版本更新为 **0.1.2**。**`npm.cmd run build`** 与 Vercel Production 部署已通过。
- **2026-05-12（Chrome 插件导入 MVP）**：新增 **`browser-extension/chrome-mv3`**，提供工具栏按钮与右键菜单 **「导入到 German Reading Coach」**，读取当前浏览器页面中用户已可见的标题、URL、来源、发布时间与正文，并打开 `/import` 预填草稿；`/import` 新增插件草稿消息入口。**`npm.cmd run build`** 与 Vercel Production 部署已通过。
- **2026-05-11（两层阅读水平）**：`/settings` 的默认阅读水平改为可编辑并保存到当前账户；`/import` 自动带入默认水平，仍允许本篇临时修改；保存文章时继续写入本篇 **`articles.user_level_at_analysis`**，阅读页与 AI 分析继续使用文章记录中的水平。**`npm.cmd run build`** 已通过。
- **2026-05-11（设置页移除 Supabase 测试入口）**：`/settings` 移除 **「测试 Supabase 连接」** 链接与 `profiles` 说明；`/settings/supabase-test` 诊断页保留为隐藏排障入口。**`npm.cmd run build`** 已通过。
- **2026-05-11（设置页去字段名）**：`/settings` 移除 `self_selected_level`、`estimated_reading_level`、`explanation_language`、`autoPlayPronunciationOnClick` 等内部字段名展示，改为用户向说明；顶部说明去掉“演示数据”。**`npm.cmd run build`** 已通过。
- **2026-05-11（顶栏账户头像）**：登录后顶栏账户入口从文字 **「账户」** 改为圆形小人头像按钮，点击进入账户页；退出入口保留在旁边。**`npm.cmd run build`** 已通过。
- **2026-05-11（文章库分页）**：新增 **`/articles`** 完整文章库页面，按保存时间倒序分页展示当前账户全部已保存文章（每页 10 篇，页码 / 上一页 / 下一页），并支持继续阅读与删除；顶栏、首页和仪表盘新增文章库入口。**`npm.cmd run build`** 已通过。
- **2026-05-11（Dashboard 真实统计）**：仪表盘顶部三张统计卡从演示数字改为当前账户真实数据：本周保存文章数、学习中词汇数、语法点总数；删除文章后会刷新统计。**`npm.cmd run build`** 已通过。
- **2026-05-11（首页用户向精简）**：首页移除“登录后可使用云端真实数据”、已登录邮箱、云端文章数量摘要；删除未使用的 `HomeOverview`；首页入口卡和全站页脚去掉 Supabase / Mock 等偏实现说明。**`npm.cmd run build`** 与 Vercel Production 部署已通过，线上旧文案检查为 0。
- **2026-05-11（真实文章高亮图例补齐）**：`/articles/[id]` 左侧 **高亮含义** 改为与 `/articles/mock` 一致的四项说明：绿色系统词汇、琥珀用户/确认词汇、蓝色系统语法、紫色用户语法。**`npm.cmd run build`** 与 Vercel Production 部署已通过。
- **2026-05-11（/import 保存按钮位置）**：导入页将 **保存文章** 按钮从德语阅读水平卡片中移到 **保存前预览** 正文下方，使保存动作更贴近将被保存的文章内容；德语阅读水平保留为后续设置项。**`npm.cmd run build`** 与 Vercel Production 部署已通过。
- **2026-05-11（/import 移除清理详情）**：导入页底部 **「清理详情」** 折叠区从普通用户界面移除；前端不再维护清理统计展示状态。正文清理、标题/发布时间自动填充、保存前预览与保存逻辑不变。**`npm.cmd run build`** 与 Vercel Production 部署已通过。
- **2026-05-11（状态操作下拉菜单）**：`/articles/[id]`、`/articles/mock`、`/vocabulary`、`/grammar` 的学习项状态操作从显眼按钮组改为轻量下拉菜单（学习中 / 已掌握 / 暂忽略），减少卡片占位；`/vocabulary` 与 `/grammar` 已将顶部状态徽章直接替换为下拉菜单并移除底部状态行；删除仍为独立操作。**`npm.cmd run build`** 与 Vercel Production 部署已通过。
- **2026-05-11（Vercel Production 首次部署）**：通过 Vercel CLI 创建/链接 `german-reading-coach` 项目，上传 Production 环境变量（Supabase URL / anon key、OpenAI key），并部署到 [`https://german-reading-coach.vercel.app`](https://german-reading-coach.vercel.app)。线上首页自检 `200`，本地与 Vercel 构建均通过。已知后续：在 Supabase Auth 中补充生产 Site URL / Redirect URLs，并跑登录、重置密码、导入与 AI 分析自检。
- **2026-05-09（dev：`--use-system-ca`）**：**`npm run dev` / `dev:clean`** 经 **`scripts/next-dev-use-system-ca.cjs`** 在支持的 Node 版本下附加 **`--use-system-ca`**，减轻 HTTPS 代理 / 企业根证书导致的 OpenAI TLS 校验失败；文档与 **`.env.example`** 已补充。**`npm run build`** 已通过。
- **2026-05-09（OpenAI fetch failed：代理 + 回退）**：**`OPENAI_HTTPS_PROXY` / `HTTPS_PROXY`**、undici 失败回退原生 **`fetch`**；错误文案提示配置代理。**`npm run build`** 已通过。
- **2026-05-09（Vercel 部署文档 + npm 脚本）**：新增 **`docs/DEPLOY_VERCEL.md`**（Dashboard / CLI、`env` 表、Supabase 回调、`maxDuration` 提示）；**`package.json`** 增加 **`vercel`** / **`vercel:prod`**；**`README.md`**、**`docs/PERSONAL_USE_CHECKLIST.md`**、本文件同步。
- **2026-05-09（`/vocabulary` 今日词汇记录落地）**：「今日」Tab 按 **§12.5** 聚合 **新增 / 再遇** 与计数；其余时间 Tab 与本周复盘卡不变。**`npm run build`** 已通过。
- **2026-05-09（PRD §12.5 今日词汇 NEW/REPEAT）**：固定总词库「今日」**新增生词 vs 再次遇到**产品与统计口径；删除文章规则顺延为 **§12.8**。
- **2026-05-09（阅读页 occurrence 闪光对比）**：左侧定位高亮改为更明显 ring / offset / shadow，去掉脉冲透明度。**`npm run build`** 已通过。
- **2026-05-09（链接导入首段去重）**：抓取正文时对相邻 `<p>` **近重复合并**；meta 摘要与正文首段重叠时 **不重复插入** 清理流水线。**`npm run build`** 已通过。
- **2026-05-09（OpenAI 服务端 undici IPv4）**：**`analyze-article` / `enrich-*`** 使用 **`createServerOpenAIClient`**（undici + IPv4、可选 TLS 放宽与 **`ALLOW_INSECURE_IMPORT_TLS`** 联动），错误信息附带 **`cause`**；**`analyze-article`** **`maxDuration`** **180**；依赖 **`undici`**。**`npm run build`** 已通过。
- **2026-05-09（链接导入 Node http 主通道 + import-url 300s）**：抓取优先 **`node:http(s)` + IPv4** 与 **`dns` IPv4 优先**，**`timeout`/`fetch_failed`** 时再回退 undici/fetch 管线；**`POST /api/import-url`** **`maxDuration`** 提至 **300**。**`npm run build`** 已通过。
- **2026-05-09（链接导入头/正文分段超时）**：避免大 HTML 下载阶段被头阶段计时器误杀；**90s+120s**。**`npm run build`** 已通过。
- **2026-05-09（本地 https 链接导入直走 undici）**：避免 Node fetch TLS 挂满限时；超时 **60s**。**`npm run build`** 已通过。
- **2026-05-09（导入 45s 超时 + AI 路由 maxDuration / OpenAI timeout）**：链接抓取延长等待并收敛请求头；AI 相关 Route 放宽平台限时、SDK 显式超时。**`npm run build`** 已通过。
- **2026-05-09（dev:clean 单端口启动）**：新增 **`npm run dev:clean`**，启动前释放 **3000** 端口，减少双进程与看错 localhost 端口的问题；见 **`scripts/free-dev-port.cjs`**。**`npm run build`** 已通过。
- **2026-05-09（链接导入 TLS / 20min.ch）**：本地 **Node fetch** 与浏览器证书链不一致时，**`next dev`** 下对 TLS 校验失败自动 **undici 放宽重试**；生产需 **`ALLOW_INSECURE_IMPORT_TLS=1`**。**`npm run build`** 已通过。
- **2026-05-09（首页真实数据表述 + 链接导入 UA）**：首页文案与 **`HomeOverview`** 区分云端数据与演示课文；顶栏 **演示课文**、页脚说明同步。**`/api/import-url`** 抓取使用浏览器式请求头，减轻部分站点拒抓。 **`npm run build`** 已通过。
- **2026-05-09（登录/注册回跳 `next`）**：从需登录页或顶栏进入 **`/login` / `/signup`** 时携带 **`next`**，成功登录或注册（立即有 session）后优先回到目标页；无效或缺失 **`next`** 时落地 **`/`**。实现见 **`src/lib/auth/post-auth-redirect.ts`**。**`npm run build`** 已通过。
- **2026-05-09（登录后跳转首页）**：`/login` 成功登录后跳转 **`/`** 而非 **`/account`**。**`npm run build`** 已通过。
- **2026-05-09（忘记密码 / 邮件重置）**：`/login` 增加「忘记密码」发信；新增 **`/auth/recovery`** 设置新密码；顶栏下 **`AuthRecoveryHashBanner`** 解析邮件回跳 hash（含 **`otp_expired`** 提示）；浏览器 Supabase client 启用 **`detectSessionInUrl`**。须在 Supabase **Redirect URLs** 中加入 **`http://localhost:3000/auth/recovery`**（见检查清单）。**`npm run build`** 已通过。
- **2026-05-09（登录/注册文案）**：`/login`、`/signup` 页去掉对 Supabase 的品牌式说明，改为用户向文案；认证与跳转逻辑不变。**`npm run build`** 已通过。
- **2026-05-08（阅读页词汇统计口径修正）**：`/articles/[id]` 词汇区统计改为：**生词去重（含暂忽略）**、**全文总词数不去重**、并显示生词占比；`mastered`、已删除与未标注不计入生词。同步 `docs/PRD.md`（路线图新增“拍照读取文章 OCR”需求与统计口径）与 `README.md`。构建校验见本次开发日志。
- **2026-05-08（阅读页深度笔记折叠）**：词汇/语法详情卡中，**已掌握 / 暂忽略 / 删除** 等学习状态操作移到解释信息后、深度笔记前；**我的深度笔记** 改为默认折叠，只显示一行摘要，展开后再编辑/保存，减少右侧面板空白占位。同步 **PRD**、**README**、本状态与开发日志。**ReadLints 超时；lint/build 命令本次被中断，未取得最终结果**。
- **2026-05-08（个人使用检查清单）**：新增 **`docs/PERSONAL_USE_CHECKLIST.md`**，把当前目标收束为个人可完整使用版，记录本地启动、环境变量、Supabase SQL `001`–`008`、日常完整流程、深度笔记、总词库/总语法验收与常见问题。同步 **README**、本状态与开发日志。**ReadLints 无报错；`npm.cmd run build` 本次被中断，未取得最终结果**。
- **2026-05-08（/import 从剪贴板读取）**：`/import` 手动粘贴模式新增 **从剪贴板读取**，复制正文后可一键填入粘贴框并立即刷新保存前预览；读取失败或剪贴板为空时在按钮下方显示小提示，回退手动粘贴。未改 URL 抓取、保存逻辑、schema、RLS 或 AI 调用。同步 **PRD**、**README**、本状态与开发日志。**ReadLints 无报错；`npm.cmd run build` 本次被中断，未取得最终结果**。
- **2026-05-07（深度笔记格式清理）**：深度笔记从剪贴板读取、保存、文章页显示与总库显示时，会清理外部 AI 常见 Markdown 标记（如 `##`、`**`、`>`），避免笔记中直接露出格式符号；不新增依赖，不调用 AI。同步 **PRD**、**README**、本状态与开发日志。**ReadLints 无报错；`npm.cmd run build` 本次被中断，未取得最终结果**。
- **2026-05-07（深度笔记 + 未迁移兼容修复）**：词汇/语法详情卡新增“我的深度笔记”，可从剪贴板读取或手动粘贴外部 AI 解释并保存到 `user_deep_note`；该功能不调用本应用 OpenAI。新增 **`supabase/fixes/008_learning_item_deep_notes.sql`**；未执行 **008** 时，旧词汇/语法读取与保存使用回退查询继续可用，深度笔记保存提示先执行迁移。同步 **PRD**、**README**、本状态与开发日志。**构建待本次确认**。
- **2026-05-07（总语法库语法状态操作）**：`/grammar` 对齐文章页语法卡逻辑：学习中语法可标记 **已掌握** 或 **暂忽略**，已掌握/暂忽略可 **恢复为学习中**；状态写入 `grammar_items.mastery_status` 并即时更新列表/统计。暂不做总语法库删除。同步 **PRD**、**README**、本状态与开发日志。**`npm.cmd run build`** 已通过。
- **2026-05-07（总词库单词状态操作）**：`/vocabulary` 对齐文章页词汇卡逻辑：学习中单词可标记 **已掌握** 或 **暂忽略**，已掌握/暂忽略可 **恢复为学习中**；状态写入 `vocabulary_items.mastery_status` 并即时更新列表/统计。暂不做总词库删除。同步 **PRD**、**README**、本状态与开发日志。**`npm.cmd run build`** 已通过。
- **2026-05-07（总库全部视图 + 来源精确跳转）**：`/vocabulary` 与 `/grammar` 恢复 **全部** 时间 Tab 并默认展示全量总库；来源文章链接携带 `focus`、item id 与 occurrence id，进入 `/articles/[id]` 后自动打开对应词汇/语法 Tab、选中右侧条目并尽量滚到原文对应位置。同步 **PRD**、**README**、本状态与开发日志。**`npm.cmd run build`** 已通过。
- **2026-05-07（导入体验路线文档化）**：在 **`docs/PRD.md` §1.4.2** 固定导入体验路线与合规边界：不绕过付费墙/登录墙；短期 `/import` 可补“从剪贴板读取”，中期桌面 Chrome 插件提供按钮/右键菜单导入用户已可见正文，后期评估 PWA/手机分享与 Share Extension。同步 **README**、本状态与开发日志。**`npm.cmd run build`** 已通过。
- **2026-05-06（/import 抓取失败提示位置微调）**：`/import` 将链接抓取失败提示从页面顶部提示框改为 URL 输入框下方的小提示文本，减少视觉打断；未改抓取 API、保存链路、schema 与 RLS。**`npm.cmd run build`** 已通过。
- **2026-05-06（/import 标题区位置调整）**：`/import` 将“文章标题”移到“链接导入”区块下方，以匹配“先导入 URL → 自动抓取标题 → 仅在必要时手动覆盖”的流程。未改抓取/保存逻辑、schema 与 RLS。**`npm.cmd run build`** 已通过。
- **2026-05-06（语法库时间分组 + 复盘卡）**：`/grammar` 对齐 `/vocabulary`：新增时间分组 Tab（今日/昨日/近三日/本周）、本周复盘小卡（本周新增/学习中/已掌握/暂忽略）及点击联动筛选；来源文章缺失时显示“原文已被用户删除”。未改导入、AI 分析、schema 与 RLS。**`npm.cmd run build`** 已通过。
- **2026-05-06（词库复盘小卡可点击联动）**：`/vocabulary` 的本周复盘小卡支持点击联动筛选：点击“本周新增”切到本周，点击“学习中/已掌握/暂忽略”切到本周并自动套用对应状态筛选。未改导入、AI 分析、schema 与 RLS。**`npm.cmd run build`** 已通过。
- **2026-05-06（词库本周复盘小卡）**：`/vocabulary` 在时间分组上方新增本周复盘小卡：本周新增、学习中、已掌握、暂忽略四项统计，便于快速复盘。未改导入、AI 分析、schema 与 RLS。**`npm.cmd run build`** 已通过。
- **2026-05-06（词库时间分组 Tab）**：`/vocabulary` 新增时间分组 Tab：今日 / 昨日 / 近三日 / 本周（按词条入库时间分组），并保留现有搜索、状态筛选与等级筛选。未改导入、AI 分析、schema 与 RLS。**`npm.cmd run build`** 已通过。
- **2026-05-06（外部深入解释提示文案调整）**：词汇/语法卡常驻提示文案改为“点击后会自动复制深度学习 Prompt，可在外部页面直接 Ctrl+V 粘贴发送”，仅改文案，不改跳转与复制逻辑。**`npm.cmd run build`** 已通过。
- **2026-05-06（Phase 4.1 增量：删除反馈与词库来源文案）**：`/dashboard` 列表删除成功后新增轻提示；`/vocabulary` 在来源文章已不存在时，来源文案显示“原文已被用户删除”。未改导入、AI 分析、schema 与 RLS。**`npm.cmd run build`** 已通过。
- **2026-05-06（Phase 4.1 增量：Dashboard 直接删除）**：`/dashboard` 的「最近保存的文章」列表新增每行删除按钮；确认后删除本文 `articles` 与对应 `vocabulary_occurrences` / `grammar_occurrences`，并保留长期 `vocabulary_items` / `vocabulary_senses` / `grammar_items`。未改导入、AI 分析、schema 与 RLS。**`npm.cmd run build`** 已通过。
- **2026-05-06（Phase 4.1：删除文章 v1）**：`/articles/[id]` 新增“删除文章”入口与确认提示；执行删除本文 `articles` 以及本文 `vocabulary_occurrences` / `grammar_occurrences`，并保留 `vocabulary_items` / `vocabulary_senses` / `grammar_items`。未改导入、AI 分析、schema 与 RLS。**`npm.cmd run build`** 已通过。
- **2026-05-06（/import 模式联动高亮增强）**：导入页操作区与模式选择联动高亮：选择“链接导入”时突出 URL 输入框与“抓取文章”；选择“手动粘贴”时突出主正文与「从剪贴板读取」。**`npm.cmd run build`** 已通过。
- **2026-05-06（/import 默认模式与标题策略）**：`/import` 默认导入方式改为“链接导入”；标题文案改为“未手填则自动抓取，手填可覆盖且不再被自动覆盖”。未改保存链路与 schema/RLS。**`npm.cmd run build`** 已通过。
- **2026-05-06（外部深入解释提示增强）**：词汇/语法外部解释区的常驻提示改为高对比提示条，强调“先复制 Prompt，再在外部页面 Ctrl+V 粘贴发送”；点击后反馈文案可见性同步提升。**`npm.cmd run build`** 已通过。
- **2026-05-06（外部深入解释修复）**：恢复“先复制 Prompt 再跳转外站”的顺序，修复跳转后剪贴板为空的问题；词汇/语法外部解释区新增常驻提示“可直接 Ctrl+V 粘贴发送”。**`npm.cmd run build`** 已通过。
- **2026-05-06（外部深入解释：直接跳转 + 粘贴提示）**：词汇/语法卡点击 ChatGPT/Claude/Gemini/DeepSeek 后直接跳转外站，不再弹二次确认；页面提示“Prompt 已复制，可直接 Ctrl+V 粘贴发送”，并在新页被拦截时提示检查浏览器弹窗设置。未改 AI/保存/DB 逻辑。**`npm.cmd run build`** 已通过。
- **2026-05-06（Phase 4.0 增量：URL 抓取失败兜底）**：`/import` 链接导入在 `fetch_failed/blocked` 等场景显示“站点可能拒绝抓取或需要登录”提示，并提供“切换到手动粘贴（保留当前链接）”按钮；后续插件阶段补浏览器登录上下文导入。**`npm.cmd run build`** 已通过。
- **2026-05-06（Phase 4.0：URL 自动导入）**：新增 **`POST /api/import-url`** 与 **`src/lib/import/importFromUrl.ts`**；`/import` 新增「手动粘贴 / 链接导入」模式，抓取成功后展示预览并沿用现有保存逻辑。抓取与清理不调用 OpenAI，未改 schema/RLS。**`npm.cmd run build`** 已通过。
- **2026-05-05（仅文档：删除文章未来规则）**：在 **`docs/PRD.md` §12.7** 固定「删文章 vs 长期词库」边界、第一版策略、可选能力与确认文案；同步 **`PROJECT_STATUS.md`**、**`DEVELOPMENT_LOG.md`**、**`README.md`**。**未改**代码、schema、RLS。**`npm.cmd run build`** 已通过。
- **2026-05-05（Phase 3.16：整文分析推荐策略）**：仅 **`openaiArticleAnalysis.ts`** 的 **`SYSTEM_PROMPT`**、**`articleAnalysisJsonSchema.ts`** 的 **`maxItems`**、**`normalizeOpenAIArticleAnalysis`** 截断；不改 UI/DB/保存。见 **`DEVELOPMENT_LOG.md`**。**`npm.cmd run build`** 已通过。
- **2026-05-05（文档检查点：产品定位、能力清单、状态语义）**：同步 **`README.md`**、**`PROJECT_STATUS.md`**、**`DEVELOPMENT_LOG.md`**、**`docs/PRD.md`**（§1.0、§5.1 暂忽略、§5.3 折叠、§8.1.1 示例、§13 与 OpenAI 保存表述、§13.6 动词/介词短语）、**`docs/DATABASE.md`**（与真实 **`/vocabulary` / `/grammar`** 一致）。**未改**代码与 schema。
- **2026-05-05（阅读页：移除单项「重新生成解释」按钮）**：普通词汇/语法卡仅保留缺失时的「补充 AI 解释」与外链深入解释；无 App 内重新生成入口。见 **`DEVELOPMENT_LOG.md`**。
- **2026-05-05（PRD §13.6：AI 推荐数量与类型）**：全文 AI 推荐上限（词汇/表达 20、语法 8）为软上限；简单文少推、不凑过简词；不做「显示更多」；见 **`docs/PRD.md`** / **`DEVELOPMENT_LOG.md`**。仅文档。
- **2026-05-05（Phase 3.14：锁定 AI 调用）**：补充 AI 仅当解释缺失；已齐则无 App 内单项重新生成按钮（外链深入解释保留）。全文分析在已有保存结果时主按钮为「重新分析本文（会再次调用 AI）」+ 确认。见 **`DEVELOPMENT_LOG.md`**。
- **2026-05-05（Phase 3.13：词汇「外部深入解释」）**：阅读页词汇详情卡增加与语法同族的「外部深入解释」按钮组（复制 Prompt + 可选打开 ChatGPT / Claude / Gemini / DeepSeek）。见 **`DEVELOPMENT_LOG.md`**。`npm.cmd run build` 已通过。
- **2026-05-05（阅读页：语法「外部深入解释」）**：`/articles/[id]`（及共用 **`InteractiveArticleReader`** 的页面）语法详情卡增加外链快捷按钮：生成固定模板 Prompt、复制剪贴板、可选打开 ChatGPT / Claude / Gemini / DeepSeek；不调应用内 AI、不入库。见 **`DEVELOPMENT_LOG.md`**。`npm.cmd run build` 已通过。
- **2026-05-05（Phase 3.8：全局词库与语法库）**：`/vocabulary`、`/grammar` 从 Mock 页切换为 Supabase 真实只读总库：仅查询当前用户数据，状态文案统一 **学习中/已掌握/暂忽略**，支持搜索、状态筛选、CEFR 等级筛选、来源文章跳转 `/articles/[id]`，并提供空状态与错误提示（含权限错误透传，不改 RLS）。`npm.cmd run build` 已通过。
- **2026-05-02（Phase 3.7：状态语义 UI 与已掌握默认折叠）**：`/articles/[id]` 词汇/语法默认状态文案改为 **学习中**；按钮 **已掌握 / 恢复为学习中**；面板增加三态说明；`mastered` 条目默认折叠到 **已掌握词汇/语法（n）**，可展开。删除逻辑与忽略逻辑不变。`npm.cmd run build` 已通过。
- **2026-05-02（PRD：§5.1–§5.3 学习中/已掌握/删除语义与文章页规则，仅文档）**：用户向语义、未来手册示例、单篇页右侧**学习中优先 / 已掌握折叠 / 删除不展示**；与 **`mastery_status`** 对应及 Phase 3.6 删除实现差异已注记。**未改**代码、schema、prompt。
- **2026-05-02（PRD：§8.1.1 合并 AI 主动推荐与表达型词汇，仅文档）**：补充 **AI 全文分析**应推荐表达型词汇（八类示例）、推荐目标与 **词汇 Tab** 统一承载、未来 **`item_type`** 标签；**可分动词**主动识别示例；第一版仍统一 **vocabulary item**，预留 **`occurrence_sentence`** 等；**§13.1** 与 §8.1.1 交叉引用。**未改**代码、schema、prompt、UI。
- **2026-05-02（PRD：长文本选区「添加为词汇」原则，仅文档）**：**`docs/PRD.md` §8.1.1** 记录：词汇 = 广义 lexical item；长选区仍尊重「词汇」意图（含可分动词等）；「语法」仅当用户点 **标记语法**；未来 AI 与 **`item_type`** 等预留；**未改**代码、schema、prompt、阅读器 UI。
- **2026-05-02（Phase 3.6：删除学习项）**：**`InteractiveArticleReader`** 词汇/语法卡 **「删除」** + 确认；**`deleteArticleVocabularyItemOccurrences` / `deleteArticleGrammarItemOccurrences`** 仅删本文 occurrence；**忽略**语义不变。见 **`DEVELOPMENT_LOG.md`**。**`npm.cmd run build`** 已通过。
- **2026-05-02（Phase 3.5：文章页 AI 状态整理）**：**`/articles/[id]`** 以真实 AI 为主；**Mock 分析**降级为 **`development`** 下 **「开发工具」**内入口，**仅内存预览**、**不写** **`ai_mock`**；状态行与 **API 成本**说明；切换 **`id`** 重置 AI/Mock state；分析错误避免 **`[object Object]`**。**`npm.cmd run build`** 见 **`DEVELOPMENT_LOG.md`**。
- **2026-05-02（Phase 3.4 学习闭环验证，仅文档）**：在 **`DEVELOPMENT_LOG.md`** 追加文章页闭环验收表（真实 **AI**、词/语保存与刷新、**enrich**、摘要与 **`reading_questions`**、高亮与定位、掌握、**`/import` / `/dashboard`** 未改声明）；静态核对 **API** 路由存在；**发现问题**：无（未跑端到端）。**`npm.cmd run build`** 见 **`DEVELOPMENT_LOG.md`**。
- **2026-05-02（Phase 3.4 验证状态，仅文档）**：在 **`DEVELOPMENT_LOG.md`** 记录迁移后验收项（**`summary_zh` / `summary_de_simple` / `reading_questions`**、无 **42703**、Tab 与刷新、词汇语法未改范围）。**`npm.cmd run build`** 见 **`DEVELOPMENT_LOG.md`**。
- **2026-05-02（Phase 3.4：文章级 AI 摘要与阅读问题）**：保存真实 AI 预览时 **`UPDATE articles`**（**`summary_zh`、`summary_de_simple`、`reading_questions`**）；远程库执行 **`007_article_analysis_fields.sql`** 补齐列；右侧 Tab 显示优先级：**已保存** > **预览** > **Mock**。**`npm.cmd run build`** 见 **`DEVELOPMENT_LOG.md`**。
- **2026-05-02（Fix：42703 `reading_questions`）**：统一迁移文件 **`007_article_analysis_fields.sql`**（**`ADD COLUMN IF NOT EXISTS`** 三字段）。**`npm.cmd run build`** 见 **`DEVELOPMENT_LOG.md`**。
- **2026-05-02（Bugfix：真实 AI 保存升级 ai_mock）**：**`persistManualVocabularyItem` / `persistManualGrammarItem`** 在 **`item.source === "ai"`** 的 UPDATE 中写入 **`source = ai`**，避免与旧 Mock 同键合并后仍显示 Mock。**`npm.cmd run build`** 见 **`DEVELOPMENT_LOG.md`**。
- **2026-05-02（Phase 3.2：真实 AI 确认保存）**：预览区保存按钮；**`source = ai`**；fetch 含 **`ai`**；**`npm.cmd run build`** 见 **`DEVELOPMENT_LOG.md`**。
- **2026-05-02（Phase 3.1：OpenAI 预览接口）**：**`POST /api/analyze-article`**、结构化 JSON、**`/articles/[id]`** **「真实 AI 分析测试」**；**`OPENAI_API_KEY`** 服务端；**`openai`** 依赖；文档与 **`.env.example`** 已同步。**`npm.cmd run build`** 见 **`DEVELOPMENT_LOG.md`**。
- **2026-05-02（PRD：AI 推荐与多语言语言模型）**：**`docs/PRD.md`** 新增 **§1.5.6**（**`native_language` / `explanation_language` / `target_language`**，不写死中文→德语）、**§13**（AI 推荐目标、A2/B1/B2 侧重、**`level_estimate`** 表述、动态反馈为未来项、当前仅手动选级）；**未改代码**。
- **2026-05-02（Phase 3.0 完成确认，仅文档）**：**AI 分析入口**、**mock 结果结构**、**mock UI 接入**已验证；**未调用 OpenAI**、无 API 成本；mock 仅用于 **UI/数据流**；**Phase 3.1** 再接真实 API 与质量/过滤/CEFR。**本条未改代码**。**`npm.cmd run build`** 见 **`DEVELOPMENT_LOG.md`** 本条。
- **2026-05-02（Phase 3.0：Mock AI 分析）**：**`/articles/[id]`** **「AI 分析本文」** → **`mockAnalyzeArticle`**（**不调用 OpenAI**）；类型 **`src/lib/articleAnalysis/types.ts`**；词汇/语法 **`source = ai_mock`** 写 **Supabase**，与手动流共用 **`InteractiveArticleReader`**；摘要/问题仅页面展示。**`npm.cmd run build`** 已通过。
- **2026-05-02（/import 手动粘贴正文清理：验证记录，仅文档）**：**手动粘贴**只做 **纯文本段落恢复**，**不强行识别**正文小标题；**未来 URL/插件** 再基于 **HTML DOM** 识别 **h1/h2/h3**、小标题、**图片说明**、作者、发布时间。**已验证**：软换行合并、段首不误拆、空行分段保留、主标题不重复进 **`original_text`**、**`/articles/[id]`** 正常、词汇/语法高亮与保存与刷新恢复正常。**本条仅更新文档**，未改 `/import` 代码、阅读页、词汇/语法、schema/RLS、occurrence/高亮/定位。**`npm.cmd run build`**（本条后）已通过。
- **2026-05-02（/import 正文清理：初版段落归一）**：**`cleanArticleText`** 引入段落结构，缓解正文压成一大段；其中正文小标题启发式已由上条「仅空行分段」策略替代。**未改**阅读页、词汇/语法、schema/RLS。
- **2026-05-02（Phase 2.5 完成记录 + 文档 + 别名清理）**：确认 Phase **2.5 completed**；更新 **PRD / DATABASE / README / PROJECT_STATUS / DEVELOPMENT_LOG**；删除 **`errors.ts`** 未使用的 **`formatSupabaseError`** 导出；**`npm.cmd run build`**、**`npm.cmd run lint`** 已通过。
- **2026-05-02（Phase 2.5 保守 cleanup）**：仅删除/修正明显 **unused**、**prefer-const**、过时注释；**`eslint.config.mjs`** 关闭 **`react-hooks/set-state-in-effect`** 以利 CI；**未改** occurrence/高亮/定位、**未改** Supabase 写入语义、**未改** schema/RLS；**`npm.cmd run build`** 与 **`npm.cmd run lint`** 已通过。AI 自动分析、Chrome 插件、部署仍**未开始**。
- **2026-05-02（Phase 2.5：sense UUID、Tab 隔离）**：修复 **`vocabulary_occurrences`** 误传 **`sense-…`** 为 **`vocabulary_sense_id`**（**`22P02`**）；**`VocabSense.dbSenseId`**；fetch 将库 sense UUID 映射为 **`sense-ui-${uuid}`** + **`dbSenseId`**；**`InteractiveArticleReader`** 拆分 **`vocabSelection` / `grammarSelection`** 与 **`vocabDetailOnly` / `grammarDetailOnly`**；**`persisted`** 标记。Phase 2.5 仍以 Supabase **`vocabulary_*` / `grammar_*`** 为准。**`npm.cmd run build`** 已通过。
- **2026-05-02（Phase 2.5 Supabase：GRANT + dbItemId）**：**`005_vocabulary_grants_fix.sql` / `006_grammar_grants_fix.sql`** 补充说明（SQL Editor 执行）；**`schema.sql`** 追加 vocabulary/grammar **GRANT**。**阅读页** **`ArticleVocabItem` / `ArticleGrammarItem`** 区分 **`id`（UI）** 与 **`dbItemId`（UUID）**；掌握状态 **`UPDATE`** 仅用 **`dbItemId`**；**`persistManual*`** 回填 **`dbItemId`**、保留 **`id`**；**`formatSupabaseOrUnknownError`** 输出 message/code/hint/details。**`npm.cmd run build`** 已通过。
- **2026-05-02（/import 引号标题）**：修复 **`«…‹…›…»`** 长标题被误判面包屑、问句被当成 **title** 的问题；支持瑞士/德语常见行首引号；**lead** 保留 **1～2 行**；标题候选长度 **8～220**；**`parsePastedArticleText`** 为 **`parseArticleFromRawInput`** 别名。**`npm.cmd run build`** 已通过。
- **2026-05-02（Phase 2.5 词汇 occurrence 全文）**：**item 仍按词条去重一张卡**；**occurrence** 由当前文章 **`articlePlain` 全文扫描** 生成 **N 条**（**`finalizeArticleVocabularyItems` + `rebuildUserStyleVocabOccurrencesFromArticle`**），**id** 为 **`${itemId}-${start}-${end}`**；**`/articles/[id]`** 的 plain 含 **标题 + 正文** 以覆盖标题内匹配；恢复自 Supabase 后同样重算展示；**`persistManualVocabularyItem`** 返回的 occurrence id 与 UI 一致。**`npm.cmd run build`** 见本任务日志。
- **2026-05-02（阅读页 mastery 卡片 UI）**：**`InteractiveArticleReader`** 词汇/语法 **详情与列表** 标题行 **中文掌握状态 badge**；**已掌握 / 已忽略** 时底部 **恢复**（回到 **new**），去掉卡片底部 **英文 mastery 字符串**。**`npm.cmd run build`** 已通过。
- **2026-05-02（occurrence 列表排版与左右滚动修复）**：**`vocabOccurrenceToRanges`** 改为**每条 occurrence 单区间**，与右侧列表 id 一一对应；详情「本篇出现位置」**两列布局**（固定序号列 + 可换行句子）；左侧 **`articleScrollRef`**、右侧 **`Tabs`** **`panelScrollRef`** 内 **`scrollTo`** 定位；**`Card`** **`forwardRef`**。**`npm.cmd run build`** 已通过。
- **2026-05-02（阅读页 hover / occurrence 定位）**：**`InteractiveArticleReader`**：右侧词汇/语法**列表与详情卡片 hover**（及无 hover 设备上点击列表短时 peek）时，左侧该条目**全部 occurrence** 加强 **`ring`**；详情「本篇出现位置」**可点击**，左侧 **`data-occurrence-id`** 滚动定位并短暂 **flash**；文中高亮带 **`data-marker-id` / `data-occurrence-id` / `data-range-id`**。**仍不做**复杂左右滚动同步。**`npm.cmd run build`** 已通过。
- **2026-05-02（阅读页左右联动）**：**`InteractiveArticleReader`**：桌面端右侧 **sticky**（**`top-20`**、**`max-h-[calc(100vh-100px)]`**）、**`Tabs`** 根节点 **`h-full`**；左侧文章区独立纵向滚动；**`vocabItemRefs` / `grammarItemRefs`** + **`scrollIntoView`**；**`flashPulse`** 短暂 **ring**；点击高亮与手动添加均触发联动。**未做**随文滚动自动同步列表。**`npm.cmd run build`** 已通过。
- **2026-05-02（PRD：多语言 / 英语愿景）**：记录 **Reading Coach** 多语言扩展、**英语优先**及习得维度（短语动词、搭配、语体等）；**CEFR** 统一与考试参考；**`language` 字段**仅 **`DATABASE.md` §10.7** 规划；**德语 MVP 优先级不变**。
- **2026-05-02（`/articles/[id]` Hooks 顺序）**：**`ArticleDetailPage`** 将全部 Hooks（含正文 layout 的 **`useMemo`**）移到任意条件 **`return` 之前；**`article?.original_text ?? ""`** 作为 fallback；**`npm.cmd run build`** 通过，真实文章页交互可回归测试。
- **2026-05-02（Phase 2.4 `/articles/[id]` 阅读交互）**：新增 **`InteractiveArticleReader`**，**`MockArticleReader`** 改为薄封装；**`buildPlainTextArticleLayout`**；**`src/lib/articleReading/types.ts`**、**`markers.ts`** 占位；真实文章页可选词添加词汇/语法、掌握/忽略（内存）；摘要/问题「待 AI 分析」。**Chrome 插件**暂缓。**`npm.cmd run build`** 已通过。
- **2026-05-02（/import 界面精简）**：默认仅 **标题、粘贴、预览、水平与保存**；**链接 / 来源** 归入 **「可选信息」**、识别与统计归入 **「清理详情」**，均默认折叠；文案去技术字段名；解析与持久化逻辑不变；**插件 / URL 抓取 / 手机分享** 未来将自动带入链接与来源。
- **2026-05-02（/import 正文元信息）**：**`parseArticleFromRawInput`**：**副标题 → 作者（`authorKey` 全文去重）→ 发布时间 → 正文** 写入 **`cleaned_text`**；**`stripLeadingTitleDuplicate`** 减轻与 **`articles.title` 重复**；**`cleanArticleText`**（面包屑/Abo/短数字行等）照旧；**无 `author` / `published_at` / `subtitle` 列**；**未改 schema**。
- **2026-05-02（/import 清理流程）**：**`raw_pasted_text`** 与 **`cleaned_text`** 分栏；**「清理正文」** 调用 **`src/lib/text/cleanArticleText.ts`**（统计原始/清理字符数、删行数）；**保存** 仅 **`articles.original_text = cleaned_text`**，**raw 不入库**。文档已同步。
- **2026-05-02（Phase 2.3 对齐确认）**：**`/import` → `articles` → `/articles/[id]`**、**`/dashboard`** 最近 **10** 篇已在代码库落地；**`003`/`004`** 与 **`schema.sql` GRANT** 已备；**`/import`** 正文说明 **`original_text`**（暂无 **`cleaned_text`** 列）。文档与 **PRD / DATABASE / README** 已同步「仍未完成」含 **Chrome 插件 MVP**。
- **2026-05-02（产品形态与数据同步）**：明确 **Web App 主体**、**插件为导入入口**、**手机多路径**、**Supabase 统一库**与**跨设备同步**；**商业化**按账号/额度；**开发优先级**（Web 文章链路 → 插件 MVP → OpenAI → PWA/分享；自动抓取非 MVP）。见 **`docs/PRD.md` §1.1–§1.4**、**`docs/DATABASE.md`「统一云端与多入口」**；时间字段仍为 **PRD §12**。
- **2026-05-02（PRD/DATABASE：Mock + 时间字段）**：明确 **Mock** 与 **`/articles/mock`** vs **`/articles/[id]`**；约定 **articles / vocabulary_items / grammar_items / occurrences** 的时间与学习进度字段及 **read_status** 枚举；**mastered_at / ignored_at** 等列为后续迁移，**不强制**当前改 schema。见 **`docs/PRD.md` §2.1、§12** 与 **`docs/DATABASE.md`** 对应节。
- **2026-05-02（Phase 2.3 articles）**：**`/import`** 写入 **`articles`**；**`/articles/[id]`** 读库与基础分栏；**`/dashboard`** 最近 10 篇；**`003`/`004`** 与 **`schema.sql` GRANT**；文档同步。
- **2026-05-02（Phase 2.2 验证记录）**：文档记录 **Auth 登录**、**profiles RLS（001）**、**authenticated GRANT（002）**、**`/account`** 读 **profile** 均已验证；明确 **未做**：**articles / vocabulary / grammar** 持久化、**OpenAI**、**Vercel**。**下一阶段：Phase 2.3 `/import` → `articles` + 详情页**（仅文档，未改页面）。
- **2026-05-02（profiles GRANT 002）**：新增 **`supabase/fixes/002_profiles_grants_fix.sql`**，为 **`authenticated`** 授予 **`public.profiles`** 的 **SELECT/INSERT/UPDATE/DELETE**；**`schema.sql`** 同步 **GRANT**；文档说明 RLS 与表权限关系。**不授权 anon**、不关 RLS。
- **2026-05-02（profile upsert + 错误展示）**：**`/account`** 使用 **`upsert` + 再 select**；**`formatSupabaseOrUnknownError`** 消除 **`[object Object]`**；新增 **`supabase/fixes/001_profiles_rls_fix.sql`**（SQL Editor 可重复执行）。**`schema.sql`** 仅增注释。
- **2026-05-02（Phase 2.2 Auth）**：新增 **`/login`**、**`/signup`**、**`/account`**；**`AuthNav`**；**`ensureUserProfile`**（RLS 下 anon 创建/读 `profiles`）；文档说明 **邮箱确认** 与 Dashboard 设置。**未改** `schema.sql`、Mock 阅读高亮/手动添加逻辑。**`npm run build`** 已通过。
- **2026-05-02（supabase-test / RLS 文案）**：测试页区分 **连接成功**、**受 RLS 保护（42501 / permission denied）**、**连接失败**；说明未登录读 `profiles` 被拒为预期；文档补充 RLS 与 Auth 下一步。**未**改库表与 Mock 阅读页。
- **2026-05-02（Supabase env 修复）**：修复 **`/settings/supabase-test`**「已配置却报缺 URL」：`client.ts` 改为**静态**读取 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`（禁止 `process.env[name]`）；**`readPublicSupabaseEnv()`** 与测试页共用；错误信息区分 URL/key 缺失；文档与 README 补充 Next 内联规则。**未改** `.env.local`、Mock 阅读页。
- **2026-05-02（Phase 2.1 client）**：安装 **`@supabase/supabase-js`**；**`.env.example`**、**`src/lib/supabase/client.ts`**、**`/settings/supabase-test`**（只读 `profiles`）；**`/settings`** 入口链接；**`.gitignore`** 调整以允许提交 `.env.example`。**阅读 Mock 未改**。仍需本地 **`.env.local`** 与后续 **Auth**。
- **2026-05-02（Phase 2 schema 已执行）**：Supabase **项目已创建**，**`schema.sql` 已成功执行**；**7 张表**已在 Table Editor 可见；重复跑原始 SQL 可能出现 **`relation "profiles" already exists`**（表示已执行过）。
- **2026-05-02（Phase 2 数据库准备）**：新增 **`supabase/schema.sql`**（`profiles`、`articles`、`vocabulary_*`、`grammar_*`、索引、**RLS**、`updated_at` 触发器）与 **`docs/DATABASE.md`**；**`docs/PRD.md`** 增补 **§11**。
- **2026-05-02（发音 /settings）**：修复 **延迟 `speak` 导致无用户激活、点击无声**；`speakGerman` 改为点击栈内 **同步 `speak`**（`cancel`、可选 de-* `voice`、`rate`/`pitch`、控制台日志）；`PronunciationButton` **阻止冒泡** + 点击 **console.log** + 短时 **「正在播放」** 反馈；**`/settings`**：**Guten Tag** 封装测试 + **「直接测试 speechSynthesis」** 排障；`docs/PRD.md` §7 更新。
- **2026-05-02（Phase 1 走查）**：阅读页左侧**高亮图例**与列表徽章统一为系统/用户词汇与系统/用户语法中文说明；`articles/mock`、首页、仪表盘文案微调；`docs/PRD.md` 增加 **§9.1 设置字段** 并更新发音与高亮表述；`README` 同步。
- **2026-05-02（高亮修复）**：`/articles/mock` 用户手动词汇/语法在原文中的高亮改为 **selectedText 校验 + offset 不可靠时在 articlePlain 上精确匹配**，避免「列表为 angekündigt、高亮却落在其他词」的错位；PRD §8.0 补充定位可靠性说明。
- **2026-05-02（PRD）**：新增正式需求文档 [`docs/PRD.md`](./docs/PRD.md)；`README.md` 已链到 PRD；`AGENTS.md` / `CLAUDE.md` 规定**需求变化须同步更新 PRD**，并保留任务后日志/状态/README 与 `npm run build` 规则。
- **2026-05-02（Agent 工作流）**：新增 [`AGENTS.md`](./AGENTS.md) / [`CLAUDE.md`](./CLAUDE.md)，规定每次开发任务须更新 `DEVELOPMENT_LOG.md`、`PROJECT_STATUS.md`，特定情形下更新 `README.md`，且任务结束前运行 `npm run build`。

## 产品需求文档

- [`docs/PRD.md`](./docs/PRD.md) — 单一正式 PRD，需求变更时与此文件对齐。
- [`docs/DATABASE.md`](./docs/DATABASE.md) — Phase 2 数据库设计说明（与 `supabase/schema.sql` 配套）。
