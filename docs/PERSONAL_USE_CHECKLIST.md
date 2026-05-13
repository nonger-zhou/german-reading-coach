# German Reading Coach 个人使用检查清单

本文档用于把项目先稳定成“自己每天可用”的版本。当前目标不是开放注册、收费或插件上架，而是确保本地 Web App + Supabase + OpenAI 能完整跑通个人阅读流程。

## 1. 本地环境

- Node.js 与 npm 可用。
- 已在项目根目录执行过：

```bash
npm install
```

- 本地开发启动（**推荐**，避免上一次没关掉的开发服务仍占用 3000 端口、导致你打开旧页面）：

```bash
npm run dev:clean
```

若终端提示 **PowerShell 无法运行 npm.ps1**（`running scripts is disabled`），请改用：

```bash
npm.cmd run dev:clean
```

或只对当前用户放宽执行策略（可选）：在 PowerShell 中执行  
`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`  
之后可继续用 `npm run ...`。

- 浏览器请打开**终端里 `Local` 那一行**的地址（一般是 `http://localhost:3000`）。若未用 `dev:clean` 且 3000 已被占用，Next 可能自动使用 **3001**——此时必须打开 **`http://localhost:3001`**，不要仍盯着 3000，否则会像「功能坏了 / 还是 Mock」其实是旧进程。

## 2. 环境变量

项目根目录需要有 `.env.local`，至少包含：

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...
```

说明：

- `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 来自 Supabase 项目设置。
- `OPENAI_API_KEY` 只在服务端使用，用于真实 AI 分析、补充词汇解释、补充语法解释。
- 不要提交 `.env.local`。

## 3. Supabase SQL

远程 Supabase 项目需要执行：

- `supabase/schema.sql`
- `supabase/fixes/001_profiles_rls_fix.sql`
- `supabase/fixes/002_profiles_grants_fix.sql`
- `supabase/fixes/003_articles_grants_fix.sql`
- `supabase/fixes/004_articles_rls_fix.sql`（如遇文章 RLS 异常再执行）
- `supabase/fixes/005_vocabulary_grants_fix.sql`
- `supabase/fixes/006_grammar_grants_fix.sql`
- `supabase/fixes/007_article_analysis_fields.sql`
- `supabase/fixes/008_learning_item_deep_notes.sql`

执行方式：打开 Supabase SQL Editor，把文件中的 SQL 内容粘贴进去执行。不要只粘贴文件路径。

## 3.1 Supabase Auth 回调地址（忘记密码 / 邮件重置）

在 Supabase Dashboard → **Authentication** → **URL Configuration** → **Redirect URLs** 中，为本地开发至少加入：

```text
http://localhost:3000/auth/recovery
```

（若使用 `127.0.0.1` 访问，需另加对应 origin。）否则邮件里的重置链接可能无法正确回到本站，或出现 `otp_expired` 等错误。

## 4. 连通性检查

1. 打开 `/settings/supabase-test`。
2. 确认 Supabase 连接正常。
3. 打开 `/signup` 或 `/login`，用自己的账号登录。
4. 打开 `/account`，确认能读取或自动创建 profile。

## 5. 日常完整流程

### 导入文章

1. 打开 `/import`。
2. 优先尝试“链接导入”。
3. 如果站点拒绝抓取、需要登录或正文提取不稳定，切换“手动粘贴”。
4. 在外部网页复制正文后，可点击“从剪贴板读取”。
5. 检查「正文」与标题，必要时手动调整。
6. 点击“保存文章”，进入 `/articles/[id]`。

### AI 分析与保存

1. 在文章页点击“AI 分析本文”。
2. 查看 AI 预览中的词汇、语法、摘要和阅读问题。
3. 认为结果可用后点击确认保存。
4. 刷新页面，确认词汇、语法、摘要和阅读问题仍然存在。

### 阅读与学习项

1. 点击文中高亮词汇或语法，确认右侧详情联动。
2. 手动选词或选句，添加为词汇或语法。
3. 对学习项执行：
   - 标为已掌握；
   - 标为暂忽略；
   - 恢复为学习中；
   - 删除本文 occurrence（仅用于误添或重复）。
4. 刷新页面，确认状态仍然保留。

### 深度笔记

1. 在词汇或语法卡点击外部 AI 按钮，复制 Prompt 并打开外部 AI。
2. 只复制外部 AI 的解释内容，不复制原 Prompt。
3. 回到文章页，在“我的深度笔记”中粘贴或点击“从剪贴板读取”。
4. 保存笔记。
5. 刷新页面，确认笔记仍然存在。
6. 打开 `/vocabulary` 或 `/grammar`，确认总库中也能看到深度笔记。

### 总词库与总语法

1. 打开 `/vocabulary`。
2. 确认默认显示“全部”。
3. 测试搜索、状态筛选、等级筛选、本周复盘小卡。
4. 点击来源文章，确认能回到文章页并定位到对应词条。
5. 在总库中切换词汇状态，刷新后确认保留。
6. 对 `/grammar` 重复以上检查。

## 6. 常见问题

- 深度笔记保存提示缺少 `user_deep_note`：执行 `supabase/fixes/008_learning_item_deep_notes.sql`。
- AI 分析提示 `OPENAI_API_KEY 未配置`：检查 `.env.local` 并重启 `npm run dev`。
- 真实 AI 预览报 **Connection error**、**fetch failed**：多为**无法直连** `api.openai.com`（网络或防火墙）。可在 **`.env.local`** 设 **`OPENAI_HTTPS_PROXY=http://127.0.0.1:端口`**（与 Clash / V2 等本地 HTTP 代理端口一致），或设系统 **`HTTPS_PROXY`**；保存后**重启** `npm.cmd run dev:clean`。若含 **unable to verify the first certificate**：`dev` / `dev:clean` 在 **Node 20.19+ / 22.9+** 下会自动使用 **`--use-system-ca`**（终端会打印一行说明）；也可手动 **`NODE_OPTIONS=--use-system-ca`**。仍失败可看完整报错中的 **cause**；可试 **`NODE_EXTRA_CA_CERTS`** 指向企业根证书 PEM，或仅可信网络下设 **`ALLOW_INSECURE_OPENAI_TLS=1`**（见 `.env.example`）。
- 保存文章或词汇/语法遇到权限错误：检查 Supabase fixes `001` 到 `006` 是否已执行。
- 剪贴板读取失败：浏览器可能拒绝权限，改用手动粘贴。
- URL 抓取失败：可能是站点拒绝抓取、登录墙或付费墙，改用手动粘贴或剪贴板读取。
- 发音无声：先在 `/settings` 使用“测试德语发音”和“直接测试 speechSynthesis”排查浏览器语音支持。

## 7. 线上部署（Vercel）

若要把同一套 Supabase 数据接到公网访问，见 **[`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md)**：连接 Git 仓库或 CLI、`NEXT_PUBLIC_*` / `OPENAI_API_KEY` 等环境变量、**务必**把 **Vercel 域名** 写入 Supabase **Site URL** 与 **Redirect URLs**（含 `/auth/recovery`）。部署后用手机浏览器打开线上地址做一次登录与导入 smoke test。

## 8. 个人版暂不做

- 公开注册推广。
- 支付订阅。
- 多用户额度系统。
- Chrome 插件上架。
- PWA / 手机系统分享。
- 总库批量管理和完整复习系统。

这些能力后续可以做，但不阻塞当前个人使用版。
