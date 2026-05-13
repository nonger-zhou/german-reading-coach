# Claude / Cursor — 本仓库协作说明

本文件与 [`AGENTS.md`](./AGENTS.md) 配套：**请先阅读 `AGENTS.md` 全文**（含 Next.js 版本提示与项目规则）。以下为与本项目相关的**核心开发规则摘要**，详细以 `AGENTS.md` 为准。

## 需求变更

- 正式需求见 **[`docs/PRD.md`](./docs/PRD.md)**。
- **产品需求每次发生变化时**，必须同步更新 **`docs/PRD.md`**。

## 任务结束后必须更新

1. **`DEVELOPMENT_LOG.md`**
2. **`PROJECT_STATUS.md`**

若任务涉及 **安装依赖、运行方式、页面、API、数据库、部署、环境变量**，还须更新 **`README.md`**。

## 每次文档更新须写清

- 本次完成了什么  
- 修改了哪些主要文件  
- 当前项目状态  
- 已知问题  
- 下一步建议  

## 构建

任务结束前必须运行 **`npm run build`**。若失败，**先修复错误**，再次 build 通过后，再更新文档。

## 部署（与线上同步）

用户可见功能在 build 通过后：若本机已 **`vercel login`** 且项目已 link，应执行 **`npm.cmd run vercel:prod`**；若遇 **TLS / 证书** 错误可改用 **`npm.cmd run vercel:prod:system-ca`**；否则在开发日志中注明待部署，并指向 **`docs/DEPLOY_VERCEL.md`**（Git 自动部署或 GitHub Actions）。

## 不要擅自改动产品行为

除非任务明确要求，**不要**改变现有页面/组件的用户可见功能与交互。

---

完整规则、Next.js 注意事项与文件索引见 [`AGENTS.md`](./AGENTS.md)。
