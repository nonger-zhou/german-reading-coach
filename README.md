# German Reading Coach

**产品形态**：**Web App** 为能力主体；**Chrome 插件**为桌面端**导入入口**（MVP 见 `browser-extension/chrome-mv3`）；手机通过浏览器、粘贴/URL、未来 **PWA / 分享** 接入。**Supabase** 为统一云端库（详见 [`docs/PRD.md`](./docs/PRD.md) **§1.1–§1.2**、[`docs/DATABASE.md`](./docs/DATABASE.md)）。

**定位（检查点）**：面向**真实德语文章**（尤其**新闻**）的阅读学习工具；**目标用户**为**中文母语**德语学习者，水平侧重 **A2–B2**（尤其 **B1/B2**）。**核心目标**：导入文章后，系统标出理解**主旨与关键细节**最需要的**词汇、表达与语法**，减少频繁停读查词。完整表述见 [`docs/PRD.md`](./docs/PRD.md) **§1.0**。

**技术底座**：远程 **Supabase** 已执行 [`supabase/schema.sql`](./supabase/schema.sql)（**7 张表**）；**`@supabase/supabase-js`**、[`.env.example`](./.env.example)、**`/settings/supabase-test`**；**Auth + `profiles`**（RLS **`001`**、GRANT **`002`**）；**`articles` GRANT/RLS `003`/`004`**；词汇/语法 **`005`/`006`**；深度笔记字段 **`008`**（`vocabulary_items` / `grammar_items` 的 `user_deep_note`，未执行时旧词汇/语法功能仍应可用）。**`/import`** 将清洗正文写入 **`articles.original_text`**（元信息入正文前部，无独立 `author`/`published_at` 列）。**`OPENAI_API_KEY`** 仅服务端（本地 **`.env.local`**；线上通过 Vercel Environment Variables）。**Vercel Production** 已部署：[`https://german-reading-coach.vercel.app`](https://german-reading-coach.vercel.app)。**`/articles/mock`** 为**演示**阅读器；真实学习数据在 **`/articles/[id]`**。时间字段与 **read_status** 规划见 **PRD §2.1、§12** 与 **DATABASE §10**。路线图见 **PRD §1.4**，进度见 [`PROJECT_STATUS.md`](./PROJECT_STATUS.md)。

**产品愿景（扩展）**：底层可演进为**多语言 Reading Coach**；**German Reading Coach** 为德语实例；**英语**为优先扩展语言（习得维度与 CEFR 见 **[`docs/PRD.md`](./docs/PRD.md) §1.5**）。**母语 / 解释语言 / 目标语言**三维度见 **§1.5.6**。**真实 AI 词汇/语法推荐**的产品原则（读前理解、数量控制、专名过滤、CEFR 侧重、**`level_estimate`** 含义）见 **§13**；Phase 3.0 Mock 不用于评估最终质量。**当前主线仍为德语 MVP**；多语言 **`language` 字段**仅见 **[`docs/DATABASE.md`](./docs/DATABASE.md) §10.7** 规划，**未改 schema**。

- **正式产品需求**（PRD）：[`docs/PRD.md`](./docs/PRD.md)（**§1.0** 目标用户与核心价值；**§5.1–§5.3**：学习中 / 已掌握 / **暂忽略** / **删除**；**§8.1.1** 广义 lexical item；**§12.8** 删除文章（未来）：文章级数据 vs 长期词库主记录；**§12.5** 总词库今日「新增 / 再次遇到」规则；**§13** / **§13.6** AI 推荐规则与软上限）
- **阅读页高亮、重叠与选区**（用户手册素材）：[`docs/READING_HIGHLIGHTS_AND_OVERLAPS.md`](./docs/READING_HIGHLIGHTS_AND_OVERLAPS.md)
- **数据库设计（Phase 2）**：[`docs/DATABASE.md`](./docs/DATABASE.md) · SQL：[`supabase/schema.sql`](./supabase/schema.sql)
- **个人使用检查清单**：[`docs/PERSONAL_USE_CHECKLIST.md`](./docs/PERSONAL_USE_CHECKLIST.md)（本地启动、Supabase SQL、OpenAI Key、日常完整流程与常见问题）
- **导入主卡讨论备忘**：**[`docs/IMPORT_UI_DISCUSSION.md`](./docs/IMPORT_UI_DISCUSSION.md)**（来源稿 / 剪贴板 / 历史「重新整理」取舍）；对照示意 **`/import/mock`**。
- 开发记录：[`DEVELOPMENT_LOG.md`](./DEVELOPMENT_LOG.md)
- 项目状态：[`PROJECT_STATUS.md`](./PROJECT_STATUS.md)

## 当前已实现能力（文档检查点）

以下与 **`docs/PRD.md` §1.4.1** 及 **`PROJECT_STATUS.md`** 对齐，供后续开发对照。

- **Supabase Auth**；**文章导入** **`/import`**（默认链接导入 + 可切手动粘贴 + Chrome 插件预填草稿）；**正文清理与段落/元信息**（`parseArticleFromRawInput` / `cleanArticleText`）写入 **`articles.original_text`**。导入主卡若需与「草案」对照，可访问静态示意 **`/import/mock`**（无保存、无抓取，不列入顶栏）。
- **链接导入 API**：**`POST /api/import-url`** 服务端抓取网页并提取标题、来源、发布时间文本与正文；复用现有清理与保存逻辑；不调用 OpenAI。
- **阅读页** **`/articles/[id]`**：**左侧原文高亮**；**右侧 Tabs**：词汇 / 语法 / 摘要 / 阅读问题；移动端点击词汇高亮优先打开应用内详情；**语法高亮（蓝 / 紫）内可拖选子串**加入词库，无选区时轻点仍打开语法说明。
- **阅读页词汇统计**：本篇词汇区显示「生词数（去重，含暂忽略）/ 全文总词数（不去重）/ 生词占比」；口径为：同词在卡片反复出现只算 1 个生词，`mastered`、已删除与未标注不计入生词。
- **删除文章 v1**：`/articles/[id]` 支持删除文章；删除 `articles` 与该文章关联的 `vocabulary_occurrences` / `grammar_occurrences`，保留长期 `vocabulary_items` / `vocabulary_senses` / `grammar_items`。
- **手动添加词汇、手动添加语法**；**真实 OpenAI** **`/api/analyze-article`**（服务端通过 **undici + IPv4** 调用 `api.openai.com`，减轻部分 Windows 环境下默认 `fetch` 连接失败；错误响应会附带底层 `cause` 说明；结构化词汇含 **`grammatical_gender`**（名词 m/f/n 等），写入 **`vocabulary_items.gender`**）；**预览后确认保存** → AI 词汇/语法入库（**`source = ai`**）；**摘要三字段 + `reading_questions`** 写入 **`articles`**（**`007`**）。**AI 预览与阅读页词汇主标题**：在 **`grammatical_gender` 为 m/f/n** 且 lemma 未带 **der/die/das** 时自动显示 **定冠词 + 词典形**（如 **die Gymiprüfung**），lemma 已含冠词则不再重复。词汇入库时 **`vocabulary_items.lemma`** 保留 AI 词典形（如名词 **das …**），**不**用句中 `display_word` 覆盖。
- **手动添加项**：缺失解释时可 **「补充 AI 解释」**（**`/api/enrich-vocabulary`** / **`enrich-grammar`**）；**不**在普通卡提供 App 内「重新生成解释」。
- **外部深入解释**（词汇/语法卡）：ChatGPT / Claude / Gemini / DeepSeek / 仅复制 Prompt（**不调本应用 OpenAI、不入库**）；点击后直接跳转，并在页面提示“点击后会自动复制深度学习 Prompt，可在外部页面直接 `Ctrl+V` 粘贴发送”。
- **我的深度笔记**（词汇/语法卡）：用户可从外部 AI 复制解释后粘贴保存，或从剪贴板读取到笔记框；在文章详情卡内默认折叠，减少空白占位，并位于学习状态操作之后；保存前会清理常见 Markdown 标记（如 `##`、`**`、`>`）以及手机剪贴板可能带来的不可见控制字符，以普通笔记文本显示；只写 Supabase，不调用本应用 AI API；须执行 **`supabase/fixes/008_learning_item_deep_notes.sql`** 才能保存。
- **全局词库 `/vocabulary`、全局语法 `/grammar`**：Supabase 总库（默认全部视图、时间分组、搜索、状态、等级、来源精确跳转）；词库与语法库均支持单项状态管理。
- **状态**：学习中 / 已掌握 / 暂忽略通过轻量下拉菜单修改；**删除（本篇 occurrence）**为独立操作；**已掌握、暂忽略**在文章页**默认折叠**；**已掌握词汇**在正文中默认不常驻高亮，但从卡片、occurrence 或总词库来源链接点击时仍可定位到原文并短暂闪烁；**occurrence** 列表点击 ↔ **左侧定位与高亮**；**刷新与再次进入**恢复侧栏数据（**不**自动重跑全文 AI，见 **Phase 3.14**）。
- **Chrome 插件 MVP**：`browser-extension/chrome-mv3` 提供工具栏按钮与右键菜单，读取用户当前已可见网页内容并打开 `/import` 预填草稿；不绕过付费墙或登录墙。**Vercel 部署**：Production 已通过 CLI 部署到 [`https://german-reading-coach.vercel.app`](https://german-reading-coach.vercel.app)，当前线上版本以最后一次成功部署为准；仓库内已含 **词汇卡名词性（der/die/das）** 展示逻辑与 **GitHub Actions / `vercel:prod`** 说明，合并并部署后生效。历史能力还包括已掌握词默认不高亮、移动端高亮触摸优化、AI 候选保存前整理与深度笔记剪贴板内容清理；步骤与后续 Supabase Redirect URLs 自检见 **[`docs/DEPLOY_VERCEL.md`](./docs/DEPLOY_VERCEL.md)**。

## 协作与文档义务（自动化助手 / 贡献者）

开发任务收尾时请遵守 [`AGENTS.md`](./AGENTS.md) 与 [`CLAUDE.md`](./CLAUDE.md)：**更新** `DEVELOPMENT_LOG.md` 与 `PROJECT_STATUS.md`；若涉及依赖、运行方式、页面、API、数据库、部署或环境变量，**同步** `README.md`；结束前运行 **`npm run build`** 并修复失败项。非任务要求请勿改变现有页面行为。**Phase 3.1**：本地需在 **`.env.local`** 配置 **`OPENAI_API_KEY`**（**不要**提交到仓库）以试用真实 AI 预览。

## 运行命令

```bash
# 安装依赖（首次）
npm install
# 若 PowerShell 报「无法加载 npm.ps1 / running scripts is disabled」，请在本节命令里把 npm 换成 npm.cmd（见下方说明）

# 本地开发（推荐：先关掉占用 3000 的旧进程，再启动，避免同时跑两个网站）
npm run dev:clean

# 或仅启动（若 3000 已被占用，Next 会自动改用 3001——请务必看终端里的 Local 地址）
# dev / dev:clean 在 Node 20.19+ / 22.9+ 下会经 scripts/next-dev-use-system-ca.cjs 自动加 --use-system-ca，便于信任系统/代理证书链。
npm run dev
```

**Windows PowerShell（常见）**：若出现 **`npm.ps1 cannot be loaded because running scripts is disabled`**，请二选一：

1. **推荐（不改系统策略）**：把命令里的 **`npm`** 换成 **`npm.cmd`**，例如 **`npm.cmd run dev:clean`** 或 **`npm.cmd run dev`**（`build` / `test` 同理）。
2. **可选**：只对当前用户放宽脚本策略（管理员 PowerShell 非必须）：`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`，之后可继续用 `npm run ...`。

浏览器请打开终端里 **Local** 所显示的地址（一般为 [http://localhost:3000](http://localhost:3000)）。若你曾重复启动过开发服务，请优先使用 **`dev:clean`**，并始终使用**同一端口**对应的页面，否则可能看到旧代码或旧数据表现。

```bash
# 生产构建（PowerShell 若拦截 npm.ps1，请用 npm.cmd run build）
npm run build

# 生产启动（需先 build）
npm run start

# Lint
npm run lint
```

## Chrome 插件 MVP（本地加载）

插件目录：`browser-extension/chrome-mv3`。用途是在桌面 Chrome 中读取当前页面已展示的标题、URL、来源和正文，并打开 `/import` 预填草稿；适合用户已登录新闻站、服务端 URL 抓取拿不到正文的场景。插件会扫描页面可见的大字号 / 粗体文字块，优先选择视觉大标题，并提取正文段落，跳过常见的 newsletter、相关阅读、作者简介、分享与评论区；导入页清理器也会对这些尾部内容做兜底截断。

安装方式：打开 Chrome 的 `chrome://extensions/`，开启「开发者模式」，点击「加载已解压的扩展程序」，选择 `browser-extension/chrome-mv3`。之后可点击工具栏按钮，或在页面右键选择「导入到 German Reading Coach」。如果页面正文识别不准，可先选中文章正文再导入。

## Vercel 部署（生产）

当前 Production 地址：[`https://german-reading-coach.vercel.app`](https://german-reading-coach.vercel.app)。本次 CLI 部署已在 Vercel Production 配置 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`OPENAI_API_KEY`。完整步骤、环境变量表、Supabase **Redirect URLs** 与 **`maxDuration`** 说明见 **[`docs/DEPLOY_VERCEL.md`](./docs/DEPLOY_VERCEL.md)**。

CLI 预览 / 生产（需先 `npx vercel login`）：

```bash
npm.cmd run vercel       # 预览部署
npm.cmd run vercel:prod  # 生产部署
npm.cmd run vercel:prod:system-ca  # 生产部署（遇 TLS 证书错误时，子进程带 --use-system-ca）
```

推荐长期用 **Vercel Dashboard 连接 Git**：向默认分支 **push** 即自动构建部署。亦可配置 **`.github/workflows/vercel-production.yml`**（需在 GitHub Actions Secrets 填入 `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`，见 **`docs/DEPLOY_VERCEL.md` §七**）。

**若线上界面与本地 `npm run dev` 不一致（例如仍见词汇卡底部「状态」、静态「学习中」徽标、主标题已带 der/die/das 却仍显示「名词性：…」）**：说明 **Production 尚未包含当前构建**。请在本机项目根目录执行 **`npm.cmd run vercel:prod`**（或 **`npm.cmd run vercel:prod:system-ca`**）并等待 Vercel 部署成功；在 [Vercel Dashboard](https://vercel.com) 核对该项目 **最新一次 Production 部署的时间与来源**。浏览器侧请对 **`german-reading-coach.vercel.app`** 做一次 **硬刷新**（Ctrl+Shift+R）或无痕窗口排除缓存。若你只在桌面保留**无 `.git` 的拷贝**，须用 **CLI 部署**或把代码同步到有远程的仓库后再由 Git 触发部署，否则线上不会变。

- **认证（Supabase）**：**`/login`**（含「忘记密码」发信）、**`/signup`**、**`/account`**、**`/auth/recovery`**（邮件重置密码落地页）；**`/login`** 与 **`/signup`** 支持查询参数 **`next`**（仅站内相对路径，见 **`src/lib/auth/post-auth-redirect.ts`**）：从需登录页进入认证页时会自动带上，登录或注册成功（立即有 session）后优先回到该路径，否则回 **`/`**。页面文案面向学习者（不强调 Supabase 品牌）；顶栏 **`AuthNav`**；**`profiles`** 为 **select + upsert（onConflict: id）** 再读回；异常展示 **message/code/details/hint**。若 RLS 异常可执行 **`supabase/fixes/001_profiles_rls_fix.sql`**。本地使用「忘记密码」时，请在 Supabase **Redirect URLs** 中加入 **`http://localhost:3000/auth/recovery`**（见 **`docs/PERSONAL_USE_CHECKLIST.md`**）。
- **导航与布局**：顶栏导航、`AppShell`，适配桌面与手机；登录后顶栏账户入口显示为圆形头像按钮，点击进入账户页。
- **首页 `/`**：仅保留产品标题与功能入口卡片；移除登录状态、云端文章数量与 Mock / Supabase 等偏开发说明。
- **仪表盘 `/dashboard`**：顶部统计读取当前账户真实数据（本周保存文章数、学习中词汇数、语法点总数）；「最近保存的文章」显示最近 10 篇，并提供 **「查看全部文章」** 入口；支持直接删除某篇已保存文章（删除本文与 occurrences，保留长期词/语法主记录），删除成功后有轻提示反馈并刷新统计。
- **文章库 `/articles`**：当前账户保存文章的完整列表，按保存时间倒序分页（每页 10 篇，页码 / 上一页 / 下一页），支持继续阅读与删除文章。
- **导入 `/import`**：支持 **手动粘贴** 与 **链接导入** 两种模式，默认展示**链接导入**。链接导入通过 **`POST /api/import-url`** 在服务端抓取网页（`http/https`）、提取标题、来源、发布时间文本与正文，清理后写入主编辑区 **「正文」**；请求使用**桌面 Chrome 式 UA + Accept + 语言**（见 **`src/lib/import/importFromUrl.ts`**）；抓取优先 **`node:http` / `node:https`（IPv4）** 与 DNS **IPv4 优先**，仅在 **`timeout` / `fetch_failed`** 时回退 **undici/fetch**；**响应头阶段**与**下载正文**分段限时（约 **90s + 120s**）；路由 **`maxDuration`** **300s**（部署平台支持时），减轻长页面下载被平台提前中断。若浏览器能打开某新闻页但抓取报失败，可能是 **Node 与系统 HTTPS 信任链不一致**（如个别瑞士媒体站）：本地 **`next dev`** 会在仅 TLS 校验失败时 **自动放宽并重试一次**；生产部署需显式 **`ALLOW_INSECURE_IMPORT_TLS=1`**（见 **`.env.example`** ，有中间人风险）。**不**绕过付费墙或登录墙。导入流程优先“先抓 URL，再自动填标题”，标题输入区放在链接导入区块之后，用户仅在自动标题缺失或想自定义（如中文标题）时手动覆盖；正文清理复用现有逻辑；**「从剪贴板读取」与「保存文章」**与主正文同卡（同一行；**无**「重新整理」；**链接导入**下「从剪贴板读取」为次要按钮样式，**手动粘贴**下为与「保存文章」同级主色以突出剪贴板路径；来源稿编辑仍触发防抖解析）；**存在来源稿时**可展开 **「来源稿（可选）」** 对照或编辑原始文本；德语阅读水平作为其后的设置项；**清理详情 / 字符统计不再展示给普通用户**；**抓取与清理不调用 OpenAI**。若站点仍拒绝抓取或需登录，会在 URL 输入框下方显示小提示。**「从剪贴板读取」**：复制正文后一键填入来源稿并整理到主正文；浏览器拒绝剪贴板权限时回退为在「正文」中手动粘贴。后续可在桌面 Chrome 插件中提供按钮 / 右键菜单 **「导入到 German Reading Coach」**，仅导入用户已可见正文。模式对应操作区会与模式切换联动高亮（链接导入高亮 URL 输入框与“抓取文章”，手动粘贴高亮主正文与「从剪贴板读取」）。保存逻辑仍写 **`articles`** 并跳转 **`/articles/[id]`**（**无**独立作者/发布时间库列）。
- **Chrome 插件导入 MVP**：`browser-extension/chrome-mv3` 提供工具栏按钮与右键菜单 **「导入到 German Reading Coach」**；插件读取当前浏览器页面中用户已经能看到的标题、URL、来源、发布时间与正文，并通过 `/import?chromeDraftId=...` 打开导入页预填草稿。插件会扫描页面可见的大字号 / 粗体文字块，优先选择视觉大标题，并提取正文段落，跳过 newsletter、相关阅读、作者简介、分享和评论等容器；导入页清理器会继续兜底移除常见尾部无关块。若页面正文识别不准，可先选中文章正文再点击插件导入。该能力不绕过付费墙、登录墙或订阅限制。
- **阅读水平两层设计**：`/settings` 保存当前账户默认阅读水平；`/import` 自动带入该默认值，但允许为当前文章临时修改；保存文章时把本篇使用的水平写入 **`articles.user_level_at_analysis`**；`/articles/[id]` 与 AI 分析继续使用文章记录中的水平。
- **阅读 `/articles/[id]`**（已保存文章）：**`InteractiveArticleReader`** — 可选词/句 **添加为词汇 / 添加为语法**、四种高亮图例（绿色系统词汇、琥珀用户/确认词汇、蓝色系统语法、紫色用户语法；已掌握词汇默认不常驻显色，但保留按需定位闪烁）、**真实 AI**（**「AI 分析本文」** / **查看 AI 预览**、**重新分析** 与 **API 成本**提示；AI 生成后先作为候选清单，保存前可删除单个词汇/语法候选，或先标记为学习中 / 已掌握 / 暂忽略；**一键保存** 后保留候选以 **`source = ai`** 写库，并写入 **`articles`** 摘要/阅读问题 **Phase 3.4**）、**`development` 下「开发工具」内 Mock 分析（不入库）**、右侧 **Tabs**（词汇、语法、摘要、阅读问题；**已保存** > **真实预览** > **开发 Mock 本地**）；词汇/语法卡用 **状态下拉菜单**修改学习中 / 已掌握 / 暂忽略，**删除**仍为独立操作；“我的深度笔记”默认折叠，可手动粘贴/剪贴板读取外部解释，保存到 **008** 字段，清理常见 Markdown 标记，不调用 AI；登录且库授权正确时，手动与 **已保存的真实 AI** 词条 **持久化**，**已掌握 / 忽略 / 恢复** 可 **跨刷新**；**Phase 3.7**：默认状态文案显示为 **学习中**，已掌握项目默认折叠到 **已掌握词汇/语法（n）** 区域；**Phase 3.6**：卡片 **「删除」**（误添/重复）从本文移除 occurrence，**不等于**已掌握；**Phase 4.1**：页面级 **「删除文章」**（二次确认）会删除本篇 `articles` 与本篇 occurrences，并保留长期词汇/语法主记录；桌面端右侧面板 **sticky + 内部滚动**；**右侧列表/详情卡片 hover**（或移动端点击列表短时预览）时左侧该词/语法**全部出现位置**叠加中性 **ring**；详情「本篇出现位置」**可点击**，左侧滚动至对应 **`data-occurrence-id`** 并短暂 **flash**；点击文中高亮或手动添加后右侧列表 **自动滚动定位**并短暂强调；**不做**复杂左右滚动同步；与 **`/articles/mock`** 共享交互模型。
- **阅读 `/articles/mock`**：同上组件；左侧德语演示含课文嵌入词与完整图例；移动端底部详情抽屉。
- **发音**：`/articles/mock` 与 `/vocabulary` 使用 **`PronunciationButton`** → **`speakGerman`**：须在用户 **click** 内 **同步** `speak`（延迟到 `setTimeout` 可能导致 Chromium **无声**）；`cancel()` 后创建 `SpeechSynthesisUtterance`，默认 **`lang = de-DE`**、`rate = 0.9`、`pitch = 1`；**有 de-* voice 则选用，无则仍 `speak`**；点击 **`preventDefault` / `stopPropagation`**；按钮侧 **`console.log`** 与短时 **「正在播放：…」** 反馈；空文本提示「没有可播放的文本」。**`/settings`**：**「测试德语发音」**（封装按钮）+ **「直接测试 speechSynthesis」**（最小 API，用于排障）。**无悬停自动播放**。
- **词库 `/vocabulary`**：Supabase 真实总词库（当前用户），支持时间分组 Tab（**今日词汇记录**按 PRD **§12.5** 汇总「新增 / 再遇」；其余 Tab 仍为入库时间口径）、本周复盘小卡（本周新增/学习中/已掌握/暂忽略，点击可联动到本周与对应状态筛选）、搜索、状态筛选（学习中/已掌握/暂忽略）、等级筛选（A1-C2）、来源文章精确跳转（进入文章页后选中对应词条并滚到原文 occurrence）；单词卡顶部状态位即为下拉菜单，可切换 **学习中 / 已掌握 / 暂忽略**，暂不做总词库删除；若来源文章已删除，来源位显示“原文已被用户删除”；空状态与错误提示已接入。
- **语法 `/grammar`**：Supabase 真实总语法库（当前用户），支持时间分组 Tab（全部/今日/昨日/近三日/本周，默认全部，按条目入库时间）、本周复盘小卡（本周新增/学习中/已掌握/暂忽略，点击可联动到本周与对应状态筛选）、搜索、状态筛选（学习中/已掌握/暂忽略）、等级筛选（A1-C2）、来源文章精确跳转（进入文章页后选中对应语法项并滚到原文 occurrence）；语法卡顶部状态位即为下拉菜单，可切换 **学习中 / 已掌握 / 暂忽略**，暂不做总语法库删除；若来源文章已删除，来源位显示“原文已被用户删除”；空状态与错误提示已接入。
- **设置 `/settings`**：用户可设置默认阅读水平（保存到当前账户，导入文章时自动带入但可按篇临时修改）、查看估计阅读辅助等级（附「非完整 CEFR」说明）、解释语言、发音相关选项与发音测试入口；页面不再直接展示内部字段名，也不展示 Supabase 连接测试等排障入口。仍以点击发音为主，无悬停自动播放。

## 技术栈

Next.js 16（App Router）、TypeScript、Tailwind CSS v4、React 19、Cheerio（服务端 HTML 解析）。

## 下一步开发计划

1. 先按 [`docs/PERSONAL_USE_CHECKLIST.md`](./docs/PERSONAL_USE_CHECKLIST.md) 把个人日常完整流程跑稳：导入 → AI 分析 → 保存 → 阅读 → 深度笔记 → 总词库/总语法 → 状态修改。
2. 继续迭代 OpenAI 提示与验收（**PRD §13**），确保 AI 推荐更贴近 A2–B2 新闻阅读。
3. 扩展总词库/总语法的复习、编辑与批量状态管理能力。
4. 可选：URL 导入站点适配增强、Chrome 插件打包发布、**PWA / 手机分享导入**；线上环境见 **[`docs/DEPLOY_VERCEL.md`](./docs/DEPLOY_VERCEL.md)**。

## 官方模板说明

本项目基于 [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app) 初始化。更多 Next.js 文档见 [nextjs.org/docs](https://nextjs.org/docs)。
