# 中国大陆访问 Supabase（运维记录，2026-11-22，Europe/Zurich）

本文只记录当天已经做过的连通性处理与仍须真人验证的事项。商业化、改名、国内单独部署的讨论仍在 [`BUSINESS_AND_CHINA_NOTES.md`](./BUSINESS_AND_CHINA_NOTES.md)，那些结论没有因为这次代理而改变。

文中没有密钥。`NEXT_PUBLIC_SUPABASE_ANON_KEY` 未改，也不应写入仓库。

## 问题

中国大陆用户注册时浏览器报 **Failed to fetch**。

页面本身在 Vercel 上。注册、登录和读写数据时，浏览器按 `NEXT_PUBLIC_SUPABASE_URL` **直接**请求 `https://htetqagtrdoumntvjksy.supabase.co`。这些请求到不了 Supabase（请求从未到达 Supabase）。

`reading.nonger.com` 在 Cloudflare 的 `nonger.com` 区域里是 **仅 DNS（灰云）** 的 CNAME，目标为 `076dd37bd355c0b3.vercel-dns-017.com`，**不经 Cloudflare 代理**。所以给网站换自有域名，并没有让浏览器去 Supabase 的那段请求改道。

## 做法

在持有 zone `nonger.com` 的 Cloudflare 账号里增加 Worker **`reading-sb-proxy`**，绑定自定义域名 **`sb.nonger.com`**。

Worker 把所有 HTTP 方法、路径、请求头和正文，以及 WebSocket 升级，转发到上述 Supabase 项目，并改写 `Host`。浏览器里的 Supabase 地址改为 `https://sb.nonger.com`，不再直连 `*.supabase.co`。

另外加了一条显式路由：`sb.nonger.com/*` → `reading-sb-proxy`。zone 上已有更早的路由 `*nonger.com/*`，指向 Notion 代理 Worker **`bold-paper-2243`**；没有这条更具体的路由时，`sb.nonger.com` 会被它截走。

**不要改用 `workers.dev` 域名。** 该域名在中国大陆经常被拦，起不到代理的作用。

## Vercel 环境变量

项目：**`nonger-zhous-projects/german-reading-coach`**。

| 项 | 值 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://sb.nonger.com`（**Production** 与 **Preview**） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 未改 |

`NEXT_PUBLIC_*` 在 **构建时写进前端包**。只改 Dashboard 里的变量不会改变已经上线的页面，必须重新部署。

Production 已按该变量重新部署：

- 当前：`dpl_FFnykynzY8azFZNE1L9GY1ZCfVf8`（commit `1d1b0e27`）
- 上一条可回滚的部署：`dpl_HC5iZuwsgkP9Hg8F3W4atyzmvVFy`

## 换地址的直接后果

supabase-js 用 URL 的主机名派生登录状态的存储键。主机名从 `*.supabase.co` 换成 `sb.nonger.com` 之后，**已经登录的用户会被登出一次**，需要重新登录。再改回原来的主机名也会再登出一次。

## 注册通知邮件里的后台链接

`src/lib/notify/signupNotification.ts` 的 `supabaseUsersPageUrl` 只从 `https://<项目>.supabase.co` 这种地址推出 Supabase Dashboard 的用户页链接。`NEXT_PUBLIC_SUPABASE_URL` 换成代理地址后，对不上这个格式，邮件里的后台链接为空。注册通知的其余内容仍会发送。这是无害的副作用，可作后续小改：在不把代理地址误当成项目 ref 的前提下，单独给出 Dashboard 链接。

## 找回密码邮件（只改了 Supabase 后台，不在本仓库）

Supabase 模板变量 **`{{ .ConfirmationURL }}` 仍指向 `supabase.co`**。若重置密码邮件继续用它，大陆用户点开邮件链接时又会直连 Supabase。

**Reset Password** 模板里的链接已改为（在 **Supabase Dashboard → Authentication → Email Templates** 手工保存）：

```text
https://sb.nonger.com/auth/v1/verify?token={{ .TokenHash }}&type=recovery&redirect_to={{ .RedirectTo }}
```

这是 Dashboard 里的设置，**仓库里没有这份模板**。克隆代码、看 Pull Request 都看不到它。若有人在后台把邮件模板恢复成默认，重置链接会回到 `supabase.co`。

站点上的 **`/auth/recovery`** 处理隐式流程放在哈希里的结果：成功时是 `#access_token`，失败时是 `#error`（含 `error_code`，例如 `otp_expired`）。

**2026-11-22 验证**：用无效 token 经代理访问 verify，返回 **303**，跳到 `https://reading.nonger.com/auth/recovery#error...otp_expired`。

其余模板仍使用 `{{ .ConfirmationURL }}`：

- Confirm signup
- Invite
- Magic link
- Change email

以后若这些邮件也要走代理，用同一写法，把主机换成 `sb.nonger.com`，`type` 分别用 `email`、`invite`、`magiclink`。

回滚 Vercel 上的环境变量**不会**改这封邮件模板。代理 Worker 还在时，模板继续指向 `sb.nonger.com` 仍然可用。若同时撤掉 Worker，须把 Reset Password 模板改回默认的 `{{ .ConfirmationURL }}`。

## 回滚

1. Vercel → Deployments → 把 **`dpl_HC5iZuwsgkP9Hg8F3W4atyzmvVFy`** Promote 为 Production（Instant Rollback / Promote 以控制台当前按钮为准）。这条部署是在改环境变量之前构建的，包内仍是原来的 `supabase.co` 地址。
2. 把 Production 与 Preview 的 `NEXT_PUBLIC_SUPABASE_URL` **改回** `https://htetqagtrdoumntvjksy.supabase.co`。否则下一次构建又会把 `https://sb.nonger.com` 写进前端。
3. 按上一节决定邮件模板是否改回。

## 尚未确认

- **Cloudflare 在中国大陆能否稳定访问没有保证。** 必须由真实的大陆网络（手机流量与家庭宽带）试注册、登录、重置密码。不能只用境外网络或「请求已到达 Worker」代替。
- **页面 `reading.nonger.com` 仍直连 Vercel**（灰云 CNAME，见上文）。若大陆用户连页面都打不开，只代理 Supabase 不够，要另外考虑是否让页面也经 Cloudflare 代理。
- **微信、QQ 等应用内浏览器**可能另外拦截请求。打不开或一直 Failed to fetch 时，先让用户用系统浏览器打开（「在浏览器中打开」）。
