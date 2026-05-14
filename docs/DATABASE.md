# German Reading Coach — 数据库设计说明

本文档描述 **Phase 2** 为 Supabase（PostgreSQL）准备的关系型 schema，对应仓库内 [`../supabase/schema.sql`](../supabase/schema.sql)。**`/import` → `articles` → `/articles/[id]`** 已接入真实读写；**`/articles/[id]`** 上**手动添加**与**用户确认保存的真实 AI** 词汇/语法在登录且已执行 **005/006** 授权脚本时写入 **`vocabulary_*` / `grammar_*`**；**`/vocabulary`**、**`/grammar`** 为 **Supabase 只读总库**（当前用户维度，见 **Phase 3.8**）。**`/articles/mock`** 仍为**演示**高亮，**不等同**于 **`articles`** 表持久化数据。Next.js 已接入 **浏览器端 Supabase 客户端**（见下「Phase 2.1」），可通过 **`/settings/supabase-test`** 对远程库做只读连通性检测。

### 文档与产品语义对齐（检查点）

以下**不新增表字段**，仅说明库内数据与 **PRD** 用户概念的对应关系；细节以 **`docs/PRD.md` §5** 为准：

- **学习中 / 已掌握 / 暂忽略**：由 **`vocabulary_items.mastery_status`**、**`grammar_items.mastery_status`**（及 UI 文案映射）表达；条目**仍保留**在总库相关表中。**已掌握 / 暂忽略**在文章页侧栏**默认折叠**（见 PRD **§5.3**）。
- **删除（本篇）**：删除的是 **`vocabulary_occurrences` / `grammar_occurrences`** 中**当前文章**下的行（按 **`article_id` + item**），**不**表示 `mastered`；左侧高亮随 occurrence 移除而消失。用户语义见 PRD **§5.1「删除」**。
- **广义词汇项**：存仍落在 **`vocabulary_*`**；**短语、搭配、可分动词**等与「单词」共用模型，产品细分见 PRD **§8.1.1**、**§13.6**。
- **文章级 AI 摘要与阅读问题**：**`articles.summary_zh`、`summary_de_simple`、`reading_questions`**（**Phase 3.4**；缺列执行 **`007_article_analysis_fields.sql`**）。

---

## Mock 与真实文章（术语）

- **Mock**：**演示版 / 假数据版**——用于验证交互与阅读体验，**不**等同于用户账户下 **`articles`** 表的持久化行（或数据仅存在于演示态）。
- **`/articles/mock`**：测试**高亮、词汇/语法面板、手动添加、发音**等；**不**代表真实数据库文章。
- **`/articles/[id]`**：从 **`public.articles`** 按主键读取，**RLS** 限制为 **`user_id = auth.uid()`**。

---

## 统一云端与多入口（数据同步）

- **产品形态**：**Web App** 为能力主体；**Chrome 插件**为桌面端**导入入口**；手机通过 **Web**、粘贴/URL、未来 **PWA / 系统分享 / Share Extension** 等接入（详见 [`PRD.md`](./PRD.md) **§1.1–§1.2**）。
- **单一数据源**：**Supabase（PostgreSQL）** 存放用户全部学习数据；无论自 **`/import`、插件或未来移动端**，最终写入**同一账号**下的：
  - **`profiles`**
  - **`articles`**
  - **`vocabulary_items`**、**`vocabulary_senses`**、**`vocabulary_occurrences`**
  - **`grammar_items`**、**`grammar_occurrences`**
- **租户键**：业务表均须带 **`user_id`**（**`profiles`** 以 **`id`** 对齐 **`auth.uid()`**），与 **RLS** 一致；实现**跨设备同一套词库、语法库与阅读历史**。
- **原则**：导入路径多样，**学习数据只有一套**；插件不单独建库。商业化与路线见 **PRD §1.3、§1.4**。

---

## Phase 2.1 Next.js 与 Supabase client

- **依赖**：`@supabase/supabase-js`。
- **环境变量**（见仓库根目录 [`.env.example`](../.env.example)）：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`。开发者需自行创建 **`.env.local`** 并填入 Supabase **Project Settings → API** 中的 **Project URL** 与 **anon public key**（勿将真实 key 提交到 Git）。
- **客户端封装**：[`src/lib/supabase/client.ts`](../src/lib/supabase/client.ts) 使用 `createClient`；变量缺失时抛出带说明的 `Error`（区分 URL missing / key missing 等）。
- **Next.js 注意**：`NEXT_PUBLIC_*` 必须在代码中对 `process.env.NEXT_PUBLIC_SUPABASE_URL` 等做**静态**属性访问，**禁止**使用 `process.env[name]` 动态下标，否则客户端 bundle 无法内联，运行时会误判为未配置。
- **连接测试页**：[`/settings/supabase-test`](../src/app/settings/supabase-test/page.tsx) 通过 **`readPublicSupabaseEnv()`** 与创建 client **共用**同一套读取逻辑；点击「测试 Supabase 连接」对 **`profiles`** 执行 **`select ... limit 1`**，**不插入、不更新、不删除**。
- **`profiles` 与 RLS**：`schema.sql` 中为 **`profiles` 启用了 Row Level Security**，策略要求 **`id = auth.uid()`** 等；**未登录**（匿名 `anon` JWT）下 **`SELECT` 被拒绝** 时，PostgREST 常返回 **`42501`** 或 **`permission denied`**——这表示**项目与客户端已连通**，**不是** URL/密钥层面的「连接失败」。**不要**为此关闭 RLS 或改用 **service_role** 暴露给浏览器。接入 **Supabase Auth** 后，用户仅能读取**自己的** `profiles` 行（`id` 与 `auth.uid()` 一致）。
- **RLS 与表级 GRANT（重要）**：二者同时需要。**RLS** 决定「哪些行可见」；**`GRANT … ON public.profiles TO authenticated`** 决定 **`authenticated` 角色能否对表执行 SELECT/INSERT/UPDATE/DELETE**。若仅有 policy 而无 GRANT，已登录用户仍可能收到 **`permission denied for table profiles`（42501）**。本仓库在 **`schema.sql`** 与 [`supabase/fixes/002_profiles_grants_fix.sql`](../supabase/fixes/002_profiles_grants_fix.sql) 中为 **`authenticated`** 授予 **`profiles`** 的 **SELECT, INSERT, UPDATE, DELETE**。**不向 `anon` 授予 `profiles`**：个人资料仅允许登录用户访问；**`/settings/supabase-test`** 在未登录时对 `profiles` 的探测仍预期失败（与 RLS 共同作用）。
- **后续**：在应用中完成 **登录与会话** 后，可用同一测试页或业务页验证「已登录用户可读自身 profile」。**截至 2026-05-02**：**Phase 2.2** 已在 **`/account`** 上验证 **Auth + profile 读取**（见上「Phase 2.2 验证状态」）。

### Supabase 平台变更：Data API 与 `public` 表的显式 `GRANT`（2026）

Supabase 会收紧 **PostgREST / Data API** 对 **`public` schema** 内表的默认暴露策略：**仅当显式授权后**，`supabase-js`、REST、GraphQL 才能访问对应表；缺授权时常见 **`42501`（permission denied）**，控制台或错误 hint 可能提示需 **`GRANT … TO anon` / `authenticated` / `service_role`**。

- **时间表（以 Supabase 官方邮件与项目控制台为准）**：**新建 Supabase 项目**自约 **2026-05-30** 起，新建表默认不再自动暴露给 Data API；**已有项目**自约 **2026-10-30** 起统一同一规则。**变更前已存在且已带 `GRANT` 的表**一般会保留现有权限；风险主要在 **此后新创建的表**若迁移脚本里只有 `CREATE TABLE` 而无 **`GRANT`**。
- **本仓库约定**：任意新增 **`public`** 业务表时，在**同一迁移或 SQL 文件**中补齐：
  1. **`ALTER TABLE … ENABLE ROW LEVEL SECURITY`** 与 **`CREATE POLICY`**（按 `user_id = auth.uid()` 等策略）；
  2. **`GRANT SELECT, INSERT, UPDATE, DELETE ON public.<表名> TO authenticated`**（按业务需要增减动词；**勿**向前端暴露 **`service_role`**）；
  3. 若确需匿名访问再 **`GRANT SELECT … TO anon`**（本项目的 **`profiles` / `articles` / 词汇语法主表`** 不向 **`anon`** 开放写或读个人数据，见上文各节）。
- **参考**：根目录 [`supabase/schema.sql`](../supabase/schema.sql) 与各 [`supabase/fixes/*_grants*.sql`](../supabase/fixes/) 已体现「建表 + RLS + GRANT」模式；新建 fix 时请沿用 **可重复执行**（`IF NOT EXISTS` / `DROP POLICY IF EXISTS`）写法。

---

## Phase 2.2 Supabase Auth（邮箱密码）

- **页面**：**`/login`**（`signInWithPassword`）、**`/signup`**（`signUp`）、**`/account`**（会话信息、`profiles` **自动创建或读取**，仅 **anon** + 用户 JWT，遵守 RLS）。
- **主导航**：**`AuthNav`**（`src/components/AuthNav.tsx`）根据会话显示 **登录 / 注册 / 账户** 或 **账户 / 退出**。
- **Profile 引导**：**`ensureUserProfile`**（`src/lib/supabase/auth.ts`）流程为：`select("*").eq("id", user.id).maybeSingle()`；若已有行则返回 **profile 已读取**；若无则 **`upsert`**（`onConflict: "id"`，字段含 `id`、`email` 及默认 B1 / B1-B2 / zh / medium / `auto_play_pronunciation_on_click: false`），再 **`select` 单行** 用于展示 **profile 已创建**。**upsert** 在 PostgreSQL 中对应 `INSERT … ON CONFLICT DO UPDATE`，需 RLS 同时允许本人 **insert** 与 **update**（见 `schema.sql` 与下方修复脚本）。
- **错误展示**：**`/account`** 通过 **`formatSupabaseOrUnknownError`**（`src/lib/supabase/errors.ts`）展开 PostgREST 的 **message / code / details / hint**，避免界面出现 **`[object Object]`**。
- **RLS 修复脚本（可重复执行）**：若远程项目的 **`profiles` 策略** 缺失或与 upsert 不兼容，在 Supabase **SQL Editor** 中执行 [`supabase/fixes/001_profiles_rls_fix.sql`](../supabase/fixes/001_profiles_rls_fix.sql)（`DROP POLICY IF EXISTS` 后重建 **select / insert / update / delete**）。**不关闭 RLS**，不使用 **service_role**。
- **表权限修复（可重复执行）**：若已登录仍报 **`permission denied for table profiles`** 且 hint 指向 **`GRANT … TO authenticated`**，请执行 [`supabase/fixes/002_profiles_grants_fix.sql`](../supabase/fixes/002_profiles_grants_fix.sql)。
- **邮箱确认（Email confirmation）**：
  - Supabase 默认可能在 **Authentication → Providers → Email** 中开启 **「Confirm email」**。开启时 **`signUp` 成功但无 `session`**，用户需先点击邮件链接，再用 **`/login`** 登录；若注册后**无法立即登录**，请先检查该设置。
  - **MVP / 本地调试** 可暂时**关闭**邮箱确认，便于快速测试（生产环境请再评估安全策略）。
  - **`/signup`** 在无 `session` 返回时会提示用户检查邮箱或前往登录页。

### Phase 2.2 验证状态（2026-05-02，人工联调）

以下已在实际环境中**验证通过**（与 RLS + GRANT 脚本配套；**未**在本次变更中修改应用页面逻辑）：

1. **Supabase Auth**：用户可成功登录。
2. **`profiles` RLS**：与 **`001_profiles_rls_fix.sql`** 预期一致，已登录用户仅可访问 **`id = auth.uid()`** 的行。
3. **`authenticated` 表权限**：**`002_profiles_grants_fix.sql`** 的 **`GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated`** 已满足 PostgREST 对登录 JWT 的基础表权限要求。
4. **`/account`**：可展示 **session**、**email**、**user id**，并成功 **SELECT** 当前用户 **profile**。

**验证时观测到的 profile 字段示例**：`self_selected_level` = B1；`estimated_reading_level` = B1-B2；`explanation_language` = zh；`explanation_intensity` = medium；`auto_play_pronunciation_on_click` = false。

**Phase 2.3 起**：**`/import`** 已可写入 **`articles`**：前端 **`cleaned_text`**（含副标题、**作者署名**（去重后）、发布时间行与正文）映射到 **`articles.original_text`**；**`raw_pasted_text`** 仅浏览器侧，**不入库**；**无 `published_at` / `subtitle` / `author` 列**（时间、副标题、作者均留在 **`original_text`** 内）。**`/articles/[id]`**、**`/dashboard`** 已读 **`articles`**。**Phase 2.5 起**阅读页手动词/语已写 **`vocabulary_*` / `grammar_*`**；**OpenAI**、**Vercel**、**Chrome 插件 MVP** 仍待办。

---

## Phase 2.3 `articles` 与应用

- **RLS**：`schema.sql` 中 **`articles`** 策略为 **`user_id = auth.uid()`** 的 **select / insert / update / delete**。若远程库 policy 不一致，可重复执行 [`supabase/fixes/004_articles_rls_fix.sql`](../supabase/fixes/004_articles_rls_fix.sql)。
- **表级 GRANT**：与 **`profiles`** 相同，**`authenticated`** 须对 **`public.articles`** 具备 **SELECT, INSERT, UPDATE, DELETE**，否则会出现 **`permission denied for table articles`（42501）**。**`schema.sql`** 已含 **`GRANT … TO authenticated`**；已建库可执行 [`supabase/fixes/003_articles_grants_fix.sql`](../supabase/fixes/003_articles_grants_fix.sql)。**不向 `anon` 授予 `articles`**。
- **外键**：**`articles.user_id`** 引用 **`profiles.id`**；首次保存前应用层应 **`ensureUserProfile`**，保证存在 **profile** 行。
- **导入正文**：**`/import`** 中 **`raw_pasted_text` → `parseArticleFromRawInput`**（结构：标题建议、副标题、**作者署名**（全文去重后写入前部）、发布时间行）→ **`cleanArticleText`** 净化正文；持久化 **`articles.original_text = cleaned_text`**（顺序一般为 **副标题 → 作者 → 发布时间行 → 正文**，并避免与 **`articles.title`** 重复的首行）。**`articles.title`** 为用户输入（空则自动填识别标题）。**不修改 schema**，不增加 **`published_at`** / **`author`**。实现见 [`src/lib/text/parseArticleFromRaw.ts`](../src/lib/text/parseArticleFromRaw.ts)、[`src/lib/text/cleanArticleText.ts`](../src/lib/text/cleanArticleText.ts)。
- **Phase 3.4（文章级 AI 摘要与阅读问题）**：**`articles.summary_zh`**、**`summary_de_simple`**、**`articles.reading_questions`**（**`jsonb`**，字符串数组，默认 **`[]`**）在阅读页**保存真实 AI 预览**时一并 **`UPDATE`**；词汇/语法仍写入 **`vocabulary_*` / `grammar_*`**。**已建库若缺列**（如 **`42703` `reading_questions` does not exist**）：在 SQL Editor 执行 **[`supabase/fixes/007_article_analysis_fields.sql`](../supabase/fixes/007_article_analysis_fields.sql)**（**`ADD COLUMN IF NOT EXISTS`**，不删表、不改 RLS）。旧文件 **`007_articles_reading_questions.sql`** 已合并说明至此。**`schema.sql`** 已含三列定义。
- **Phase 3.4 验证状态（迁移后）**：三列齐全则阅读页 **`select`/`update`** 不再因 **`reading_questions`** 缺失报错；摘要与阅读问题可保存并在刷新后自 **`articles`** 读回；词汇/语法表与 RLS 未随本阶段变更。详细验收表见 **`DEVELOPMENT_LOG.md`**。
- **Phase 3.4 学习闭环（数据面摘要）**：**`articles`** 三字段仅服务文章页摘要/阅读问题 Tab；词汇/语法持久化仍走 **`vocabulary_*` / `grammar_*`**（与 **005/006**、**RLS** 配套）。手动词条 **AI** 补充解释走 **`/api/enrich-vocabulary`**、**`/api/enrich-grammar`**，不改变本文件表结构。文章页高亮、occurrence、掌握状态字段仍以 **`vocabulary_*` / `grammar_*`** 与 occurrences 为准。完整交互验收清单见 **`DEVELOPMENT_LOG.md`**「**Phase 3.4 学习闭环验证与状态**」。
- **仍未完成**：**OpenAI** 写 **`topic` 等**其余列；**`/articles/[id]`** 上迁移 **Mock 高亮**（课文 AI 标注）；**Vercel**；**Chrome 插件 MVP**。

### Phase 2.5 词汇 / 语法：表权限与前端 id

- **42501 `permission denied for table …（vocabulary_* / grammar_*）`**：须同时具备 **RLS policy** 与 **`GRANT … TO authenticated`**。请在 Supabase **SQL Editor**（以有足够权限的角色）执行：
  1. [`supabase/fixes/005_vocabulary_grants_fix.sql`](../supabase/fixes/005_vocabulary_grants_fix.sql) — **`vocabulary_items` / `vocabulary_senses` / `vocabulary_occurrences`**
  2. [`supabase/fixes/006_grammar_grants_fix.sql`](../supabase/fixes/006_grammar_grants_fix.sql) — **`grammar_items` / `grammar_occurrences`**
- 两文件均为 **可重复执行**（`DROP POLICY IF EXISTS` + `CREATE POLICY`），策略均为 **`user_id = auth.uid()`**；**不向 `anon` 授权**；**不关闭 RLS**。**`schema.sql`** 末尾已同步追加同名 **GRANT**（新建库可直接具备表权限）。
- **应用层**：阅读页 **`ArticleVocabItem.id` / `ArticleGrammarItem.id`** 为 **UI 键**（如 **`v-item-…`**、**`g-item-…`** 或 **`vocab-{uuid}`**）；**`dbItemId`** 为 Supabase 表主键 **UUID**；义项 **`VocabSense.dbSenseId`** 对应 **`vocabulary_senses.id`**。**掌握 / 忽略 / 恢复** 等 **`UPDATE vocabulary_items` / `grammar_items`** 必须使用 **`dbItemId`**，禁止把临时 UI id 或 **`sense-…`** 临时 id 当作 uuid 传入 PostgREST。
- **表用途归纳**：**词汇** — **`vocabulary_items`**（词条聚合）、**`vocabulary_senses`**（义项）、**`vocabulary_occurrences`**（该词在**某篇文章**中的每次出现）；**语法** — **`grammar_items`**、**`grammar_occurrences`**。出现记录通过 **`user_id` + `article_id`** 归属用户并绑定文章；**items / senses** 行亦带 **`user_id`**，与 **RLS** 一致。**「今日」视图进阶语义**（主词条首次创建 vs 当日新 occurrence：NEW / REPEAT）见 **[`docs/PRD.md`](./PRD.md) §12.5**。
- **权限与安全**：**RLS** 保持开启；**`authenticated`** 经 **`schema.sql`** 与 **005/006** 获得所需 **DML**；浏览器客户端仅使用 **anon public key**（用户 JWT），**禁止**将 **service_role** 放入前端。

---

## Supabase 执行状态

- **远程 Supabase 项目** 已创建，且仓库中的 **`supabase/schema.sql` 已在该项目中成功执行**。
- Supabase **Table Editor** 中当前可见 **7 张表**：`profiles`、`articles`、`vocabulary_items`、`vocabulary_senses`、`vocabulary_occurrences`、`grammar_items`、`grammar_occurrences`。
- **重复执行** 当前仓库内的原始 `schema.sql` 时，可能出现 **`relation "profiles" already exists`**（或针对其他对象的同类错误），原因是 **DDL 已应用过**，属预期现象，不代表首次建表失败。
- **建议**：后续将迁移维护改为 **idempotent** 写法（例如 `CREATE TABLE IF NOT EXISTS`、`DROP POLICY IF EXISTS` + 再 `CREATE POLICY`，或使用 Supabase **migrations** 只向前增量），避免在已存在对象上重复执行整份脚本时报错；**当前仓库文件仍以首次建库用完整脚本为主**。

---

## 1. 设计目标

- **多租户隔离**：所有业务数据按 **`user_id`（或 `profiles.id`）** 归属到登录用户，与 **Row Level Security (RLS)** 一致；**Web / 插件 / 未来手机入口** 共用同一 schema（见上文「统一云端与多入口」）。
- **长期学习档案**：总词库、总语法库跨文章累积；**出现记录（occurrences）** 保留「在何处、以何表面形式出现」，便于复习与统计。
- **与产品一致**：字段对齐 PRD 中的阅读辅助、掌握状态、手动补充与 AI  enrichment 等概念。
- **可演进**：`text` 型枚举类字段（如 `mastery_status`、`source`）便于 MVP 快速迭代，后续可改为枚举类型或校验约束。

---

## 2. 表概览

| 表名 | 作用 |
|------|------|
| **profiles** | 与 `auth.users` 一对一的公开资料与阅读偏好（水平、解释语言、发音开关等）。 |
| **articles** | 用户导入/分析过的文章：原文、摘要、分析时的水平、主题等。 |
| **vocabulary_items** | 用户级「词条」聚合行：同一 `normalized_key + part_of_speech` 只保留一条，累计 `encounter_count` 等。 |
| **vocabulary_senses** | 同一词条下的多个义项（多义词、不同语境释义）。 |
| **vocabulary_occurrences** | 某词在**某篇文章**中的一次具体出现：偏移、句子、可选绑定 sense、来源与优先级等。 |
| **grammar_items** | 用户级语法类型聚合行：如 `grammar_key = passive_present` 与 `normalized_key` 区分变体。 |
| **grammar_occurrences** | 某语法点在**某篇文章**中的一次实例：选中文本、偏移、语境解释等。 |

---

## 3. 为何 vocabulary_items 与 vocabulary_occurrences 分开？

- **items** 表示「学习者词典里的一条词目」，是**跨文章**的稳定实体，承载 `mastery_status`、`lemma`、默认释义、累计遇见次数等。
- **`lemma` 与 `display_word`**：`lemma` 宜存**词典形**（名词常含 **der/die/das** 等冠词线索；动词多为不定式）；`display_word` 可存**本篇典型写法**或句中表面形式。持久化时**不得**用 `display_word` 覆盖已给出的 `lemma`（应用层 `persistManualVocabularyItem` 已按此约束写入）。
- **`gender`**：存 AI 输出的名词语法性 **`m` / `f` / `n` / `unclear`**（与 JSON `grammatical_gender` 对齐）；非名词或不适用时为 **NULL**。阅读页展示为中文「阳性（der）」等。
- **occurrences** 表示「这个词在这篇文章里出现了这一次」，需要 **article_id**、**start_offset / end_offset**（或 **fallback_match_text**）、**sentence** 等**定位与语境**信息。
- 分开后：删文章可 **cascade** 删除该文所有 occurrences，而不误删整条词目；词目上的统计可通过触发器或应用层汇总 `encounter_count` / `last_seen_at`（当前 schema 预留字段，汇总策略可在接入时实现）。

---

## 4. 为何需要 vocabulary_senses（多义词）？

- 同一 `lemma` / `display_word` 在不同上下文可能有不同中文释义与德语简释。
- **vocabulary_items** 可存「默认/主义项」或聚合展示字段；**vocabulary_senses** 存多条结构化义项（`domain`、`example_sentence` 等）。
- **vocabulary_occurrences** 通过可选的 **vocabulary_sense_id** 指向本次出现对应的义项；删除 sense 时 occurrence 上外键为 **ON DELETE SET NULL**，避免丢失出现记录。

---

## 5. 为何 grammar_items 与 grammar_occurrences 分开？

- 与词汇对称：**grammar_items** 是用户长期语法档案（掌握状态、稳定 `grammar_key`、说明文案）；**grammar_occurrences** 绑定 **article_id** 与文中位置/选段。
- 便于统计「一段时间内某类结构出现多少次」、复习时回到原文语境。

---

## 6. 词汇合并规则

唯一约束：**`(user_id, normalized_key, part_of_speech)`**

- `normalized_key` 由应用层规范化（如小写、合并空白），与 Mock 中 `normalizeTextKey` 思路一致。
- **part_of_speech** 参与唯一性，避免名词与动词等形式相同却应分条的情况；schema 中默认 `''`，应用层应写入明确词性或占位。
- 插入前应用层应 **upsert** 或先查再更新 `encounter_count` / `last_seen_at`。

---

## 7. 语法合并规则

唯一约束：**`(user_id, grammar_key, normalized_key)`**

- `grammar_key`：产品内稳定键（如 `passive_present`、`damit_final`）。
- `normalized_key`：同一语法类型下的表面形式或子类规范化（如不同从句片段、用户标记文本的规范形式），避免重复建条。

---

## 8. Row Level Security（RLS）说明

- 所有表均 **ENABLE ROW LEVEL SECURITY**。
- **profiles**：仅 **`id = auth.uid()`** 的行可读、写、删、插（插入时须 `id` 与当前用户一致）。
- **其余表**：所有策略以 **`user_id = auth.uid()`** 约束 SELECT / INSERT / UPDATE / DELETE；`WITH CHECK` 与 `USING` 一致，防止改 `user_id` 越权。
- **服务端**：若后续使用 **service role** 绕过 RLS 做批任务，须在服务端严格校验，**不得**暴露给浏览器。

---

## 9. 索引与 updated_at

- 索引见 `schema.sql` 注释区：按 **用户 + 时间/键/掌握状态/文章** 等常见查询列组合。
- **profiles、articles、vocabulary_items、vocabulary_senses、grammar_items** 在 **UPDATE** 时由触发器 **`set_updated_at`** 自动刷新 **updated_at**。occurrence 表仅 **created_at**（事件记录，一般不更新）。

---

## 10. 时间字段与学习进度（设计约定）

与 [`PRD.md`](./PRD.md) **§12** 对齐。**当前仓库 `schema.sql`** 已含 **`articles` / `vocabulary_items` / `grammar_items`** 的 **`created_at`、`updated_at`**，以及 **items** 的 **`last_seen_at`**（可空，由应用层在遇见时更新）；**occurrence** 表含 **`created_at`**。**不强制**在本阶段为下列「规划列」执行迁移；接入功能时再增量 DDL。

### 10.1 文章（articles）

| 字段 | schema 现状 | 含义 |
|------|-------------|------|
| **summary_zh** / **summary_de_simple** | 已有（可空） | 真实 AI 保存后的中文摘要、简单德语摘要。 |
| **reading_questions** | Phase 3.4 起已有（**`jsonb`**，默认 **`[]`**） | 真实 AI 保存后的阅读问题列表（字符串数组）。 |
| **created_at** | 已有 | 用户保存/导入文章时间。 |
| **updated_at** | 已有 | 记录最后修改时间。 |
| **finished_at** | 规划新增 | 用户标记读完时间。 |
| **read_status** | 规划新增 | **saved** \| **reading** \| **finished** \| **archived**。 |

### 10.2 词汇（vocabulary_items）

| 字段 | schema 现状 | 含义 |
|------|-------------|------|
| **created_at** | 已有 | 首次进入总词库。 |
| **updated_at** | 已有 | 词条最后修改。 |
| **last_seen_at** | 已有（可空） | 最近在文章中遇见该词。 |
| **mastered_at** | 规划新增 | 标为 **mastered** 的时间。 |
| **ignored_at** | 规划新增 | 标为 **ignored** 的时间。 |

### 10.3 语法（grammar_items）

| 字段 | schema 现状 | 含义 |
|------|-------------|------|
| **created_at** | 已有 | 首次进入总语法库。 |
| **updated_at** | 已有 | 语法项最后修改。 |
| **last_seen_at** | 已有（可空） | 最近在文章中遇见。 |
| **mastered_at** | 规划新增 | 标为 **mastered** 的时间。 |
| **ignored_at** | 规划新增 | 标为 **ignored** 的时间。 |

### 10.4 出现记录（vocabulary_occurrences / grammar_occurrences）

- **`created_at`**（已有）：该词 / 该语法在**该篇文章中的这一次出现**的记录时间。
- **关系**：一个 **item** 多条 **occurrences**（跨文章、跨位置）。

### 10.5 学习价值（查询与产品）

支撑：本周新增词汇、本月高频语法、反复出现未掌握词、**mastered** 少解释、**ignored** 少展示、按阅读历史调节解释强度等（实现见应用层与后续 **OpenAI** 流程）。

### 10.6 后续迁移（示例列）

可择机 **`ALTER TABLE`** 增加：**`articles.read_status`**、**`articles.finished_at`**、**`vocabulary_items.mastered_at`**、**`vocabulary_items.ignored_at`**、**`grammar_items.mastered_at`**、**`grammar_items.ignored_at`**（类型建议 **`text` 或枚举 + `timestamptz`**，与 PRD 一致）。

### 10.7 多语言与 `language` / `target_language` 字段（规划，未改 schema）

与 [`PRD.md`](./PRD.md) **§1.5** 对齐：未来产品可扩展为**多语言 Reading Coach**，需在数据中区分**学习内容语言**与**用户目标语言**。

**当前阶段：请勿修改 `supabase/schema.sql`。** 以下为后续迭代时可考虑的字段方向（实施时需配套迁移、默认值、索引与 RLS 评估）：

| 规划字段 | 说明 |
|----------|------|
| **`articles.language`** | 文章正文语言（如 `de`、`en`）。 |
| **`vocabulary_items.language`** | 词条所属语言。 |
| **`grammar_items.language`** | 语法项所属语言。 |
| **`profiles.target_language`** | 用户当前主攻的学习语言（或与「账号设置」合并设计）。 |

德语 MVP 稳定并完成词汇 / 语法持久化与 AI 管线后，再评估多语言数据模型与迁移方案。

---

## 11. 后续接入 Supabase 的步骤（建议）

1. 在 [Supabase](https://supabase.com) 创建项目，记录 **Project URL** 与 **anon / service_role** key（勿提交到公开仓库）。（**本项目：建库与执行 schema 已完成**，进入客户端与 Auth 配置阶段。）
2. 若尚未执行：在 **SQL Editor** 中粘贴并执行 **`supabase/schema.sql`**（或在 CI 中用 CLI `db push` / migration，按团队规范）。**已执行过的环境请勿重复跑同一份非幂等脚本**，见上文「Supabase 执行状态」。
3. 配置 **Auth**（邮箱/第三方）；用 **Database Webhook 或 Edge Function** 在 `auth.users` 插入时创建 **profiles** 行（`id = new.id`），否则需在应用首次登录时 **insert profile**（需满足 RLS）。
4. 在 Next.js 中安装 **`@supabase/supabase-js`**（及可选 **`@supabase/ssr`**），用 **anon key + 用户 JWT** 访问数据库。
5. 将 Mock 数据读写逐步替换为 Supabase 查询；**总词库/总语法** 以 **vocabulary_items / grammar_items** 为准，阅读页以 **occurrences** 渲染高亮。

---

## 12. 相关文档

- 产品需求与 Phase 路线：[`PRD.md`](./PRD.md)
- SQL 单一来源：[`../supabase/schema.sql`](../supabase/schema.sql)
