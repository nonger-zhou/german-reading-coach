# AI 推荐词汇「只出名词」时间线调查（2026-05-19）

## 1. 词库实数审计（Supabase）

**目标**：扫描 `vocabulary_items` 中 `source IN ('ai','ai_mock')`，按文章聚合，看从哪个月起「保存的 AI 词条几乎全为名词」。

**本机首次运行结果**：仅有 `anon key`，Postgres `42501 permission denied`，**未能读到你的词库数据**。

**请你本地执行（二选一）**：

```powershell
# 方式 A（推荐，仅本地、勿提交）：Supabase → Settings → API → service_role
# 写入 .env.local：SUPABASE_SERVICE_ROLE_KEY=eyJ...

# 方式 B：浏览器登录 App 后，DevTools → Application → 找 supabase auth token
# .env.local：SUPABASE_AUDIT_USER_JWT=<access_token>

npm run audit:ai-vocab-pos
```

报告输出：`scripts/ai-vocabulary-pos-timeline-report.json`  
控制台会打印**按月**：文章数、全名词文章数、含动词文章数。

---

## 2. 仓库内可确定的「Prompt / 代码」时间线

| 时间（git） | 提交 | 与「偏名词」的关系 |
|-------------|------|-------------------|
| **2026-05-13** | `d80481e` Initial | 已有：**名词 lemma 必须 der/die/das**、名词必须 `noun/compound_noun`、gender 细则；vocabulary **最多 20 条**；grammar 最多 8 条。**从第一版就强调名词与性别。** |
| **2026-05-14** | `80637f2` | 分析时过滤总库已掌握/暂忽略词汇（不改变 POS，但改变推荐集合）。 |
| **2026-05-16 18:43** | `8fee112` | 取消词汇 20 条上限；重写 part_of_speech 指引（禁止把动词搭配标成名词）。**意图减负，但长文仍可能偏名词。** |
| **2026-05-16 19:39** | `d4aee6e` | **Grammar Analysis v2** 大块进 `SYSTEM_PROMPT`（与 vocabulary 同屏单次调用）。**强烈怀疑的拐点：任务竞争加剧。** |
| **2026-05-17 全天** | 多笔 DEVELOPMENT_LOG | **首次在验收里稳定记录「Gaullismus 8/8 全名词」**；结构化选词、软性自检、自动全名词重试等均未通过；后**移除** route 全名词自动第二次调用。 |
| **2026-05-17 23:57** | `7655a83` | 恢复单次调用 + 沿用 d4aee6e 词汇口径；后又有 **Reset v1**（对齐极简 B 理念，删长补丁）。 |
| **2026-05-18–19** | live 实验 | 生产整文：多篇 **10/10 名词**；拆分/极简 B 可改善。**问题在现行整文链路，不是「没部署」。** |

---

## 3. 开发日志里「全名词」首次被明确写死的时间

- **2026-05-17** — `vocabulary 轻结构化候选流程` live：**Gaullismus 8/8 noun**，MSC 亦 8/8 全名词。  
  → 这是仓库内**最早、可复现、带 fixture 的「整文 AI 长文全名词」记录**。

- 更早 **2026-05-17** 还有「长文 vocabulary 全名词：加强 Prompt + **自动重试一次**」（说明问题在加重试**之前**已存在）。

- **2026-05-18** — `vocabulary-only vs 生产`：production 在 gaullismus / msc 上**全名词类**。

- **用户实篇 Autodiebe（2026-05-19 live）**：生产整文 **10/10 名词**。

---

## 4. 初步结论（在无 Supabase 数据前）

1. **「只推荐名词」不是某次小改才突然出现**；初始 prompt 就偏重名词/冠词/gender。  
2. **2026-05-16 Grammar v2 并入整文单次调用** 是最合理的**架构拐点**（与后续所有 live 对照一致）。  
3. **2026-05-17** 起验收日志**反复**记录长文 8/8 名词，说明当时线上/本地分析已稳定可复现该现象。  
4. **Reset v1（05-17 后）** 短(fixture)文有时出现动词，但**用户真实新闻稿**（Meghan、Autodiebe、MSC）生产整文仍常全名词 → **词库里若只保存了生产分析结果，会呈现「最近全是名词」**。  
5. **要回答「你的词库从哪一天开始几乎全名词」** → 必须跑 §1 审计脚本（service_role 或登录 JWT）。

---

## 5. 与「保存到词库」的关系

- 词库 `vocabulary_items.created_at` = **你点击保存 AI 结果的时间**，不是模型推理时间。  
- 只有 `source = 'ai' | 'ai_mock'` 的条目算 AI 推荐写入。  
- 若某篇文章分析在全名词时期保存，该文下所有 AI 词条会一起偏名词；应用内**重新分析但未重新保存**不会更新词库旧数据。

---

## 6. 建议下一步

1. 你执行 `npm run audit:ai-vocab-pos` 后把 `scripts/ai-vocabulary-pos-timeline-report.json` 发回，可精确到**月/文章**。  
2. 若某月前动词多、某月后全名词，与 **d4aee6e（Grammar v2）** 部署时间对照即可验证。  
3. 旧文章若要纠正 POS，需在该文页**重新分析并重新保存**（或手动改词性），历史库不会自动回溯。
