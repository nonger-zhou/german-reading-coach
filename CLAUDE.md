# Claude / Cursor — 本仓库协作说明

本文件与 [`AGENTS.md`](./AGENTS.md) 配套：**请先阅读 `AGENTS.md` 全文**（含 Next.js 版本提示与项目规则）。以下为与本项目相关的**核心开发规则摘要**，详细以 `AGENTS.md` 为准。

## 需求变更

- 正式需求见 **[`docs/PRD.md`](./docs/PRD.md)**。
- **产品需求每次发生变化时**，必须同步更新 **`docs/PRD.md`**。

## 任务结束后必须更新

1. **`DEVELOPMENT_LOG.md`**（在「更新记录」最上方追加；旧记录在 `docs/archive/`，不必读）
2. **`PROJECT_STATUS.md`**

若改动**用户能感知的规则**（推荐、状态、复习、长文、导入等），还须更新软件内使用说明 **`src/app/help/page.tsx`** 与 **`docs/USER_MANUAL.md`**。

若任务涉及 **安装依赖、运行方式、页面、API、数据库、部署、环境变量**，还须更新 **`README.md`**。

## 每次文档更新须写清

- 本次完成了什么  
- 修改了哪些主要文件  
- 当前项目状态  
- 已知问题  
- 下一步建议  

## 构建

任务结束前必须运行 **`npm run build`**。若失败，**先修复错误**，再次 build 通过后，再更新文档。

## 提交与部署（与线上同步）

- **开始前先同步**：动手改代码前先 `git pull origin main`（可能有别的 AI / 设备刚推过改动）；有冲突先解决再改。
- **改完即提交**：`npm test` + `npm run build` 通过后，立即 commit 并 `git push origin main`；不要把改动留在本机。
- **部署只走 Git**：推送到 `main` 由 Vercel 自动部署（构建前自动跑测试）。**不要**在本机运行 `npm.cmd run vercel:prod`。
- 详见 [`AGENTS.md`](./AGENTS.md)「部署与提交」与 `docs/DEPLOY_VERCEL.md` §八。

## 不要擅自改动产品行为

除非任务明确要求，**不要**改变现有页面/组件的用户可见功能与交互。

---

完整规则、Next.js 注意事项与文件索引见 [`AGENTS.md`](./AGENTS.md)。
