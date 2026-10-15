# 改名、商业化与中国用户 — 讨论备忘（2026-10-15）

> **状态：暂不执行。** 维护者结论：「先不做，不一定卖得出去」。本文记录讨论过程与已查证的事实，需要时再调出来继续。
> 产品需求以 [`PRD.md`](./PRD.md) 为准；本文是 PRD §1.3「商业化方向」的补充材料。
> 文中外部事实（价格、政策、可访问性）以 2026-10-15 查证为准，**重新启动前须再核实**。

---

## 1. 结论一览

| 问题 | 结论 |
|---|---|
| 要不要改名 | 要改：「German Reading Coach」已不准确（支持英语），中文用户也不好记。**中文名倾向「读报学外语」**（待维护者在小红书、微信搜一搜、App Store 中国区确认无同名）。界面先只用中文名。 |
| 英文名 | **Reading Coach 不能用**（微软、瑞典 SVT 都在用）。未撞名的候选：**GlossRead**（倾向）、Newsling、Readmint。 |
| 要不要买域名 | 哪种形态都**不是必需**（vercel.app 可用），一年约 10–20 美元，用于品牌与信任。**先定商业形态，再买域名。** |
| 谁承担 AI 费用 | **我们承担、按订阅收费**（与 PRD §1.3 一致）。让用户自带 OpenAI 密钥对中国用户基本不可行。 |
| 卖给谁 | 若要卖，**先做海外华人**（留学生、移民、在海外工作），现有架构可直接用。国内用户需单独部署，成本和合规门槛高，暂不做。 |
| 国内版怎么做 | 若将来要做：**同一套代码、两种部署**（数据库与大模型做成可切换配置），不要复制出第二套代码。 |

---

## 2. 改名

### 2.1 中文名

- 候选：读报学外语（倾向）、外刊词伴、原文通、瑞士深处·读报（限定瑞士，不利推广）。
- 「读报学外语」：网络搜索未发现同名产品，只有「用报纸学外语」的教学文章。但搜索工具对国内应用商店、小红书、公众号覆盖不全，**须人工再查**。
- 它是描述性短语：一看就懂，但难注册商标；自用 / 小范围推广没问题。

### 2.2 英文名查重记录

| 名字 | 结果 |
|---|---|
| Reading Coach | ❌ [微软 Reading Coach](https://apps.microsoft.com/detail/9nz7k7dd74fr)、[SVT Språkkraft Reading Coach](https://sprakplay.svt.se/sprakkraft-reading-coach) |
| Read Native | ❌ 英语里是「读美洲原住民作家作品」的固定口号（[Kirkus](https://www.kirkusreviews.com/news-and-features/articles/lets-read-native-in-2021/)、多所大学图书馆书单） |
| Lexi | ❌ 不是正式单词（取自 lexicon），也是常见女孩名，已有多个同名产品 |
| Dubao（读报拼音） | ❌ 与字节跳动「豆包」Doubao 只差一个字母 |
| ReadLingo / LingoRead | ❌ 已有同名 Chrome 插件 ReadLingo、App LingoReads |
| WordCatch | ❌ 已有同名语言学习 App |
| Wordfold | ❌ 已有拼字游戏 Word Fold |
| Readfluent | ⚠️ 与儿童阅读软件 Readingfluency 太像 |
| **GlossRead** | ✅ 未发现同名产品；gloss = 页边词义注释，「glossed reading」是语言教学正式术语，含义最贴切 |
| **Newsling** | ✅ 未发现同名产品；短、好念；但以后做 YouTube / 社交媒体导入时「news」略窄 |
| **Readmint** | ✅ 未发现同名产品；好记，但看不出是学语言 |

- 同类「读新闻学语言」产品很多（Readle、Lela、Readery 等），英文名容易撞车，定名前要再查。
- 域名可否注册未能查到（会话网络无法访问域名注册查询服务）。查法：Vercel → Domains → Buy / Add Domain，直接显示能否购买与价格，可一键绑定项目。

### 2.3 改名 / 换域名时要改的地方

| 位置 | 说明 |
|---|---|
| 界面显示名 | 顶栏、页面标题、首页、`/help`、页脚、插件右键菜单「导入到 …」——容易，一次改完 |
| 网址 | 在 Vercel 加新域名，**旧网址 `german-reading-coach.vercel.app` 保留**，书签与旧插件不失效 |
| Chrome 插件 | `manifest.json` 与 `background.js` 写死了正式版网址，换域名必须同步更新插件，否则插件打不开导入页 |
| Supabase Auth | Site URL / Redirect URLs 要加新域名，否则新域名上的注册、找回密码邮件链接出错 |
| GitHub 仓库名、Supabase 项目名 | 用户看不到，不必改（GitHub 改名会自动跳转） |

---

## 3. 卖什么形态

| 形态 | 要服务器 | 要域名 | 其他成本 |
|---|---|---|---|
| 网页版（现在） | 要 | 不要（vercel.app 可用），有了更正规 | 收费后 Vercel 须升级 Pro（约 20 美元 / 月）——**Hobby 免费版禁止商业用途** |
| 手机 / 桌面 App | 要（同一后端） | 不要；应用商店要求隐私政策网址（可挂任意网址） | Apple 开发者 99 美元 / 年；Google Play 一次性 25 美元 |
| Chrome 插件上架商店 | 要（插件只负责导入） | 不要；同样要隐私政策网址 | 开发者注册一次性 5 美元 |
| Claude skill | **不要** | **不要** | AI 费用由用户自己的订阅承担 |

- **为什么可安装软件也离不开服务器**：OpenAI 密钥不能放进用户安装的软件里（会被拆出来盗用）；文章库、词库、复习要跨设备同步（Supabase）；AI 分析在服务器上调用。
- **skill 是另一种产品**：没有阅读页高亮 / 点词 / 拖选、没有跨设备词库与复习、没有插件导入，「只推不认识的词」要用户每次把词库交给 Claude。适合做引流小工具，替代不了现有软件。skill 是否有成熟的付费售卖渠道**未查证**。

---

## 4. 谁承担 AI 费用

### 4.1 用户自带密钥（BYOK）——不推荐作为主模式

- **OpenAI 自 2024 年 7 月起屏蔽中国大陆与香港的 API 访问**（[SCMP](https://scmp.com/tech/policy/article/3267971/tech-war-openai-further-block-access-mainland-china-hong-kong-based-developers)、[heise](https://heise.de/-9778032)）；大陆用户难以合法获取密钥，付费也要境外信用卡。
- 一般用户不知道 API 密钥是什么，注册、充值、粘贴几步就会流失大半。
- 我们要安全保存用户密钥，泄露是我们的责任。
- 只适合技术型小众用户，可作为将来的高级选项。
- **ChatGPT Plus / Claude Pro 等订阅额度不能被第三方软件调用**（PRD §1.4.3 同）。

### 4.2 我们承担、按订阅收费——推荐

- 与 PRD §1.3 一致：免费用户每月有分析额度，付费用户更多。
- 一篇文章分析成本大约几美分级别。**定价前先算真实单价**：OpenAI 后台 Usage 页面，取一段时间的花费 ÷ 分析篇数。
- 我们承担时模型由我们选，以后可换更便宜的模型（如 DeepSeek，接口与 OpenAI 兼容）。现在用了 OpenAI 严格 JSON 结构输出，换模型须测试推荐质量。

---

## 5. 中国大陆用户能否访问

### 5.1 问题

订阅只解决谁付 AI 费用，解决不了网络连通。国内用户的浏览器要直接连**两个**海外地址：

1. **网站**：Vercel 官方说明 `.vercel.app` 在大陆可能被屏蔽或限速，Vercel 在国内没有服务器；自有域名「不太容易被标记」但不保证，按运营商不同、随时可能变化（[Vercel 指南](https://vercel.com/kb/guide/accessing-vercel-hosted-sites-from-mainland-china)）。
2. **Supabase**：登录与读写文章库、词库都是浏览器直连 `*.supabase.co`；国内能否稳定访问未确认，风险不小。所以网站换域名后，登录和数据这一步仍可能卡住。

OpenAI 调用在服务器端进行，用户浏览器不直连，这一步不受影响（但国内服务器同样连不上 OpenAI）。

### 5.2 方案

| 方案 | 做法 | 效果 | 工作量 |
|---|---|---|---|
| A 先不做国内 | 目标用户为海外华人 | 现架构可用 | 几乎为零 |
| B 海外服务器尽量改善 | 自有域名；浏览器只连我们一个域名，由服务器转发 Supabase | 会好一些，不保证 | 中 |
| C 国内单独部署 | 国内云 + 国内数据库 + 国产大模型 | 国内稳定 | 很大，有合规门槛 |

**方案 C 的合规与成本**（2026-10-15 了解，须咨询备案服务商核实）：

- 国内服务器连不上 OpenAI，须换国产模型（DeepSeek、通义千问、豆包、混元等）。
- 网站须 ICP 备案；**在线收费通常还需要 ICP 经营许可证**。
- 面向公众提供生成式 AI 服务有专门的登记 / 备案要求。
- 腾讯云 CloudBase（[博客](https://cloudbase.cloud.tencent.com/en/blog/2026/04/20/2026-cloudbase-deployment-domestic-choice)）：个人版 **19.9 元 / 月**（3000 资源点），未见免费档；CloudBase 环境可作备案资源（须个人版以上、环境有效期 > 6 个月、开通固定 IP）；Next.js 服务端接口须改成云函数，配置比 Vercel 麻烦；提供给 AI 编程工具用的 MCP 与 Skills。

### 5.3 若做国内版：迁移工作量

| 部分 | 现在 | 国内版 | 难度 |
|---|---|---|---|
| 选词核心（词频表、词形规则、选词规则、提示词） | 纯 TypeScript | 几乎原样复用 | 低 |
| 网站框架 Next.js | Vercel 零配置 | CloudBase 云函数 | 中 |
| 数据库与登录 | Supabase + RLS | CloudBase 数据库与登录，数据层重写 | **高** |
| AI 模型 | OpenAI + 严格 JSON 结构 | 国产模型，适配结构化输出，**推荐质量重新调试** | 中–高 |
| 插件 | 指向 vercel.app | 指向国内域名 | 低 |

- **工具**：腾讯 WorkBuddy 是办公类 AI 智能体（检索、写报告；可切混元 / DeepSeek / Kimi 等，[TechNode](https://technode.com/2026/03/09/tencent-launches-openclaw-like-workplace-ai-agent-workbuddy/)），公开介绍未提写代码与部署；做迁移更适合编程类工具（CodeBuddy、Cursor、Claude Code 等）。备案、实名、收费资质任何 AI 工具都办不了，须本人办理。
- **架构原则**：同一套代码、两种部署——数据库与大模型做成可切换配置，海外版 Supabase + OpenAI，国内版 CloudBase + 国产模型；功能只开发一次。

---

## 6. 重新启动时的建议顺序

1. **实测国内访问**：找国内朋友分别用手机流量和家庭宽带打开网站并登录；或用多地测速网站（如 boce.com、17ce.com）测网址。
2. **算真实单价**：OpenAI Usage ÷ 分析篇数，据此定免费额度与订阅价格。
3. **定商业形态与目标用户**（海外华人 / 国内）。
4. 定名：中文名人工查重；英文名在 GlossRead / Newsling / Readmint 中选，并在 Vercel 查域名能否购买。
5. 收费前把 Vercel 升级为 Pro。
6. 若做国内：先在现有代码里把数据库与模型做成可切换（对海外版无害），再部署国内版。
