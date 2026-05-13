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

1. **`DEVELOPMENT_LOG.md`** — 追加或修订与本次任务相关的记录。
2. **`PROJECT_STATUS.md`** — 同步当前版本/状态、未接入项、页面列表、阶段目标等。

若本次任务涉及以下任一类，**还须同步更新 `README.md`**：

- 依赖安装或脚本变更（`package.json`、包管理器）
- 运行方式（`dev` / `build` / 端口、环境要求）
- **应用页面**或路由（`src/app/**`）
- **API**、服务端逻辑、Route Handlers
- **数据库**、迁移、ORM、Supabase 等
- **部署**（Vercel、Docker、CI）
- **环境变量**（`.env.example`、密钥说明、配置项）

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

## 部署（Vercel）

- 完成 **可验收的用户可见功能**（或与线上同步的修复）且 **`npm run build` 通过后**：若当前环境已配置 **Vercel CLI**（`vercel login`、项目已 `vercel link`），助手应执行 **`npm.cmd run vercel:prod`** 更新 Production；若遇 **TLS / 证书** 错误可改用 **`npm.cmd run vercel:prod:system-ca`**；若 CLI 未登录或命令仍失败，须在 **`DEVELOPMENT_LOG.md`** 中写明「待维护者部署」，并提醒通过 **Git push（仓库已连 Vercel）** 或配置 **`.github/workflows/vercel-production.yml`** 的 Secrets（见 **`docs/DEPLOY_VERCEL.md` §七**）实现自动部署。
- 长期推荐：在 Vercel Dashboard **Import Git 仓库**，使默认分支 **push 即自动部署**，避免本地与线上版本漂移。

## 功能范围约束

- **除非任务明确要求**，不得改动现有页面/组件的**用户可见行为**（路由、交互、文案意图、Mock 数据语义等）。重构需与任务目标一致且可审查。

## 相关文件

- [`docs/PRD.md`](./docs/PRD.md) — 产品需求文档（PRD）
- [`DEVELOPMENT_LOG.md`](./DEVELOPMENT_LOG.md) — 详细开发记录
- [`PROJECT_STATUS.md`](./PROJECT_STATUS.md) — 高层状态一览
- [`README.md`](./README.md) — 用户与贡献者入口
