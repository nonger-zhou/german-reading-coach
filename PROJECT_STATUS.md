# 项目状态（Project Status）

## 产品名称

German Reading Coach

## 当前版本

**v0.1 Mock** + **Phase 2**；**Phase 2.5** 已完成；**Phase 3.0（Mock）**、**Phase 3.1–3.2（OpenAI + 确认保存 `source = ai`）**、**Phase 3.4（文章级 `summary_*` / `reading_questions`）**、**Phase 3.5（真实 AI 为主，Mock 仅 `development` 开发工具）**、**Phase 3.6（删除 ≠ 忽略）**、**Phase 3.7（学习中/已掌握/暂忽略 UI + 已掌握与暂忽略默认折叠）**、**Phase 3.8（全局词库/语法库 Supabase；总库支持状态管理）**、**Phase 3.13–3.14（词汇/语法「外部深入解释」；锁定 AI 调用、移除普通卡「重新生成解释」）**、**Phase 3.15（我的深度笔记：外部解释手动保存，不消耗本应用 AI token）**、**Phase 3.16（整文分析 SYSTEM_PROMPT：词汇不设固定上限 / 语法≤8、lexical item 与 part_of_speech 策略）**、**Phase 4.0（URL 自动导入：服务端抓取 + 预览后保存 + 剪贴板读取）**、**Phase 4.1（删除文章 v1）**、**Phase 7（Chrome 插件导入 MVP）**、**状态操作下拉菜单 UI** 已落地，见 **`DEVELOPMENT_LOG.md`**。

## 当前状态

- **新用户注册邮件通知（2026-10-15，已上线）**：Supabase 触发器 + `/api/hooks/new-user` + Resend，发到 `SIGNUP_NOTIFY_TO`；变量已配置、`011` 已执行、测试通过。见 `DEVELOPMENT_LOG.md`。
- **阶段**：**Phase 2.5** + **Phase 3.0（Mock 阅读演示）** + **Phase 3.1/3.2（OpenAI）** + **Phase 3.4（摘要与阅读问题入库）** + **Phase 3.5（文章页 AI 区整理）** + **Phase 3.6（删除学习项）** + **Phase 3.7（状态语义 UI）** + **Phase 3.8（全局总库）** + **Phase 3.15（深度笔记）** + **Phase 4.0（URL 自动导入 + 剪贴板读取）** + **Phase 4.1（删除文章 v1）** — **`/import`** 支持「手动粘贴 / 链接导入」：链接导入经 **`POST /api/import-url`** 在服务端抓取网页并提取标题/来源/发布时间文本/正文，清理后填入主编辑区「正文」；用户确认后沿用既有保存逻辑写入 `articles`；该流程**不调用 OpenAI**。当站点拒绝抓取或可能需要登录时，页面在 URL 输入框下方给出轻提示，并引导用户改用手动粘贴；手动粘贴模式支持 **「从剪贴板读取」**，用户复制正文后可一键填入来源稿并整理到主正文，浏览器拒绝权限时回退手动粘贴。**`/articles/[id]`**：**真实 AI** 为主流程（主按钮、状态行、**API 成本**提示）；**Mock 文章分析**仅在 **`development`** 下 **「开发工具」** 折叠区内，**不入库**、不触发「保存 AI 结果」。手动词条与确认保存的真实 AI 写入 **`vocabulary_*` / `grammar_*`**（**`source = ai`** 等）及 **`articles.summary_zh` / `summary_de_simple` / `reading_questions`**（须 **`007_article_analysis_fields.sql`**）；词汇/语法卡支持“我的深度笔记”，用户可粘贴外部 AI 解释或自己的补充笔记保存到 **`008`** 字段，**不调用本应用 AI API**；未执行 **`008_learning_item_deep_notes.sql`** 时，旧的词汇/语法读取与保存仍应可用，保存深度笔记会提示先迁移。学习项删除仍是按本文 occurrence 删除。**Phase 4.1**：文章页支持删除文章，确认后删除本文 `articles` 与本文 `vocabulary_occurrences` / `grammar_occurrences`，并保留长期 `vocabulary_items` / `vocabulary_senses` / `grammar_items`。**Phase 3.7**：UI 默认状态文案显示为**学习中**，`mastered` 条目默认折叠到已掌握分组，可展开与恢复学习。**Phase 3.8**：`/vocabulary` 与 `/grammar` 已读取当前登录用户真实 Supabase 数据，支持搜索、状态筛选、等级筛选、来源文章跳转；状态统一显示 **学习中 / 已掌握 / 暂忽略**。右侧 **摘要 / 阅读问题** Tab **已保存**优先；仍**不**自动保存 OpenAI 预览。**`OPENAI_API_KEY`** 仅服务端。**Chrome 插件 MVP** 暂缓。
- **Phase 3.4 验证状态**：文章级三字段与阅读页读写、**42703** 规避、Tab 持久化及与词汇/语法回归范围，见 **`DEVELOPMENT_LOG.md`**「**Phase 3.4 验证状态（仅文档）**」表；**前提**为远程库已跑 **007**。
- **Phase 3.4 学习闭环（文章页）**：真实 **AI** / 保存 / 刷新、手动 **enrich**、摘要三字段、高亮与左右定位、掌握状态、**`/import`** 与 **`/dashboard`** 未在本次任务改动——完整清单与「静态核对 / 实机前提」见 **`DEVELOPMENT_LOG.md`**「**Phase 3.4 学习闭环验证与状态（仅文档）**」。**当前不做**总词库/总语法业务页接库。
- **数据库**：**`articles`** 使用 **RLS（`user_id = auth.uid()`）** + **`GRANT … TO authenticated`**（**`schema.sql`** / **`003_articles_grants_fix.sql`**）；策略异常可跑 **`004_articles_rls_fix.sql`**。**不向 anon 授予 articles**。
- **应用**：**`/vocabulary`** 与 **`/grammar`** 已接入真实 Supabase 数据（当前登录用户维度）；词库与语法库均支持 **全部/今日/昨日/近三日/本周** 时间分组 Tab 与本周复盘小卡（点击联动筛选）。总词库/总语法库均支持通过状态下拉菜单切换 **学习中 / 已掌握 / 暂忽略**；暂不做总库删除。**`/articles/[id]`** 手动添加与真实 AI 保存的词汇/语法持续持久化至 **`vocabulary_*` / `grammar_*`**（登录、GRANT 已执行前提下），学习项卡片同样用状态下拉菜单修改状态，删除仍为独立操作；深度笔记需 **`008`** 字段。
- **产品方向**：**Web App** 为主体，**Chrome 插件**为桌面导入入口（MVP 见 **`browser-extension/chrome-mv3`**），**Supabase** 统一库（详见 **`docs/PRD.md` §1.1–§1.4**）。**愿景**：底层可扩展为**多语言 Reading Coach**，**英语**为优先扩展语言（详见 **`docs/PRD.md` §1.5**）；**母语/解释语言/目标语言**三维度见 **§1.5.6**。**AI 推荐**以「读前抓主旨与关键细节、控制数量、过滤无学习价值专名」为核心，水平侧重见 **§13**；**Phase 3.1+** 接真实 OpenAI 时以此为准。**当前主线仍为德语 MVP**，排期不变。
- **词汇优先整文分析 v1（2026-05-19）**：默认 **`/api/analyze-article`** 单次输出 **vocabulary（极简 B）+ 3 条阅读问题**；**不**默认 grammar/摘要；**`ENABLE_AUTO_GRAMMAR_ANALYSIS`** 可回退旧整文；**`/api/explain-grammar-selection`** + 阅读器 **「解释语法」**；全文翻译 **复制 Prompt**。见 **`DEVELOPMENT_LOG.md`**、**`docs/DESIGN_VOCAB_FIRST_GRAMMAR_ON_DEMAND.md`**。
- **阅读页 UI 清爽 MVP（2026-05-19）**：`/articles/[id]` 与阅读器右侧词汇区减噪（一行词数、折叠 AI 预览详情/外部深入解释、用户向错误文案）；顶栏已去掉「演示课文」链接（首页仍可进 Mock）。**P2**：文章信息折叠、阅读帮助合并、Badge **AI/手动**；**不再展示「入选说明」**，详情以本文含义 + 简单德语用法解释为主。
- **阅读定位框（2026-05-19）**：点击词汇或手动添加后，正文词上应出现 **内嵌金黄定位框**（非外圈 ring，避免被滚动区裁切）；选中时左侧自动滚到该词。
- **Chrome 插件 / 链接导入（2026-05-19）**：除 `<p>` 外，`<p>` 过短时会采 `article` 内叶子 **section**（如 **blog.nationalmuseum.ch** 的 `snm-text`）；过滤推荐区、Cookie 占位、发布日期与 Newsletter。插件改后须重新加载。
- **用户语法高亮（2026-05-19）**：手动保存的语法在正文中应显示**紫色**；匹配逻辑已加强（标点/情态动词/引号与 BOM 差异）。若仍无色，请硬刷新后重开文章，或删除重复语法项后重新拖选保存。
- **Vocabulary Prompt Reset v1（2026-05-17）**：legacy 整文路径仍使用 `vocabularySelectionPrompt.ts`；默认生产已切极简 B（`vocabularyMinimalBPrompt.ts`）。
- **vocabulary-only vs 整文实验（2026-05-18）**：非生产 live（`VOCAB_ONLY_VS_PROD_LIVE`），报告 **`scripts/vocabulary-only-vs-production-experiment-report.json`**；可选 `scripts/fixtures/meghan-article.txt`。
- **vocabulary 第二次调用实验（2026-05-19）**：非生产 live（`VOCAB_SECOND_CALL_LIVE`），对比生产单次 vs core+vocabulary 并行拆分（Reset v1 / 极简 B）；报告 **`scripts/vocabulary-second-call-experiment-report.json`**。短文/MSC/Meghan 拆分更易出动词；Gaullismus 长文拆分仍可能全名词。**未接生产 route**。
- **本篇词汇统计（2026-05-18）**：阅读页以**词条卡片**为主统计（可高亮 / 暂无高亮）；未定位的 AI 词汇仍保存为本篇；**PRD §6** 已更新。见 **`DEVELOPMENT_LOG.md`**。
- **下一步（建议）**：短期目标切回 **个人可完整使用版**：按 **`docs/PERSONAL_USE_CHECKLIST.md`** 跑通导入 → AI 分析 → 保存 → 阅读 → 深度笔记 → 总词库/总语法 → 状态修改；再迭代 OpenAI 提示与验收（**PRD §13**）。**Vercel Production** 已部署到 [`https://german-reading-coach.vercel.app`](https://german-reading-coach.vercel.app)，后续需完成 Supabase 生产回调 URL 自检；项目级 `npm.cmd run lint` 仍有既有 cleanup 项（`scripts/*.cjs` 的 `require()` 规则、文章库/仪表盘删除回调依赖提示、`/import` 未使用变量）；Chrome 插件后续可做打包发布，**PWA/手机分享**、支付与公开用户体系仍后置。合规边界：不绕过付费墙、登录墙或订阅限制。
- **需求 / 库设计**：**Mock** 与 **`/articles/[id]`** 见 **`docs/PRD.md` §2.1**；时间字段与 **read_status** 见 **§12**；**`docs/DATABASE.md`** Mock 节、**§10**、统一云端节；**read_status / finished_at / mastered_at / ignored_at** 等为后续 **schema** 增量，当前不强制迁移。
- **选区与「添加为词汇」**：长选区点词汇 = **词汇/表达层面（广义 lexical item）**，不等于整句当普通词、也不自动当语法；与 **「添加为语法」** 分工见 **`docs/PRD.md` §8.1.1**。**AI 主动推荐**亦应覆盖表达型词汇（短语、搭配、可分动词、新闻表达等），**统一进词汇 Tab**；**`item_type` / `surface_form` / `lemma` / `occurrence_sentence` / `explanation`** 等预留，**当前不改 schema/UI/prompt**。
- **学习中 / 已掌握 / 暂忽略 / 删除**：用户向语义与文章页行为见 **`docs/PRD.md` §5.1–§5.3**（含 **暂忽略** 折叠与恢复）；**删除**为从本篇移除 **occurrence**，不等于掌握。**AI 推荐数量与类型（软上限、非凑数）**见 **§13.6**。

## 当前仍未完成

- **英语学习功能**：已上线（2026-10-15）；英语分界线为初始标定，需真实使用后观察

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
| `/help` | 使用说明（面向使用者：推荐规则、学习状态、长文、复习、外部 AI、常见问题） |
| `/review` | 复习（学习中词汇翻卡复习，每组 ≤20；还不熟 / 记住了 / 已掌握；排期存浏览器本地） |
| `/vocabulary` | 总词库（真实 Supabase 汇总：默认全部、时间分组 Tab、本周复盘小卡、搜索、状态筛选、等级筛选、单词状态下拉菜单、来源文章精确跳转到对应词条/occurrence；暂不做总库删除） |
| `/grammar` | 总语法库（真实 Supabase 汇总：默认全部、时间分组 Tab、本周复盘小卡、搜索、状态筛选、等级筛选、语法状态下拉菜单、来源文章精确跳转到对应语法项/occurrence；暂不做总库删除） |
| `/settings` | 设置（可编辑并保存默认阅读水平；用户向展示估计阅读等级、解释语言、发音相关开关；不直接展示内部字段名或 Supabase 排障入口） |
| `/settings/supabase-test` | 隐藏诊断页：Supabase 连通性测试（普通设置页不再展示入口；排障时可直接访问） |
| `/login` | 邮箱密码登录；「忘记密码」发重置邮件；支持查询参数 **`next`**（安全相对路径），登录成功后优先回跳该路径，否则回 **`/`** |
| `/signup` | 邮箱密码注册；同上 **`next`**；注册后立即有 session 时回跳逻辑与登录一致 |
| `/auth/recovery` | 邮件重置密码落地页（设置新密码） |
| `/account` | 会话与 `profiles`（无行则自动插入默认值） |

## 下一阶段目标

- **导入（当前优先 P0–P1）**：先用好现有 **链接导入 / Chrome 插件 / 粘贴** 处理 **HTML 正文**（如 [L-GAV 十个常见问题](https://l-gav.ch/fragen-antworten/die-10-haeufigsten-fragen-antworten) — **原文排版阅读**，非 PDF/OCR）；**暂不** 启动 Moodle **SCORM 测验**、**SCREEN PDF** 全文自动导入大项。分类、三条链接用法与 P2–P4 排期见 **[`docs/IMPORT_SOURCES_AND_ROADMAP.md`](docs/IMPORT_SOURCES_AND_ROADMAP.md)**。
- **总词库 / 总语法** 下一步扩展为复习、编辑与批量状态管理；Chrome 插件打包发布与更多 **HTML** 站点适配；Production 已部署，短期优先 Supabase 回调 URL 与线上完整流程自检；**PWA / 手机分享** 排在更后（见 **PRD §1.4.2**）；**多语言 / 英语版**见 **PRD §1.5**（后续评估）。

## 待开发 / 产品 Backlog（非承诺排期）

以下由产品/维护者记录为**加分项**，实现顺序与版本未定；与 **`docs/USER_MANUAL.md` §15** 可交叉维护。

| 方向 | 说明 |
|------|------|
| **导入来源路线图（P1–P4）** | **P1**：`/import` 与插件上说明 HTML / PDF / SCORM 适用性。**P2**：网页内可读 PDF 文字层。**P3**：SCREEN/扫描 PDF + OCR。**P4**：SCORM 按屏 OCR（须合规）。详见 **`docs/IMPORT_SOURCES_AND_ROADMAP.md`**。 |
| **改名 / 商业化 / 中国用户（暂不做）** | 讨论结论与查证事实见 **`docs/BUSINESS_AND_CHINA_NOTES.md`**（中文名倾向「读报学外语」；英文名候选 GlossRead / Newsling / Readmint；我们承担 AI 费用按订阅收费；先做海外华人；国内版须同一套代码两种部署）。 |
| **复习进度存数据库** | 现在复习排期存在浏览器本地，换设备从头开始；改存 Supabase 后各设备同步。 |
| **`.gitattributes` 统一换行符** | 避免 Windows 上出现上百个只差换行符的「假修改」，减少多工具同时改代码时的冲突。 |
| **英语推荐可观察性** | 分析结果显示「本篇推荐 X 个词（水平、分界线约 N）」，便于判断英语分界线是否合适。 |
| ~~**整文 AI：超长正文分块分析**~~ | **2026-10-15 已完成**（默认词汇模式）：最多 4 段 × 1 万字符并行分析并合并词汇。legacy（含 grammar）路径仍只分析第一段。 |
| **总词库搜索：同 `normalized_key` 分组展示** | 当同一归一化键因 **`part_of_speech`** 不同存在**多条 `vocabulary_items`** 时，搜索命中后在列表中**收拢为一组**：组头展示词形（如 `lemma` / `display_word`），组内列出各条**词汇记录**（标明词性/类型 + 状态徽标），子行点击进入对应卡片详情。对用户统一称**「两条词汇记录」**（不说「学习档」）。**无分组实现前**：保持当前「并列多条」即可。 |

## 最近更新

- **2026-10-15（需求文档）**：PRD 新增 §1.4.3 社交媒体与手机导入（截图 / 拍照导入、手机分享菜单、X / Facebook / YouTube 文稿），待开发。
- **2026-10-15（英语学习功能已上线，PR #3 合并到 `main`）**：德语 / 英语两个独立学习空间（顶栏切换）；数据加 `language`（迁移 `010`，已有数据全为德语）；推荐 / 列表 / 复习 / 水平按语言隔离；英语选词引擎（英语词频表、词形还原、分界线）与英语提示词（中文 + 简明英文释义）；导入自动识别语言；英语水平对照表；Chrome 插件 0.1.6。德语选词与提示词由快照测试守护。**`010` 迁移已执行（已有数据：文章 109、词条 1157、语法项 93，全部为 de）。**
- **2026-10-15（阅读水平对照表）**：手册与 `/help` 加入德语 / 英语水平对照；水平选择处可跳转对照表。
- **2026-10-15（使用说明）**：新增软件内 `/help`；首页、页脚、阅读页、词库页均有入口。
- **2026-10-15（协作规则）**：开始前先 pull、改完即提交。
- **2026-10-15（阅读页组件拆分第一步）**：与状态无关的约 540 行移到 `src/components/articleReader/`，行为不变。
- **2026-10-15（复习功能）**：新增 `/review` 翻卡复习学习中词汇（还不熟 / 记住了 / 已掌握）。
- **2026-10-15（文档归档 + 提交规则）**：开发日志与状态旧记录归档到 `docs/archive/`；AGENTS/CLAUDE 改为改完即提交、只走 Git 部署。
- **2026-10-15（整理实验代码）**：5 月词汇实验移至 `experiments/vocabulary-2026-05/`，类型检查零报错。
- **2026-10-15（部署前自动测试）**：Vercel 构建先跑单元测试；GitHub Actions 改为只做测试与构建检查。
- **2026-10-15（长文分段分析）**：超过 1 万字符的文章分段并行分析（最多 4 段），词汇合并去重。
- **2026-10-15（过滤专有名词）**：候选标注疑似专名；模型释义为人名 / 政党 / 公司等的条目自动剔除（学习中除外）。
- **2026-10-15（总词库分页）**：每页 50 条，筛选时回到第 1 页。
- **2026-10-15（修复总词库 Bad Request）**：词库约 700 条时查询 URL 超长；改为分批查询 + 主列表分页。数据未受影响。
- **2026-10-15（选词 v2）**：本地 5 月工作已提交到 GitHub；整文分析改为「词频表 + 用户词库画像」选词——学习中的词必推、已掌握不推（去冠词稳健比对）、其余按等级词频分界线（自适应）；手动添加已掌握词会改回学习中；模型改为 `gpt-5-mini`（`OPENAI_ANALYSIS_MODEL` 可覆盖）。**Vercel 已连 Git：合并 main 即自动部署，勿再本机 `vercel:prod`**。Chrome 插件未改。

> 2026-05 及更早的「最近更新」条目已归档到 [`docs/archive/PROJECT_STATUS_UPDATES_2026-05.md`](./docs/archive/PROJECT_STATUS_UPDATES_2026-05.md)。

## 产品需求文档

- [`docs/PRD.md`](./docs/PRD.md) — 单一正式 PRD，需求变更时与此文件对齐。
- [`docs/DATABASE.md`](./docs/DATABASE.md) — Phase 2 数据库设计说明（与 `supabase/schema.sql` 配套）。
