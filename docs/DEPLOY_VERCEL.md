# 部署到 Vercel（German Reading Coach）

本文档说明如何将本仓库部署到 [Vercel](https://vercel.com/)（推荐方式）。应用为 **Next.js App Router**，无需静态导出。

## 前置条件

- GitHub / GitLab / Bitbucket 仓库（推荐），或本地用 **Vercel CLI** 直接上传。
- Vercel 账号（可用 GitHub 登录）。
- 已在 Supabase 跑过 **`schema.sql`** 与相关 **`fixes`**（与个人本地一致）。

## 一、推荐：Dashboard 连接 Git 仓库

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard) → **Add New…** → **Project**。
2. **Import** 你的 Git 仓库；Framework Preset 选 **Next.js**（通常会自动识别）。
3. **Root Directory**：仓库根目录（默认即可）。
4. **Build & Output**：保持默认 **`npm run build`** / **`.next`**。
5. **Environment Variables**（与本地 **`.env.example`** 对应，**勿**把真实密钥提交到 Git）：

   | Name | 说明 |
   |------|------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key |
   | `OPENAI_API_KEY` | OpenAI API Key（服务端专用） |
   | `ALLOW_INSECURE_IMPORT_TLS` | 可选；仅当生产抓取个别 HTTPS 站点 TLS 失败且网络可信时为 `1`（有风险） |
   | `ALLOW_INSECURE_OPENAI_TLS` | 可选；同上，针对 OpenAI 连接 |

   **说明**：`NODE_ENV` 由 Vercel 自动设置，无需手写。

6. 点击 **Deploy**。首次部署完成后会得到形如 **`https://<project>.vercel.app`** 的预览/生产域名。

## 二、Supabase 生产环境必须改的两处

部署成功后，将 **线上域名** 加入 Supabase：

1. **Authentication → URL Configuration**
   - **Site URL**：填你的正式站点，例如 `https://你的项目.vercel.app`（若先用预览域名也可填预览 URL）。
   - **Redirect URLs**：追加至少：
     - `https://你的域名/auth/recovery`
     - `https://你的域名/**`（若控制台支持通配）或逐条添加 `/login`、`/signup`、`/` 等回调需求路径。

2. 本地清单里的 **`http://localhost:3000/auth/recovery`** 可保留，以便本地调试。

否则登录、邮件重置密码、OAuth 回调可能在生产环境失败。

## 三、CLI 部署（可选）

已在本地安装 Node 时：

```bash
npm install
npx vercel login
npx vercel          # 预览部署
npx vercel --prod   # 生产部署
```

首次会在浏览器完成登录；项目根目录会生成 **`.vercel`**（已在 **`.gitignore`** 中忽略）。CLI 部署同样需在 Dashboard 或 `vercel env pull` 中配置环境变量。

常用脚本（见根目录 **`package.json`**）：

```bash
npm.cmd run vercel       # 预览
npm.cmd run vercel:prod  # 生产
```

若出现 **`unable to verify the first certificate`**（常见于 Windows 代理 / 企业根证书），可改用：

```bash
npm.cmd run vercel:prod:system-ca
```

（为子进程设置 **`NODE_OPTIONS=--use-system-ca`**，需 **Node 20.19+** 或 **22.9+**。）仍失败时请用 **Git 推送到已连接 Vercel 的分支** 或 **§七** GitHub Actions。

## 四、Serverless 限时（链接导入 / AI）

以下 Route 使用了较长的 **`export const maxDuration`**（如 **`/api/import-url`** 最高 **300s**）：

- **Vercel Hobby**：单函数最长执行时间通常 **低于** 300 秒（以 [官方文档](https://vercel.com/docs/functions/serverless-functions/runtimes#max-duration) 为准）。若链接导入在生产仍超时，可考虑升级套餐或缩短抓取场景。
- **Pro / Enterprise**：可按计划配置更高的 **`maxDuration`**（需在 Dashboard → Project → Functions 或计划中确认）。

若暂未升级，仍可正常使用导入；极端长页面可能需在服务端限时内失败并提示用户改用手动粘贴。

## 五、部署后自检

1. 打开线上 **`/`**，确认页面加载。
2. **登录 / 注册**（确认 Redirect URLs 正确）。
3. **`/settings/supabase-test`**：已登录时应能读 `profiles`。
4. **`/import`** 链接导入一篇短文；**`/articles/[id]`** 跑一次真实 AI 预览（需已配置 **`OPENAI_API_KEY`**）。
5. **阅读页词汇卡**：若仍见 **底部「状态」+ 下拉**、标题旁 **静态「学习中」** 徽标、或主标题已带 **der/die/das** 却仍显示 **「名词性：…」**，说明当前浏览器访问的 **Production 构建仍较旧**。请到 Vercel 该项目 **Deployments** 确认最新一条 **Production** 是否刚成功；本地修改后须 **`npm.cmd run vercel:prod`**（或 push 触发 §七 / Dashboard 连 Git），并对线上域名 **硬刷新**（Ctrl+Shift+R）或无痕窗口验证。**仅复制无 `.git` 的项目目录**时，不会自动推送到远程，须用 CLI 部署或先同步到有远程的仓库。

## 六、自定义域名（可选）

在 Vercel 项目 **Settings → Domains** 绑定自有域名，并把该 HTTPS 地址同步到 Supabase **Redirect URLs** 与 **Site URL**。

## 七、GitHub Actions 自动部署 Production（可选）

仓库已提供 **`.github/workflows/vercel-production.yml`**：在 **push 到 `main`** 或 **手动 workflow_dispatch** 时执行 `npm ci` → `npm run build` → **`vercel --prod`**。

1. 在 GitHub 仓库 **Settings → Secrets and variables → Actions** 新建 Secrets：
   - **`VERCEL_TOKEN`**：Vercel → **Account Settings → Tokens** 创建。
   - **`VERCEL_ORG_ID`**、**`VERCEL_PROJECT_ID`**：本地项目根目录执行过 `npx vercel link` 后，查看 **`.vercel/project.json`** 中的 `orgId` 与 `projectId`（该目录已在 **`.gitignore`**，勿提交）。
2. 将代码 **push 到 `main`** 后，在 GitHub **Actions** 页查看运行结果。

若未配置上述 Secrets，可删除该 workflow 或忽略失败步骤，改用最稳妥的 **Dashboard 连接 Git 仓库**（见第一节），由 Vercel 在每次 push 时自动构建部署。
