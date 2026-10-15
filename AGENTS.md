<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# German Reading Coach — 自动化助手 / Agent 开发规则

以下规则适用于在本仓库完成**任何**开发任务（含文档、配置、依赖、功能）的助手或贡献者。

## 需求与产品文档

- 正式产品需求见 **[`docs/PRD.md`](./docs/PRD.md)**。
- **每当产品需求发生变化时**，必须同步更新 **`docs/PRD.md`**（保持 PRD 为单一事实来源之一）。

## 任务结束前的文档义务

每完成一次开发任务后，**必须**更新：

1. **`DEVELOPMENT_LOG.md`** — 在「更新记录」最上方追加本次任务记录（旧记录已归档到 `docs/archive/`，无需阅读归档文件）。
2. **`PROJECT_STATUS.md`** — 同步当前版本/状态、未接入项、页面列表、阶段目标等。

若本次任务涉及以下任一类，**还须同步更新 `README.md`**：

- 依赖安装或脚本变更（`package.json`、包管理器）
- 运行方式（`dev` / `build` / 端口、环境要求）
- **应用页面**或路由（`src/app/**`）
- **API**、服务端逻辑、Route Handlers
- **数据库**、迁移、ORM、Supabase 等
- **部署**（Vercel、Docker、CI）
- **环境变量**（`.env.example`、密钥说明、配置项）

## 面向使用者的说明

- 改动**用户能感知的规则**（推荐逻辑、学习状态含义、复习、长文、导入方式等）时，除开发文档外，**必须同步更新软件内的使用说明 `src/app/help/page.tsx`** 和 `docs/USER_MANUAL.md`，以及相关页面上的提示文案。

## 每次文档更新须包含

- **本次完成了什么**（可验收的摘要）
- **修改了哪些主要文件**（路径列表即可）
- **当前项目状态**（阶段、是否可运行、主要能力）
- **已知问题**（遗留 bug、技术债、限制）
- **下一步建议**（优先级清晰的后续项）

## 构建校验（强制）

- 每次任务**结束前**必须执行：`npm run build`。
- 若 **build 失败**：先修复代码/配置错误，**再次** `npm run build` 直至通过，**再**提交文档更新。
- 文档-only 任务若未改代码，仍应运行 `npm run build` 以确认仓库健康（除非维护者明确豁免；默认不豁免）。

## 部署（Vercel）与提交（2026-10-15 起）

- **开始前先同步**：每次开始任务前先 `git pull origin main`，确保在最新代码上修改（维护者可能同时用 Cursor、Claude 等多个工具或多台设备改代码）。
- **改完即提交并推送到 GitHub**：每完成一个任务（`npm test` 与 `npm run build` 通过后），立即 `git add` → `git commit`（中文说明本次改了什么）→ `git push origin main`。**不要把改动长期留在本机未提交**——2026-05 曾因本机改动 5 个月未提交，导致本机、GitHub、线上三处版本不一致。
- **部署只走 Git**：Vercel 已连接 GitHub，推送 / 合并到 `main` 即自动部署 Production；Vercel 构建使用 `vercel-build`（先跑单元测试，失败不上线）。
- **禁止从本机执行 `npm.cmd run vercel:prod` / `vercel --prod`**：它上传本机文件（含未提交改动），会让线上与 GitHub 不一致。仅在维护者明确要求的紧急情况下使用，事后须立刻把同样的改动提交到 GitHub。
- 较大或有风险的改动可先推到新分支、开 PR，确认后再合并到 `main`。
- 回滚：Vercel → Deployments → 上一条 Production → ⋯ → Instant Rollback（详见 `docs/DEPLOY_VERCEL.md` §八）。

## 功能范围约束

- **除非任务明确要求**，不得改动现有页面/组件的**用户可见行为**（路由、交互、文案意图、Mock 数据语义等）。重构需与任务目标一致且可审查。
- **回归防护（强制自检）**：每次改代码前默认定语——**千万不要随便动以前已经做好、验收过的功能**（尤其阅读页：点按高亮打开详情、拖选加入词库/语法、移动端勿弹系统「在 Google 中搜索」等）。新功能应增量实现；若必须动到旧逻辑，须在同一任务内用 `npm test` / `npm run build` 验证，并在 `DEVELOPMENT_LOG.md` 写明影响面。

## 相关文件

- [`docs/PRD.md`](./docs/PRD.md) — 产品需求文档（PRD）
- [`DEVELOPMENT_LOG.md`](./DEVELOPMENT_LOG.md) — 详细开发记录
- [`PROJECT_STATUS.md`](./PROJECT_STATUS.md) — 高层状态一览
- [`README.md`](./README.md) — 用户与贡献者入口
