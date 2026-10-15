# German Reading Coach — AI 词汇偏名词：时间线 + 词库实数 + 实验结论（供 ChatGPT 讨论）

> **用法**：可直接复制全文发给 ChatGPT。  
> **项目**：德语阅读学习 Web App；整文分析 `POST /api/analyze-article`，模型 `gpt-4o-mini`，用户水平多为 B1。  
> **生成日期**：2026-05-19  
> **相关长文**：[`VOCABULARY_EXPERIMENTS_SUMMARY_FOR_CHATGPT.md`](./VOCABULARY_EXPERIMENTS_SUMMARY_FOR_CHATGPT.md)（实验方式与 Autodiebe 细节）、[`AI_VOCABULARY_NOUN_TIMELINE_INVESTIGATION.md`](./AI_VOCABULARY_NOUN_TIMELINE_INVESTIGATION.md)（仓库 git / prompt 时间线）。

---

## 0. 我们想讨论什么

1. **从项目早期（5/2、5/3 本地开发）起，AI 推荐词汇是否就已经偏名词？** 还是上线 / Grammar v2 之后才变？  
2. **生产整文 prompt** 与 **拆分第二次调用 / 极简 B** 的差异说明了什么？  
3. 若保留 Grammar v2，**架构上**怎么改才合理（不堆补丁）？

**当前生产未改**：仍为单次整文 + `SYSTEM_PROMPT`（Reset v1 vocabulary 段 + Grammar v2）。

---

## 1. 项目时间线（避免混淆「开工 / Git / 部署 / Prompt 拐点」）

| 日期 | 事件 | 与「偏名词」的关系 |
|------|------|------------------|
| **2026-05-02** | 文档口径的**正式开发起点**：`create-next-app`、Phase 1 **Mock**（不调 OpenAI） | Mock 阶段**无** AI 偏名词问题 |
| **2026-05-02** | Phase 3.1 接入 **OpenAI 整文预览**；后续确认保存 `source=ai` | **真实 AI 从约此时可用** |
| **2026-05-03** | 账户 A 词库中**最早**「整篇全名词」文章；**同一天**另有含动词文章 | **本地期已明显偏名词，但并非篇篇全名词** |
| **2026-05-11** | **Vercel Production 首次部署** | 本地与线上共用 **同一 Supabase**，库内**无法**标 local vs prod |
| **2026-05-13** | Git `Initial commit`（比实际编码晚约 11 天） | 首版 `SYSTEM_PROMPT` 已强调名词/冠词/gender、词汇上限等 |
| **2026-05-16 ~19:39** | **Grammar Analysis v2** 并入整文单次 `SYSTEM_PROMPT`（git `d4aee6e`） | 审计与 live 实验均显示**加重**偏名词，**不是起点** |
| **2026-05-17 起** | 开发日志反复记录长文 fixture **8/8 全名词**；Reset v1、拆分实验等 | 问题在**现行整文链路**可稳定复现 |
| **2026-05-19** | 双账户 Supabase 词库 POS 审计 + H1/H2 live 对照 | 见下文 §2、§5 |

---

## 2. 词库实数审计（Supabase，2026-05-19）

**方法**：`npm run audit:ai-vocab-pos` → `scripts/ai-vocabulary-pos-timeline-report.json`  
**数据**：`vocabulary_items` 且 `source IN ('ai','ai_mock')`，按 **文章** 聚合；时间用 `articles.created_at`（`timeline_at`）。  
**账户**：A = `nonger@bluewin.ch`（报告标签 `account_1`）；B = `info@schoental.ch`。

### 2.1 合并总量

| 指标 | 数值 |
|------|------|
| AI 词条总数 | **616** |
| 有 AI 词的文章数 | **57** |
| 名词类 token（机检 bucket） | **539 / 616 ≈ 88%** |
| 动词 token | **23** |
| 短语类 | **5** |

**定义**：`all_noun_like` = 该文 ≥2 条 AI 词且**全部**为名词类（含中文「名词」标签）。

### 2.2 最早现象

- **最早整篇全名词**：**2026-05-03**，账户 A，《Auch Swiss dabei: Schnelles Internet ermöglicht Telefonieren im Flugzeug》（7 条全名词）。  
- **重要限制**：库里的时间是**保存进词库**的时间，不是模型调用时间；且**无法区分** localhost 与 vercel.app。

### 2.3 用「5/11 部署」近似区分本地为主 vs 本地+线上

（仅账户 A 在 5/11 前有 AI 词数据；账户 B 从 **5/11 当天** 才有记录。）

| 时段 | 文章数（≥2 条 AI 词） | 整篇全名词 | 至少 1 个动词 | 名词 token 占比 |
|------|----------------------|------------|---------------|----------------|
| **&lt; 2026-05-11**（≈ 部署前 / 账户 A 本地期） | 15 | **8（53%）** | **4（27%）** | **~93%** |
| **≥ 2026-05-11** | 42 | **22（52%）** | **7（17%）** | **~87%** |

**解读**：  
- 「整篇全名词」占比部署前后**几乎一样**（~一半文章）。  
- 部署后名词 token 占比略降，但**含动词的文章比例反而更低**（17% vs 27%）。  
- **不能**说「只有上线后才偏名词」；**5/3 起本地使用就已经偏**。

### 2.4 用「5/16 Grammar v2」切分（更贴近 prompt 拐点）

| 时段 | 整篇全名词占比 | 含动词文章占比 | 名词 token 占比 |
|------|----------------|----------------|-----------------|
| **&lt; 2026-05-16 18:43 UTC** | **50%** | **23%** | **87%** |
| **≥ 2026-05-16 18:43 UTC** | **59%** | **12%** | **94%** |

Grammar v2 之后**略加重**，但 5/16 前**已经**一半文章全名词、词条八成九是名词。

### 2.5 部署前（5/3～5/10）账户 A — 逐篇清单

| 日期 | 判定 | 名词/动词条数 | 标题（截断） |
|------|------|---------------|--------------|
| 05-03 | 全名词 | n=7 v=0 | Auch Swiss dabei: Schnelles Internet … |
| 05-03 | 其他 | n=9 v=0 | Die Welt wird besser, wenn wir weniger Erdöl … |
| 05-03 | **含动词** | n=11 v=2 | Wie können wir den Verschwendungstrend brechen … |
| 05-03 | 全名词 | n=10 v=0 | 12 sonnige Wohnideen |
| 05-03 | **含动词** | n=2 v=2 | Kleine Dinge und grosse Ideen |
| 05-03 | 全名词 | n=7 v=0 | Die Angst vor der Waffe im Haus … |
| 05-05 | 全名词 | n=7 v=0 | 70 Tote zu viel unter dem ehemaligen Klinikleiter … |
| 05-05 | **含动词** | n=10 v=2 | Die Schweiz zeigt sich von ihrer schönsten Seite |
| 05-06 | 全名词 | n=9 v=0 | Trumps Truppenabzug sende falsches Signal … |
| 05-07 | 全名词 | n=13 v=0 | Unternehmenssteuern Schweiz: Luzern verdrängt Zug … |
| 05-07 | **含动词** | n=14 v=1 | Herr Joss schenkt sein Haus der Kirchgemeinde … |
| 05-07 | 其他 | n=13 v=0 | Vüpf-Revision: Schweizer IT-Firmen drohen … |
| 05-09 | 其他 | n=8 v=0 | Migros-Sandwich zu leicht … |
| 05-09 | 全名词 | n=10 v=0 | Unsere Kühe holen das Beste aus dem Gras |
| 05-10 | 全名词 | n=16 v=0 | Tiny Houses in der Wankdorf-City |

（注：机检 `has_verb` 与「非全名词」不完全等价；上表「其他」= 非 `all_noun_like`。）

---

## 3. 对「从第一天写代码就偏名词吗？」的精确回答

| 说法 | 是否成立 |
|------|----------|
| 从 **5/2 Mock 第一天** 就偏名词 | **否** — Mock 无 OpenAI 推荐 |
| 从 **第一版整文 AI Prompt 设计** 就**结构上**偏名词 | **是** — 首版即强调 der/die/das、名词类型、gender；动词/搭配为次要 |
| 从 **5/2～5/3 真实 AI 用起来并保存** 就**现象上**偏名词 | **基本是** — 5/3 即有整篇全名词；词条 ~九成名词；约一半文章整篇全名词 |
| 从 **第一篇起 100% 只有名词** | **否** — 5/3 同日有含动词文章；部署前约 **27%** 文章至少 1 动词 |
| 偏名词是 **5/11 上线** 或 **5/16 Grammar v2** 才出现 | **否** — 5/3 已有；Grammar v2 / 上线**可能加重**，非根因 |

**一句话**：偏名词的根因在 **整文 vocabulary 任务 + 与 grammar 同屏的单次调用** 及 **首版 prompt 对名词/性别的强调**；用户 **5/3 前后本地使用** 时词库已呈现与上线后**同量级**的偏名词，而非上线后才变坏。

---

## 4. 生产环境基线（对照用）

| 项 | 说明 |
|----|------|
| 调用 | **1 次** API，返回 grammar + vocabulary + 摘要 + 3 阅读问题 |
| Prompt | `openaiArticleAnalysis.ts` → `SYSTEM_PROMPT` = 中文框架 + **`VOCABULARY_SYSTEM_SECTION`（Reset v1）** + **Grammar v2** |
| 实验名 | `mini_single` / `production_single_call` |

---

## 5. 本地 live 实验摘要（均未接生产、未入库）

> 详细表格见 [`VOCABULARY_EXPERIMENTS_SUMMARY_FOR_CHATGPT.md`](./VOCABULARY_EXPERIMENTS_SUMMARY_FOR_CHATGPT.md)。

### 5.1 策略对照（简表）

| ID | 方式 | API | 含 grammar？ | Vocabulary prompt | 典型倾向 |
|----|------|-----|--------------|-------------------|----------|
| A0 | **生产整文** | 1 | 是（同 prompt） | Reset v1 嵌整文 | **稳定偏名词** |
| H2 | **拆分并行** | 2 并行 | Call A 是；Call B 否 | Call B = **极简 B** | 短文/新闻 **动词明显增多** |
| H1 | **整文但 vocabulary 段换极简 B** | 1 | 是（仍含 Grammar v2） | 极简 B 嵌入整文 | 仍常偏名词，**不如 H2** |
| — | 仅词汇单次 + Reset v1 | 1 | **否** | Reset v1 only | Autodiebe **9/10 名词**，改善有限 |
| — | 仅词汇单次 + 极简 B | 1 | **否** | 极简 B | 明显好于 A0；长文仍可能全名词 |

### 5.2 四篇 fixture（2026-05-19，B1）

| 篇目 | 生产单次 A0 | 拆分 + 极简 B（H2） |
|------|-------------|---------------------|
| short-news | 6 条全名词 | 10 条，**6 动词** 等 |
| gaullismus（长文） | 偏名词 | **仍可能 10/10 全名词** |
| msc-oil | 5 条全名词 | 含动词 |
| meghan | 0 动词 | 3 动词 + 可分动词 |

### 5.3 Autodiebe 长文（~6170 字，2026-05-19）

| 方式 | 全名词？ |
|------|----------|
| 生产整文 | **10/10 名词** |
| 拆分 + Reset v1 | 否（3 动词 + 短语等） |
| 拆分 + 极简 B | 否 |
| 仅词汇 + Reset v1（无 grammar） | **9/10 名词** |
| 仅词汇 + 极简 B | 否 |

**要点**：去掉 grammar **不够**；需要 **任务隔离（拆分）** 和/或 **极简 B 类短 prompt**。

### 5.4 H1 vs H2 头对头（2026-05-19，5/5 fixture）

报告：`scripts/vocabulary-hypothesis-compare-report.json`

| 指标 | H1（整文 vocabulary 段换极简 B，仍含 Grammar v2） | H2（拆分第二次极简 B） |
|------|---------------------------------------------------|------------------------|
| verbScore 胜场 | **0** | **5** |
| 非全名词 胜场 | 0 | 2（另 3 平局） |

**结论**：在同屏 Grammar v2 下**只换 vocabulary 段**（H1）**不能**达到拆分（H2）效果。

---

## 6. 我们目前认同的结论（命题）

1. **偏名词从早期真实 AI + 首版 prompt 设计就已存在**；词库 5/3 起可证；**不是**上线独有现象。  
2. **Grammar v2 同屏** 是重要加重因素，但 **Reset v1 单独做 vocabulary-only 单次** 仍常偏名词 → **不只** 语法段问题。  
3. **Reset v1 文案声称对齐极简 B**，但整文 / 仅词汇 Reset v1 / 极简 B **实测差很大** → 上下文竞争、任务长度、schema 字段并列等值得分析。  
4. **拆分第二次 vocabulary 调用（尤其极简 B）** 对新闻/中篇多数更好；**Gaullismus 类超长文** 仍可能全名词 → 非 universal fix。  
5. **生产 route 未改**；所有改善路径需权衡 **2× API 成本** 与长文稳定性。  
6. 用户词库历史**不会**因重新分析自动更新；旧文偏名词需**重新分析并重新保存**或手改。

---

## 7. 希望 ChatGPT 重点讨论的问题

1. 为何 **5/2 首版 prompt 设计**（名词/gender 细则）会导致 **5/3 词库**就 ~93% 名词 token，但仍有 ~27% 文章含动词？  
2. **Grammar v2 同屏** vs **拆分** vs **仅词汇单次**：从 attention / 任务分解角度，如何解释 Autodiebe「去 grammar 仍 9/10 名词，拆分却明显好转」？  
3. **H1（整文换 vocabulary 段为极简 B）全面输给 H2**：是否说明 vocabulary 段长度不是主因，而是 **与 grammar 的同一 completion 竞争**？  
4. 长文全名词：**分块**、两阶段候选、换模型、还是 grammar 后置第二次调用？  
5. 若产品必须保留 Grammar v2 质量：推荐 **2 并行调用**、**串行两次**、还是 **grammar 可选/折叠**？成本与延迟如何估？  
6. `surface_form` / 可分动词 / 动介搭配：如何在 prompt 里写清而**不**再次把模型推向只列名词？

---

## 8. 报告与数据文件路径

| 内容 | 路径 |
|------|------|
| 双账户词库 POS 时间线 | `scripts/ai-vocabulary-pos-timeline-report.json` |
| 四篇 fixture 拆分实验 | `scripts/vocabulary-second-call-experiment-report.json` |
| Autodiebe 拆分 | `scripts/vocabulary-split-custom-report.json` |
| Autodiebe 零语法 | `scripts/vocabulary-only-no-grammar-report.json` |
| H1/H2 对照 | `scripts/vocabulary-hypothesis-compare-report.json` |
| 极简 B vs 生产（2026-05-18） | `scripts/vocabulary-only-vs-production-experiment-report.json` |
| 实验方式长文 | `docs/VOCABULARY_EXPERIMENTS_SUMMARY_FOR_CHATGPT.md` |

---

## 9. 产品约束（讨论时请保留）

- 不继续堆 **prompt 补丁** 作为首选方案。  
- 实验阶段**未改**生产 `/api/analyze-article`。  
- 优先 **个人可用版**；需保留 Grammar v2 能力时再谈架构。  
- 回归：阅读页点按高亮、拖选加词库、移动端勿弹系统「在 Google 中搜索」等已验收功能勿破坏。

---

*本文档由 German Reading Coach 维护者整理，供外部模型讨论；数据截至 2026-05-19。*
