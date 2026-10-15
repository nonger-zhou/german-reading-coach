# 设计报告：词汇为主、阅读问题保留、语法按需深入解释、全文翻译外接 AI

> **状态**：维护者已确认产品方向；**未实现代码**。  
> **日期**：2026-05-19（澄清修订）  
> **ChatGPT 粘贴版**（同口径摘要）：[`VOCAB_FIRST_GRAMMAR_ON_DEMAND_FOR_CHATGPT.md`](./VOCAB_FIRST_GRAMMAR_ON_DEMAND_FOR_CHATGPT.md)  
> **背景数据**：[`AI_VOCABULARY_NOUN_BIAS_FULL_BRIEF_FOR_CHATGPT.md`](./AI_VOCABULARY_NOUN_BIAS_FULL_BRIEF_FOR_CHATGPT.md)

---

## 产品方向摘要（维护者确认）

| 维度 | 决策 |
|------|------|
| 默认整文 API | **仍 1 次** `POST /api/analyze-article`；**不**默认两次并行 |
| 默认输出 | `vocabulary` + `reading_questions`（3 条） |
| 默认取消 | 自动 `grammar`、`summary_zh`、`summary_de_simple` |
| Vocabulary prompt | **极简 B**；**不**再 patch Reset v1；**不**候选池/预抽 |
| Reading questions | **保留** + UI 保留；prompt **极短**；若 live 仍干扰 vocabulary 再改按需 |
| 语法 | 默认不推荐；选区 → **解释语法**（深入，App 内 OpenAI）；可选 **保存到本篇语法** |
| 全文中文 | **外接 AI**：生成 Prompt → **复制剪贴板**；**不**走本 App OpenAI、**不入库** |
| 统计 | **词条/卡片数**为主；禁止 token 当「生词数」 |
| Legacy | `ENABLE_AUTO_GRAMMAR_ANALYSIS` 等 flag 保留旧整文（含 grammar+摘要） |

---

## 1. 默认 `analyze-article` 需改哪些文件

### 1.1 服务端 / Prompt / Schema（必改）

| 文件 | 变更要点 |
|------|----------|
| `src/lib/articleAnalysis/openaiArticleAnalysis.ts` | 新 `SYSTEM_PROMPT_VOCAB_FIRST`：极简 B + **极短** reading_questions 说明；移除 Grammar v2、`VOCABULARY_SYSTEM_SECTION`（Reset v1）；旧 prompt 迁入 `SYSTEM_PROMPT_LEGACY` |
| `src/lib/articleAnalysis/vocabularyMinimalBPrompt.ts` | **新建**：从 `experimentalVocabularyOnlyMinimalPrompt.ts` 提升生产用 `VOCABULARY_MINIMAL_B_SYSTEM` |
| `src/lib/articleAnalysis/articleAnalysisJsonSchema.ts` | 新 schema `ARTICLE_VOCAB_FIRST_JSON_SCHEMA`（仅 vocabulary + reading_questions）；原 schema 改名为 `ARTICLE_ANALYSIS_JSON_SCHEMA_LEGACY` |
| `src/lib/articleAnalysis/openaiArticleAnalysis.ts` | 新 `normalizeOpenAIArticleAnalysisVocabFirst`；legacy 仍用原 normalize |
| `src/app/api/analyze-article/route.ts` | 读 flag → 选 prompt/schema/normalize；**不再** `fetchGrammarMasteredIgnoredKeys` / `formatGrammarLibraryBlock` / `filterArticleAnalysisGrammar*`（默认路径）；保留 vocabulary 库过滤 |
| `src/lib/articleAnalysis/filterAnalysisByArticleText.ts` | 默认路径跳过 grammar 子串过滤 |
| `src/lib/articleAnalysis/filterGrammarByUserLibrary.ts` | 仅 legacy / enrich 使用 |
| `src/lib/articleAnalysis/buildOpenAIAnalysisUserContent.ts`（或在 `openaiArticleAnalysis.ts`） | user 消息：标题、正文、userLevel、**仅**词汇库 block |

### 1.2 类型与 Mock / 测试

| 文件 | 变更要点 |
|------|----------|
| `src/lib/articleAnalysis/types.ts` | `ArticleAnalysisResult` 拆型或统一型：`grammar`/`summary_*` 在 vocab-first 路径为空；或新增 `ArticleVocabFirstAnalysisResult` |
| `src/lib/articleAnalysis/mockAnalyzeArticle.ts` | 默认 `grammar: []`，无摘要，保留 3 问题 |
| `src/lib/articleAnalysis/*.test.ts` | 更新 fixture 与 schema 期望 |
| `src/lib/articleAnalysis/articleAnalysisExperiments.ts` | 增加 `mini_single_vocab_first` 策略供 live 验收 |

### 1.3 前端：文章页 AI 预览 / 保存

| 文件 | 变更要点 |
|------|----------|
| `src/app/articles/[id]/page.tsx` | 预览：**仅**词汇候选 + 阅读问题；**移除**语法候选列表、摘要展示；保存时 **不** `UPDATE summary_*`；`grammar` 不写入；`reading_questions` 仍写入 `articles` |
| `src/components/InteractiveArticleReader.tsx` | `summaryPanel` 可选传入空/仅问题；Tabs 摘要区隐藏或只显示问题；选区浮层增 **「解释语法」** |
| `src/lib/articleAnalysis/convertAnalysisToArticleItems.ts` | 输入 `grammar: []` 时 grammar 输出空（已支持） |

### 1.4 按需语法 / 全文翻译（新能力，另见 §7–§9、§10）

| 文件 | 变更要点 |
|------|----------|
| `src/app/api/explain-grammar-selection/route.ts` | **新建** |
| `src/lib/articleAnalysis/grammarExplainSelectionPrompt.ts` | **新建** system + schema |
| `src/lib/articleAnalysis/buildFullArticleTranslationPrompt.ts` | **新建** 外接全文翻译 Prompt |
| `src/app/articles/[id]/page.tsx` 或 `InteractiveArticleReader.tsx` | 按钮「全文翻译为中文」→ 复制 Prompt |

### 1.5 文档（实现前/后）

| 文件 |
|------|
| `docs/PRD.md` |
| `README.md` |
| `PROJECT_STATUS.md` / `DEVELOPMENT_LOG.md`（实现后） |

---

## 2. 新 schema 设计

### 2.1 `ARTICLE_VOCAB_FIRST_JSON_SCHEMA`（默认生产）

```json
{
  "name": "article_vocab_first_analysis",
  "strict": true,
  "schema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "vocabulary": { /* 与现 vocabulary items 相同字段 */ },
      "reading_questions": {
        "type": "array",
        "items": { "type": "string" },
        "minItems": 3,
        "maxItems": 3
      }
    },
    "required": ["vocabulary", "reading_questions"]
  }
}
```

- **vocabulary**：沿用现有 `surface_form`、`lemma`、`normalized_key`、`part_of_speech`、`grammatical_gender`、`level_estimate`、`zh_meaning`、`simple_de_explanation`、`example_sentence`、`reason_for_selection`。
- **reading_questions**：**恰好 3** 个 string；服务端 `normalize` 时 `slice(0, 3)` 并过滤非 string。
- **无** `grammar`、`summary_zh`、`summary_de_simple`。

### 2.2 API 响应体（`analyze-article`）

为减少前端大改，**HTTP JSON 可仍用** `ArticleAnalysisResult` 形状，vocab-first 路径填充：

```ts
{
  vocabulary: [...],
  grammar: [],           // 恒空
  summary_zh: "",
  summary_de_simple: "",
  reading_questions: [q1, q2, q3],
}
```

或响应增加 `schemaVersion: "vocab_first_v1"` 供 UI 分支（推荐，便于 legacy 共存）。

---

## 3. Legacy schema 如何保留

| 项 | 做法 |
|----|------|
| Schema 文件 | `articleAnalysisJsonSchema.ts` 导出 `ARTICLE_ANALYSIS_JSON_SCHEMA_LEGACY`（现 `ARTICLE_ANALYSIS_JSON_SCHEMA` 重命名） |
| System prompt | `openaiArticleAnalysis.ts` 内 `SYSTEM_PROMPT_LEGACY`（现整文：Reset v1 + Grammar v2 + 摘要 + 问题） |
| 路由分支 | `process.env.ENABLE_AUTO_GRAMMAR_ANALYSIS === "true"` → legacy 单次调用 |
| 实验代码 | `articleAnalysisExperiments.ts` 保留旧策略名，不删 |
| Grammar v2 源文件 | `grammarAnalysisV2Prompt.ts` **不删** |

---

## 4. 旧 grammar / summary 字段如何兼容

### 4.1 数据库 `articles`

- 列 **`summary_zh`、`summary_de_simple`、`reading_questions` 保留**（已有迁移 `007`）。
- vocab-first 保存：**只 UPDATE `reading_questions`**（及既有 `user_level_at_analysis` 等）；**不再写入** summary 列（或显式写 `null` / 空串，需统一一种）。
- **历史文章**：已存摘要 **只读展示或逐步隐藏**（产品建议：有旧摘要时折叠「历史摘要」，新分析不再生成）。

### 4.2 前端展示优先级

| 数据 | vocab-first 新分析后 |
|------|----------------------|
| 阅读问题 | 预览 > DB > Mock |
| 摘要 | **仅** DB 历史（若有）；预览/新分析不提供 |
| 语法 Tab | **仅**已保存的手动/历史/用户保存的「解释语法」条目；无 AI 预览语法候选 |

### 4.3 TypeScript `ArticleAnalysisResult`

- 短期：保留四字段，vocab-first 填空 grammar/summary。
- 中期： discriminated union `VocabFirstAnalysis | LegacyAnalysis`。

### 4.4 总语法库 / 预览保存

- `handleSaveRealAiPreview`：**不再**遍历 `editableRealAiGrammar`。
- 用户通过 **解释语法 → 保存到本篇语法** 写入 `grammar_items`。

### 4.5 语法：解释 vs 保存 vs 两层字段（维护者确认，2026-05-19）

取消整文自动 `grammar` **不等于**取消语法功能。一条语法在 `grammar_items` **同一行**上仍有两类内容槽位（与现网一致）：

| 槽位 | DB / UI | 典型来源 |
|------|---------|----------|
| **卡片主解释** | `explanation_zh`、`explanation_de_simple`、`name_de` / `name_zh` 等 | App **解释语法** 或 **enrich-grammar** 保存结果；保存前可编辑 |
| **深度笔记** | `user_deep_note` | **外部 AI**（复制 Prompt → 粘贴）；用户长文补充/修改 |

**不是**「三种来源混进同一个字段」：

- App 内置「解释语法」→ 保存时默认写入 **主解释**（加强版、面向读懂句子，类似 enrich 但 Prompt 更深）。
- 外部 AI → 仍进 **深度笔记**（与阅读页「外部深入解释」一致）。
- 用户可在保存对话框改主解释；长材料继续在深度笔记里改。

**解释面板关闭前**：仅内存临时状态，**第三种 DB 位置**。点「保存到本篇语法」后才 `persistManualGrammarItem`。

旧架构「推荐 vs 深入分槽」**内核不变**；变化仅是：不再批量自动推荐，改为选区 + 固定深入 Prompt 调 App API。

---

## 5. `reading_questions` 最短 prompt（建议正文）

置于 system prompt **末尾**，与极简 B 分开段落，控制 **< 120 字**：

```
【reading_questions】
输出恰好 3 条中文问句，不要答案、不要解释、不要摘要。
第 1 条：主旨；第 2 条：关键细节；第 3 条：推理或思考。
每条一句话，简短。
```

**不要**写：长模板、示例答案、与 vocabulary 重复的「列出重点词」等。

**验收观察**：若 live 仍出现 vocabulary 全名词率上升，再评估 reading_questions 改按需（单独小 API 或 UI 勾选）。

---

## 6. Vocabulary 极简 B 接入生产

| 步骤 | 说明 |
|------|------|
| 1 | 新建 `vocabularyMinimalBPrompt.ts`，内容取自 `EXPERIMENTAL_MINIMAL_B_VOCAB_ONLY_SYSTEM` |
| 2 | `SYSTEM_PROMPT_VOCAB_FIRST` = 一行中文角色说明（解释语言中文）+ 极简 B 全文 + §5 阅读问题短段 |
| 3 | **不要**再 import `VOCABULARY_SYSTEM_SECTION`（Reset v1） |
| 4 | `response_format` 使用 `ARTICLE_VOCAB_FIRST_JSON_SCHEMA` |
| 5 | `normalizeOpenAIArticleAnalysisVocabFirst`：只解析 vocabulary + reading_questions |
| 6 | 实验文件 `experimentalVocabularyOnlyMinimalPrompt.ts` 可 re-export 生产常量，避免双源 |

**user 消息**：继续 `buildOpenAIAnalysisUserContent`（title、originalText、userLevel、vocabLibraryBlockAppendix）。

---

## 7. `explain-grammar-selection` API 设计（简化版，维护者确认）

### 7.1 原则：不让用户选参数

ChatGPT 草案里的 `userLevel`、`explanation_depth`、`user_question`、手填 `context_before/after` **均不作为 UI 选项**。用户只做两件事：**选中原文** → 点 **「解释语法」**。

- **userLevel**：去掉。用户点的就是「这句我看不懂」，不必再问 B1/B2。  
- **解释程度**（simple/normal/detailed）：去掉。Prompt 一次给足（对齐外部深入解释的结构），不分档。  
- **用户追问**：第一版不做输入框；Prompt 已要求拆主干/从句/动词位置等。若以后要加，再放面板底部单行可选，**非** API 必填。

### 7.2 上下文：服务端自动拼（对齐「外部深入解释」）

现网 **`buildGrammarExternalDeepDivePrompt`**（`src/lib/grammar/labelValidation.ts`）已采用：

- **原文片段**：`selectedText`  
- **上下文句子**：`occurrenceSentence`（出现句）  
- **文章标题**：`articleTitle`  
- **不传整篇**；enrich 路由还用 **`snippetAroundOffsets`**（`enrichmentContext.ts`，约 ±240 字）截取原文短片段。

**App 内 explain API** 应同样由**服务端**计算，**不要求客户端传** `context_before/after`：

1. `articleId` + `selected_text`（必填，客户端从选区来）。  
2. 服务端加载 `articles.original_text`，校验 `selected_text` 为连续子串。  
3. `findBestTextOccurrence` + `extractSentence` → **出现句**。  
4. `snippetAroundOffsets(original_text, start, end)` → **原文短片段**（与 enrich 一致）。  
5. 可选带 `article.title`。**不传**总词库/总语法库/整篇正文。

### 7.3 路由与请求体（对用户可见的最小集）

`POST /api/explain-grammar-selection`  
`maxDuration`: 60–120s；`gpt-4o-mini`；`temperature` ~0.3。

```ts
// 客户端仅传：
{
  articleId: string;
  selected_text: string;
}
```

### 7.4 User 消息（服务端拼装，示意）

与外部 Prompt 同构，例如：

```
文章标题：…
原文片段（用户选中）：…
出现句：…
原文短片段（前后文）：…
```

System：面向**中文母语**德语学习者；**一次给全**（大意 → 结构拆解 → 主从句/动词位置 → 难点 → 可选简单德语）；禁止只贴语法标签。可参考 `buildGrammarExternalDeepDivePrompt` 的 1–7 步结构，输出改为 **JSON**（便于面板分段展示与保存时映射到 `explanation_zh`）。

### 7.5 响应体（JSON schema，字段可合并展示）

与 enrich **解耦**（不做 `was_label_corrected` 必填）。建议字段：

- `translation_zh`、`clause_structure_zh`、`verb_position_note_zh`、`roles_zh`、`why_difficult_zh`、`learning_order_zh`  
- `explanation_de_simple`（可选）  
- `grammar_type_hint`（可选，弱标签）

实现时也可展平为一段 `explanation_zh` 供保存，面板仍分段显示。

### 7.6 与 `enrich-grammar` 并存

| 能力 | 路由 | 前提 |
|------|------|------|
| **解释语法** | `explain-grammar-selection` | 选区即可；**默认不入库** |
| **补全语法** | `enrich-grammar` | 已入库 `grammarItemId`（如「标记语法」占位） |

共享：auth、OpenAI 客户端、`snippetAroundOffsets`、`extractSentence`。  
保存后一般**不必再 enrich**（主解释已由 explain 填满）；外部不满意 → **深度笔记**。

---

## 8. 「解释语法」：UI、临时显示、保存（保持简单）

### 8.1 UX

选区浮层：**解释语法**（与「添加为词汇」「标记语法」并列；**无**程度/水平/追问表单项）→ 加载 → 侧栏/抽屉展示分段解释 → **关闭**（不落库）或 **保存到本篇语法**（可编辑主解释）→ 仍可用 **外部深入解释** 复制 Prompt / 粘贴到 **深度笔记**。

### 8.2 保存落库（见 §4.5）

| 内容 | 落点 |
|------|------|
| App explain 结果（用户确认保存） | `explanation_zh` 等 **主解释** |
| 外部 AI 粘贴 | `user_deep_note` |
| 长文自改 | 优先 **深度笔记**；短改主解释亦可 |

### 8.3 与「标记语法」

| | 标记语法 + enrich | 解释语法（新主路径） |
|---|-------------------|----------------------|
| 步骤 | 先入库 → 再补全 | 先读懂 → 再保存 |
| 深度 | enrich 偏标签补全 | 固定「深入读懂」Prompt |

两条入口可并存；列表展示均为同一 `grammar_items` 行 + 两层字段。

---

## 10. 「全文翻译为中文」外接 AI

### 10.1 定位（维护者确认：与「外部深入解释」同一类产品）

- **模式**：文章页一个按钮 → 拼装 Prompt → **复制剪贴板** → 用户自行粘贴到 ChatGPT / DeepSeek / Claude / **Google 翻译** 等任意工具；**不调**本 App OpenAI、**不入库**。  
- 与词汇/语法卡片上的 **「外部深入解释」** 同属 **外接 AI 辅助**，只是范围从「一条词/一句语法」变为 **整篇正文**。  
- **非** `analyze-article` 一部分；**非**选区「翻译为中文」（点词/句解释已含中文）。  
- 第一版 **不必**做「打开 ChatGPT」深链；复制 + toast 即可（与现网 `runGrammarExternalPrompt` 一致）。

### 10.2 第一版实现（维护者确认）

| 项 | 设计 |
|----|------|
| 逻辑 | `buildFullArticleTranslationPrompt({ title?, articleText })` → `navigator.clipboard.writeText` |
| UI | 按钮 + toast「已复制，请粘贴到 ChatGPT / DeepSeek / Claude / 翻译器等」 |
| 正文来源 | 当前文章 `original_text`（与阅读页一致；过长则 Prompt 内说明分段翻译） |
| 存储 | **不**写入 DB；**不**自动保存；**不**读取历史译本 |
| 参考实现 | 已有 `buildGrammarExternalDeepDivePrompt` + `runGrammarExternalPrompt`（`InteractiveArticleReader.tsx`） |

### 10.2.1 明确不做（本阶段）

- 调用本 App OpenAI 生成全文翻译。  
- 翻译结果 **自动入库**（含用户无感的后台保存）。  
- 文章页展示已存 `translation_zh`（库表本阶段 **可不增列**）。

### 10.2.2 以后可选（记入 backlog，暂不实现）

| 功能 | 说明 |
|------|------|
| **粘贴并保存译文** | 用户在外部 AI 译完后，将中文 **主动粘贴** 回 App → 写入 `articles.translation_zh`（或等价列）；需迁移 + 正文变更时标「译本可能过期」 |
| 多设备同步译本 | 仅在上项存在后才有意义 |
| 打开 ChatGPT / DeepSeek 深链 | 非 v1 |

仍坚持：**翻译生成在外部**；入库的只是用户 **自愿保留的副本**，且 **全部后置**。

### 10.3 Prompt 模板（维护者提供，略作占位符）

```
请把下面这篇德语文章完整、自然地翻译成中文。
要求：
1. 不要逐字硬翻，要翻译成中文读者自然能理解的表达。
2. 保留原文的段落结构。
3. 人名、机构名、地名第一次出现时尽量保留原文，并在中文后括号标注。
4. 对难懂的德语长句，可以在翻译中适当调整语序。
5. 不要省略内容。
6. 如果文章太长，请分段继续翻译，不要总结。

德语原文：
[ARTICLE_TEXT]
```

- `[ARTICLE_TEXT]`：截断策略与 `truncateForOpenAIAnalysis` **无关**（外接用户自行分段）；可在 UI 警告「超 X 字建议分段复制」。  
- 后续 v2：`window.open` ChatGPT/DeepSeek/Claude（非 v1 必做）。

### 10.4 文件

| 文件 | 作用 |
|------|------|
| `src/lib/articleAnalysis/buildFullArticleTranslationPrompt.ts` | 纯函数生成 Prompt |
| `src/app/articles/[id]/page.tsx` 或 `InteractiveArticleReader.tsx` | 按钮 + clipboard |

---

## 11. Token / 费用 / 延迟

| 对比项 | 现网（legacy） | vocab-first 默认 |
|--------|----------------|------------------|
| API 次数/篇 | 1 | **1** |
| 用户正文份数 | 1 | **1** |
| System 体积 | 大（Grammar v2 + Reset v1 + 摘要说明） | **小**（极简 B + 短问题段） |
| 输出 | grammar 数组 + 词汇 + 双摘要 + 3 问题 | **词汇 + 3 问题** |
| 语法费用/篇 | 含在整文中 | **0**（改按需） |
| 按需解释语法 | — | +1 次/次点击，**小 input** |
| 全文翻译 | — | **0** App token |

**结论**：默认整文 **倾向更省、更快**；重度用户若频繁「解释语法」按次计费。  
**延迟**：单次调用 RTT 不变；输出变短可能略快。

---

## 12. 统计：词条数为主

| 状态 | 说明 |
|------|------|
| **已实现** | `InteractiveArticleReader` → `vocabArticleLexicalStats`：total / fromAi / manual / highlightable / unlocated |
| **待统一** | PRD §统计；`/vocabulary` 页「新增生词」文案 →「新增词条」 |
| **次要指标** | 若保留：折叠区「词形覆盖 N / 约 X%」，**非**右侧主数字 |

**预览区**：候选条数 = 将保存的 vocabulary **卡片数**（1 短语 = 1 条）。

---

## 13. 未定位 vocabulary 仍保存

| 阶段 | 规则 |
|------|------|
| API 警告 | `listRealAiEntriesWithoutTextMatch` 提示，**不剔除**（已实现） |
| convert | 无 offset 仍生成 `ArticleVocabItem` + 占位 sentence（已实现） |
| UI | 卡片 badge「暂无高亮」（已实现） |
| persist | 实现阶段 E2E：无 `start_offset` 的 occurrence 仍写入 `vocabulary_occurrences` |
| grammar | **不适用**；explain 仍要求 `selected_text` 可校验子串 |

---

## 14. Feature flag

| 变量 | 默认 | 作用 |
|------|------|------|
| `ENABLE_AUTO_GRAMMAR_ANALYSIS` | `false` | `true` → legacy `SYSTEM_PROMPT_LEGACY` + `ARTICLE_ANALYSIS_JSON_SCHEMA_LEGACY` |
| `NEXT_PUBLIC_SHOW_LEGACY_SUMMARY`（可选） | `true` | 是否展示 DB 中历史摘要 |
| `NEXT_PUBLIC_ENABLE_READING_QUESTIONS`（可选） | `true` | 未来若问题改按需 |

**实现**：仅在 `analyze-article/route.ts` 读服务端 env；避免客户端泄露 legacy prompt。

---

## 15. 验收方案

### 15.1 Live 词性（gpt-4o-mini，B1，`NODE_OPTIONS=--use-system-ca`）

| Fixture | 硬门槛 | 备注 |
|---------|--------|------|
| short-news | 非 `allNounLike`；verb+phrase ≥ legacy | |
| msc-oil | 非全名词；≥2 verb/phrase | |
| meghan | 非全名词；含可分动词或 verb_phrase | |
| autodiebe | 非全名词；≥3 动词/短语类 | |
| gaullismus | **仅记录** | 不挡发布 |

**基线**：`ENABLE_AUTO_GRAMMAR_ANALYSIS=true` 单次 legacy。  
**目标**：`mini_single_vocab_first`（单次 + 极简 B + 无 grammar + 无 summary + 3 问题）。

**若失败**：先加长 reading_questions 隔离实验；仍失败再考虑 split（fallback，非默认）。

### 15.2 功能验收

- [ ] 整文预览：仅词汇 + 3 问题；无语法候选；无摘要区  
- [ ] 保存：不写 summary；不写 auto grammar  
- [ ] 选区「解释语法」：不入库可关闭；深入字段齐全  
- [ ] 解释后可编辑并「保存到本篇语法」；enrich 仍可用于已入库项  
- [ ] 「全文翻译为中文」：复制 Prompt 成功；不调 `/api/analyze-article`  
- [ ] 右侧统计：主数字为条数；未定位计入 total、计入 unlocated  
- [ ] Flag true：legacy 冒烟通过  

### 15.3 自动化

- 扩展 `vocabulary-hypothesis-compare` 或新增 `articleVocabFirst.live.test.ts`  
- `convertAnalysisToArticleItems.test.ts` 保留未定位用例  

---

## 16. 本阶段明确不做

- Reset v1 补丁；候选池；代码预抽  
- 默认两次整文 API  
- 默认自动 Grammar v2；默认摘要  
- 本 App OpenAI 做全文中文翻译  
- 全文译文 **入库**（含自动保存、粘贴保存、`translation_zh` 列 — **均后置 backlog**）  
- 选区菜单「翻译为中文」（与解释语法/词汇解释区分）

---

## 17. 建议实施顺序（实现阶段）

1. PRD 同步 + schema/prompt/route（vocab-first）+ flag  
2. 文章页预览/保存/UI  
3. live 验收 §15.1  
4. `explain-grammar-selection` + 选区 UI + 保存流  
5. 全文翻译 Prompt + 按钮  
6. 文档 / build / deploy  

---

*维护者确认口径；实现前更新 `docs/PRD.md`。*
