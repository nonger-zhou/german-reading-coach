# German Reading Coach — 产品方向修订 + 技术背景（供 ChatGPT 讨论）

> **用法**：可直接复制全文发给 ChatGPT。  
> **日期**：2026-05-19（在与维护者讨论后修订；**非**首版「默认并行两次 API」方案）  
> **项目**：德语阅读 Web App；整文分析 `POST /api/analyze-article`，模型 `gpt-4o-mini`，用户多为 B1。  
> **相关**：[`AI_VOCABULARY_NOUN_BIAS_FULL_BRIEF_FOR_CHATGPT.md`](./AI_VOCABULARY_NOUN_BIAS_FULL_BRIEF_FOR_CHATGPT.md)（偏名词时间线与实验数据）、[`VOCABULARY_EXPERIMENTS_SUMMARY_FOR_CHATGPT.md`](./VOCABULARY_EXPERIMENTS_SUMMARY_FOR_CHATGPT.md)（实验细节）。

---

## 1. 我们要讨论什么

维护者已决定调整产品方向：**词汇为主，语法按需**。希望 ChatGPT 帮助推敲：

- **默认整文 AI**：单次调用、极简 B 词汇、**不再自动生成 grammar**、**不再生成摘要**（阅读问题保留且 UI 保留）；
- **语法**：用户选区 →「解释语法」→ 单独小上下文 API（不传整篇、不传总库）；
- **不**继续给 Reset v1 打补丁；**不**上候选池/代码预抽；
- Grammar v2 **保留**在代码库，用于 enrich / 可选 feature flag，**不是**默认整文路径。

请重点给：**单次调用下的 prompt/schema 设计**、**按需语法 API 的输入输出**、**风险与验收建议**。

---

## 2. 已确认的产品决策（维护者口径）

| 项 | 决策 |
|----|------|
| 默认整文分析 | **仍 1 次 OpenAI 调用**（与现网相同次数；**不是**默认 2 次并行） |
| 自动 grammar 推荐 | **关闭**（`grammar` 不产出或恒空） |
| Vocabulary prompt | **极简 B 风格**（见 §5），替代 Reset v1 长段 |
| 摘要 `summary_zh` / `summary_de_simple` | **取消**（阅读问题里已含理解导向，避免重复） |
| `reading_questions` | **保留**（仍建议恰好 3 条中文问题）；**UI 保留** |
| 语法学习 | **按需**：选中原文连续子串 →「解释语法」→ 独立 API |
| 统计 | 本篇词汇 = **词条/卡片数**（1 短语 = 1 条）；token 不作主数字 |
| 未定位词汇 | **保存**为本篇词汇，标「暂无高亮」，**不**默认丢弃 |
| 旧自动 grammar | 可用 **feature flag** 保留，**默认关** |

---

## 3. 背景：为什么改方向（实验 + 词库）

1. AI 词汇偏名词 **不是上线后才出现**；2026-05-03 本地真实 AI 保存期已约一半文章「整篇全名词」、词条 ~90% 名词类。  
2. **Grammar v2 同屏**会加重偏名词，但 **不是唯一原因**（首版 prompt 已偏名词/性别）。  
3. **仅去掉 grammar 不够**：Autodiebe 上「仅词汇单次 + Reset v1、无 grammar」仍 **9/10 名词**；「仅词汇 + **极简 B**」明显改善。  
4. **整文里只换 vocabulary 段、仍留 Grammar v2**（实验 H1）**不如**「拆分第二次极简 B」（H2）—— 但若 **整文完全去掉 Grammar v2**，维护者认为 **不必为了「不同屏 grammar」默认拆成 2 次调用**；应用 **单次 + 极简 B + 无 grammar** 作为首选，拆分仅作 fallback/对照。  
5. 生产整文（Reset v1 + Grammar v2 同 prompt）在多篇 fixture / 用户长文上常 **全名词**；拆分或极简 B 在 short-news、MSC、Meghan、Autodiebe 上 verb/短语明显增多。Gaullismus 超长文仍可能全名词，**不作为第一硬门槛**。

---

## 4. 现网 vs 目标（调用与费用）

### 4.1 现网（生产，讨论基准）

- **1 次** API。  
- System：中文框架 + **Reset v1 词汇段** + **长段 Grammar v2**。  
- User：**1 份**正文（≤约 1 万字）+ 词汇库/语法库过滤说明。  
- 输出：`vocabulary` + **`grammar` 数组** + **摘要** + **3 个阅读问题**。

### 4.2 目标（维护者确认）

- **仍 1 次** API（**不**默认 2× 用户正文）。  
- System：**极简 B** 词汇说明 + **简短**「生成 3 条中文阅读问题」；**无 Grammar v2**。  
- User：**1 份**正文 + **词汇库**过滤（默认**不再**拼总语法库块）。  
- 输出：`vocabulary` + **`reading_questions`**（**无** `summary_*`，**无** 自动 `grammar`）。

### 4.3 费用直觉（供讨论）

- 相对现网：**省** Grammar v2 system 体积、**省** grammar 输出、**省** 摘要输出；正文仍 **1 份** → 默认整文分析 **总 token 倾向下降**。  
- 语法：**从每篇必做** → **仅用户点「解释语法」时** 小上下文请求 → 语法相关费用 **明显下降**。  
- 并行两次调用 **不是** 维护者默认方案，除非单次验收不达标再考虑。

---

## 5. 极简 B（生产 vocabulary 应用文本）

来源：`src/lib/articleAnalysis/experimentalVocabularyOnlyMinimalPrompt.ts` → `EXPERIMENTAL_MINIMAL_B_VOCAB_ONLY_SYSTEM`（实验未接生产）。

```
You are helping a Chinese-speaking B1/B2 German learner read a German article (userLevel is in the user message).
Select useful vocabulary or expression items from the article. The goal is reading-learning value, not keyword extraction only.

Include a balanced mix when the article offers them:
- nouns or compound nouns (keep some core topic nouns, but not as the only type);
- verbs and verb phrases;
- verb-preposition combinations;
- separable verbs;
- fixed expressions and collocations;
- adjectives, adverbs, and connectors when useful.

You output vocabulary items with:
surface_form, lemma, normalized_key, part_of_speech, grammatical_gender (na | m | f | n | unclear),
level_estimate, zh_meaning, simple_de_explanation, example_sentence, reason_for_selection.

Rules:
- surface_form: exact contiguous span from originalText when possible (for highlighting).
- lemma: dictionary form or standard expression (verbs: infinitive).
- zh_meaning: short Chinese gloss; simple_de_explanation: simple German.
- grammatical_gender: only for noun/compound_noun; otherwise na.
- Do not use ellipsis placeholders in surface_form.
```

整文单次时：上述词汇任务 + **同一次 JSON** 内增加 `reading_questions`（建议仍 **恰好 3 条**）；**不要**再嵌 Reset v1 长段或 Grammar v2。

---

## 6. 按需「解释语法」（简化 API + 两层保存）

### 6.1 API：`POST /api/explain-grammar-selection`

**客户端只传**：`articleId` + `selected_text`（必填，原文连续子串）。  
**不要**让用户选：userLevel、解释程度（simple/normal/detailed）、追问、手填前后文。

**服务端自动**（对齐现网 `buildGrammarExternalDeepDivePrompt` + `snippetAroundOffsets`）：

- 校验 `selected_text` ⊆ `original_text`  
- 计算 **出现句** + **原文短片段**（±约 240 字，不传整篇）  
- 可带文章标题；**不传**总词库/总语法库  

**Prompt**：一次给全深入解释（结构参考外部深入解释 Prompt 的 1–7 步）；面向中文母语学习者，**不**写死 B1/B2。  
**输出**：JSON 分段字段，面板展示；保存时映射到 **主解释**（`explanation_zh` 等）。

### 6.2 与 enrich-grammar / 外部 AI

| | explain-grammar-selection | enrich-grammar | 外部深入解释 |
|---|---------------------------|----------------|--------------|
| 前提 | 选区即可 | 已入库 grammar item | 已选语法卡（现网） |
| 调 App API | 是 | 是 | **否**（剪贴板） |
| 落库 | 保存后 → **主解释** | **主解释** | **深度笔记** `user_deep_note` |

**两层字段（同一 `grammar_items` 行）**：App 内置解释 → 主解释；外部/长文 → 深度笔记。不是「所有内容进一个字段」。

### 6.3 UI

选区 → **解释语法**（无额外表单）→ 展示 → 关闭或 **保存到本篇语法**（可编辑）。不满意可继续用 **外部深入解释** → 粘贴到深度笔记。

### 6.4 手动「标记语法」

仍可保留；与「解释语法」并存。

---

## 7. 统计与保存（产品硬规则）

**右侧「本篇词汇」主统计（已实现方向，需 PRD/UI 统一）：**

- 本篇词汇：**N 条**（卡片/词条）  
- AI 推荐：**N 条** | 手动添加：**N 条**  
- 可高亮：**N 条** | 未定位/暂无高亮：**N 条**  
- 固定搭配、动词短语、可分动词 = **各 1 条**  
- **禁止**用 token 数作主数字或称为「生词数」

**保存：**

- vocabulary：`surface_form` 无法在正文定位 → **仍保存**，文中暂无高亮。  
- grammar（按需/手动）：**selected_text 必须是原文连续子串**（硬性）。  
- grammar **主解释** vs **`user_deep_note`**：见 §6.2（App explain / enrich → 主解释；外部 AI → 深度笔记）。

---

## 8. 建议的技术实现轮廓（供 ChatGPT  critique，尚未编码）

### 8.1 默认整文 `analyze-article`

1. 新/改 `SYSTEM_PROMPT`：极简 B + 阅读问题说明（中文一句：解释语言中文）。  
2. 新 JSON schema：`vocabulary` + `reading_questions`（required）；**去掉** `grammar`、`summary_zh`、`summary_de_simple`（或 grammar 可选恒 `[]` 以减小迁移面）。  
3. `normalizeOpenAIArticleAnalysis` 适配；route 不再拉 grammar 库过滤。  
4. 前端：AI 预览无语法候选、无摘要区；**保留**阅读问题展示与保存；`articles` 表若仍有 summary 列可留空或不再 update。  
5. `ENABLE_AUTO_GRAMMAR_ANALYSIS`：true 时走 legacy 单次整文（旧 schema + Grammar v2 + 摘要可选）。

### 8.2 不必默认做的事

- **不必**默认 2 次并行（vocabulary call ∥ meta call），除非单次 live 验收失败。  
- **不必** Reset v1 补丁、候选池、预抽。

---

## 9. 验收建议（live，gpt-4o-mini，B1）

| Fixture | 硬门槛 | 备注 |
|---------|--------|------|
| short-news | 非全名词；动词/短语明显 | |
| msc-oil | 非全名词；≥2 动词或 verb_phrase | |
| meghan | 非全名词；可分动词或 verb_phrase | |
| autodiebe | 非全名词；≥3 动词/短语类 | 生产曾 10/10 名词 |
| gaullismus | **仅观察** | 超长文；二期可分块 |

对比基线：现网单次（grammar + Reset v1 + 摘要 + 问题）。  
目标路径：**单次 + 极简 B + 无 grammar + 无摘要 + 3 问题**。

功能：选区「解释语法」小 API；保存后词条统计与「暂无高亮」；flag 可恢复旧行为。

---

## 10. 请 ChatGPT 重点回答的问题

1. **单次调用**下，极简 B + 仅 `reading_questions`（无摘要、无 grammar）的 system/schema 如何写最稳？reading_questions 与 vocabulary 同 JSON 是否足够，还是建议分两次？（维护者倾向 **一次**，请说明利弊。）  
2. 去掉摘要后，3 条阅读问题应如何 prompt，才能覆盖「主旨 + 关键细节」且不与 vocabulary 任务冲突？  
3. **explain-grammar-selection**：在「仅 articleId + selected_text、服务端自动上下文、无 userLevel/程度/追问」前提下，JSON schema 与 system prompt 如何写最稳？  
4. 与 `enrich-grammar`、**深度笔记** 并存时，如何避免用户混淆「主解释 / 深度笔记 / 临时面板」？  
5. 长文（Gaullismus）在 **不拆两次、不分块** 前提下，还可接受哪些缓解（temperature、条数软上限、重试）而不回到 Reset v1 补丁？  
6. `articles.summary_*` 历史数据与 UI：只读展示旧数据 vs 完全隐藏，如何产品化？

---

## 11. 明确不做（本阶段）

- Reset v1 继续堆补丁  
- 候选池 / 代码预抽  
- 默认整文自动 Grammar v2 推荐  
- 默认生成摘要（已由阅读问题替代）  
- 默认 2 次整文 API（除非验收证明单次不够）  
- **全文译文入库**（含自动保存；「粘贴并保存译文」→ `translation_zh` **记入 backlog，暂不实现**）  
- 全文翻译：v1 仅 **复制外接 Prompt**，与外部深入解释同模式

---

## 12. 仓库参考路径

| 内容 | 路径 |
|------|------|
| 现生产整文 prompt | `src/lib/articleAnalysis/openaiArticleAnalysis.ts` |
| 现 schema | `src/lib/articleAnalysis/articleAnalysisJsonSchema.ts` |
| 极简 B | `src/lib/articleAnalysis/experimentalVocabularyOnlyMinimalPrompt.ts` |
| analyze API | `src/app/api/analyze-article/route.ts` |
| enrich-grammar | `src/app/api/enrich-grammar/route.ts` |
| 未定位仍保存 | `src/lib/articleAnalysis/convertAnalysisToArticleItems.ts` |
| 本篇词条统计 UI | `src/components/InteractiveArticleReader.tsx` |
| 设计评估（将修订为单次优先） | `docs/DESIGN_VOCAB_FIRST_GRAMMAR_ON_DEMAND.md` |

---

*本文档反映 2026-05-19 与维护者讨论后的方向；实现前须更新 `docs/PRD.md`。*
