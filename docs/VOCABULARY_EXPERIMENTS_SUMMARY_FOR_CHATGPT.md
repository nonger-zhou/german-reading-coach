# German Reading Coach — 词汇推荐 Prompt 实验总结（供外部讨论）

> **产品方向（词汇为主、语法按需、单次 API、无摘要）**：[`VOCAB_FIRST_GRAMMAR_ON_DEMAND_FOR_CHATGPT.md`](./VOCAB_FIRST_GRAMMAR_ON_DEMAND_FOR_CHATGPT.md)（**建议优先发给 ChatGPT**）。  
> **偏名词时间线与词库审计**：[`AI_VOCABULARY_NOUN_BIAS_FULL_BRIEF_FOR_CHATGPT.md`](./AI_VOCABULARY_NOUN_BIAS_FULL_BRIEF_FOR_CHATGPT.md)。  
> 可直接复制全文发给 ChatGPT / 其他模型讨论。  
> 项目：德语阅读学习 Web App，文章分析用 OpenAI `gpt-4o-mini`，用户水平多为 B1。  
> **所有下列实验均为本地 live 测试，未改生产 API `/api/analyze-article`，未入库。**

---

## 1. 我们要解决什么问题

- **现象**：整文 AI 分析推荐的 **vocabulary** 长期偏 **名词**（简单新闻 5–8 条时几乎全是名词），动词、固定表达、可分动词很少。
- **用户判断**：不主要是「模型不会动词」，更像是 **单次整文 `SYSTEM_PROMPT` 组合**（尤其 **Grammar v2 很长** + vocabulary 与 grammar 同屏竞争）把任务带偏。
- **产品约束（实验期间共识）**：不继续堆 Prompt 补丁、不做候选池/代码预抽；**保留** Grammar v2 与现有 schema；优先 **个人可用版**，词汇 prompt 问题用 **非生产实验** 诊断。

---

## 2. 生产环境当前怎么做（对照基线）

| 项 | 说明 |
|----|------|
| 调用 | **单次** `POST /api/analyze-article`，模型 `gpt-4o-mini` |
| System prompt | `openaiArticleAnalysis.ts` 的 `SYSTEM_PROMPT`：中文框架 + **`VOCABULARY_SYSTEM_SECTION`**（Reset v1）+ **Grammar Analysis v2** + 摘要 + 恰好 3 条阅读问题 |
| 输出 schema | `ARTICLE_ANALYSIS_JSON_SCHEMA`（grammar + vocabulary + summary + reading_questions 一次返回） |
| Vocabulary 段来源 | `vocabularySelectionPrompt.ts` — 宣称 **对齐「极简 B」** 的 balanced mix，但比极简 B **更长**（中英混合、条数说明、gender/lemma 规则更多） |

**实验中的「生产单次」策略名**：`mini_single` / `production_single_call` — 即上述整文 prompt。

---

## 3. 实验里出现的几种「方式」（术语对照）

### 3.1 生产整文单次（baseline）

- 1 次 API，同一 system prompt 里同时要求 grammar + vocabulary + 摘要 + 问题。
- 策略：`mini_single`

### 3.2 第二次调用 · 拆分并行（split）

- **2 次 API 并行**：
  - **Call A（core）**：`ARTICLE_CORE_SYSTEM_PROMPT` + `ARTICLE_CORE_ANALYSIS_JSON_SCHEMA` → grammar + 摘要 + 3 问题，**无 vocabulary**
  - **Call B（vocabulary）**：仅 vocabulary system prompt + `VOCABULARY_ONLY_JSON_SCHEMA`
- 实验只统计 **Call B** 的 vocabulary。
- 策略：
  - `mini_split_reset_vocab` — Call B 用 `VOCABULARY_ONLY_SYSTEM_PROMPT`（Reset v1 同源，明确「不要 grammar」）
  - `mini_split_minimal_b` — Call B 用 **极简 B**（见 §5）

### 3.3 仅词汇单次 · 零语法（vocab-only single, no grammar）

- **1 次 API**，只输出 `{ vocabulary: [...] }`，**完全不请求、不推荐 grammar**，也无摘要/阅读题。
- 策略：
  - `mini_vocab_only_reset` — Reset v1 的 `VOCABULARY_ONLY_SYSTEM_PROMPT`
  - `mini_vocab_only_minimal_b` — 极简 B

### 3.4 极简 B vocabulary-only 单次（早期 A/B，2026-05-18）

- 与 3.3 的 minimal_b 相同 prompt，在更早的 `vocabularyOnlyVsProductionExperiment` 里与生产整文对比。
- 报告：`scripts/vocabulary-only-vs-production-experiment-report.json`

### 3.5 其他历史对照（仓库里有，本次对话未重跑）

- **回退 Grammar v2 之前整文 prompt** vs 生产：Meghan 略好，整体仍偏名词 → 不能单独归因 Grammar v2。
- **Vocabulary Prompt Reset v1 批量回归**：接线已生效，但结果不稳定。

---

## 4. 「极简 B」到底是什么

- **不是**线上功能名，是 **A/B 实验方案 B**：英文、很短、**只**负责选 vocabulary。
- 代码：`src/lib/articleAnalysis/experimentalVocabularyOnlyMinimalPrompt.ts` → `EXPERIMENTAL_MINIMAL_B_VOCAB_ONLY_SYSTEM`
- **未接入生产**；Reset v1 吸收了其 **选词理念**（reading-learning value、balanced mix），但生产仍与 Grammar v2 同屏。

**极简 B 全文（实验用 system prompt）：**

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

You output ONLY a JSON object with a "vocabulary" array. Each item must include:
surface_form, lemma, normalized_key, part_of_speech, grammatical_gender (na | m | f | n | unclear),
level_estimate, zh_meaning, simple_de_explanation, example_sentence, reason_for_selection.

Rules:
- surface_form: exact contiguous span from originalText when possible (for highlighting).
- lemma: dictionary form or standard expression (verbs: infinitive).
- zh_meaning: short Chinese gloss.
- simple_de_explanation: simple German explanation.
- example_sentence: quote from the article when possible.
- grammatical_gender: only m/f/n/unclear for noun or compound_noun; otherwise na.
- Do not use ellipsis placeholders in surface_form.
```

**Reset v1 词汇段（生产用，节选）** — 与极简 B 同段「balanced mix」列表，但外加：条数弹性说明、surface_form/lemma/part_of_speech/grammatical_gender 细规则、中文标题【vocabulary — 阅读学习词汇】；且整文里还有 Grammar v2 等大量内容。

---

## 5. 实验 A：四篇 fixture · 生产 vs 拆分第二次调用

- **日期**：2026-05-19  
- **模型**：gpt-4o-mini，userLevel B1  
- **报告**：`scripts/vocabulary-second-call-experiment-report.json`  
- **环境**：`VOCAB_SECOND_CALL_LIVE=1`，`NODE_OPTIONS=--use-system-ca`

### 5.1 词性统计（机检 bucket：noun / verb / adjective / phrase 等）

| 篇目 | 生产单次 | 拆分 + Reset v1 | 拆分 + 极简 B |
|------|----------|-----------------|---------------|
| **short-news**（~357 字） | 6 条，**全名词** | 10 条：5 名词、**4 动词**、1 形容词、1 verb_phrase | 10 条：**6 动词** 等 |
| **gaullismus**（~9711 字） | 8 条，2 collocation，非全名词但仍偏名词 | **10 条全名词** | **10 条全名词** |
| **msc-oil**（~1623 字） | 5 条，**全名词** | 8 条，1 fixed_expression | 10 条，**2 动词**、1 副词 |
| **meghan**（~2365 字） | 7 条，**0 动词** | 10 条，**2 动词** + verb_phrase | 10 条，**3 动词** + 可分动词 |

### 5.2 本实验结论

1. **短文 / 人物新闻 / MSC**：拆分第二次 vocabulary（尤其极简 B）明显比生产单次更易混合词性。  
2. **Gaullismus 长文**：拆分两条路径仍可能 **全名词**，拆分 **不保证** 优于单次。  
3. 拆分 = **多 1 次并行 API**（core 仍算 grammar），成本高于单次。

---

## 6. 实验 B：用户自定正文 · 瑞士汽车盗窃（Autodiebe）

- **正文**：`scripts/fixtures/autodiebe-schweiz-article.txt`（~6170 字，已去掉 Cookie 提示段）  
- **标题**：Die Schweiz ist das neue Paradies für Autodiebe …

### 6.1 拆分对比（三种策略，2026-05-19）

报告：`scripts/vocabulary-split-custom-report.json`

| 方式 | 条数 | 词性概要 | 全名词？ |
|------|------|----------|----------|
| 生产整文 | 10 | 10 名词 | **是** |
| 拆分 + Reset v1 | 10 | 6 名词、**3 动词**、1 形容词、2 verb_phrase | 否 |
| 拆分 + 极简 B | 10 | 5 名词、**3 动词**、1 形容词、1 fixed_expression | 否 |

**拆分 + Reset v1 示例词条**：einbrechen；sich sorgen um；sich häufen；hochpreisige Autos；Sicherheitsvorkehrungen …

**拆分 + 极简 B 示例词条**：schlafende Hunde wecken；aufrüsten（surface 有时为 `auf rüsten`）；einbrechen；überwachen；nervös …

### 6.2 零语法 · 仅词汇单次（三种策略，2026-05-19）

报告：`scripts/vocabulary-only-no-grammar-report.json`  
假设：若去掉 grammar 后词汇变好 → 语法段可能在整文里「抢注意力」。

| 方式 | 条数 | 词性概要 | 全名词？ |
|------|------|----------|----------|
| 生产整文（含 Grammar v2） | 10 | 10 名词 | **是** |
| **仅词汇单次 + Reset v1**（明确不要 grammar） | 10 | **9 名词** + 1 collocation，**0 动词** | 几乎全名词 |
| **仅词汇单次 + 极简 B** | 10 | 7 名词、**2 动词**、1 fixed_expression | 否 |

**仅词汇 + 极简 B 示例**：rüsten auf / aufrüsten；einbrechen；schlafende Hunde wecken；Sicherheit；Diebstähle …

### 6.3 Autodiebe 上的综合结论

| 对比 | 结论 |
|------|------|
| 生产整文 vs 任意「更好」的实验路径 | 生产稳定 **全名词**；拆分或极简 B 能出 **动词/固定表达** |
| 仅去掉 grammar + Reset v1 单次 | **不够**：仍 9/10 名词，不如 **拆分第二次 Reset v1**（3 动词 + 短语） |
| 仅去掉 grammar + 极简 B 单次 | **明显改善**，但仍略逊于 **拆分 + Reset v1**（动词短语更多） |
| 语法 prompt 是否有问题？ | **是**：整文含 Grammar v2 时词汇严重偏名词；但 **不只** 语法问题——Reset v1 单独 vocabulary-only 仍偏名词，需 **极简 B 或拆分隔离** |

---

## 7. 更早实验（2026-05-18，仓库报告，本次对话未重跑）

### 7.1 极简 B 单次 vs 生产整文（fixture 三篇）

报告：`scripts/vocabulary-only-vs-production-experiment-report.json`

| fixture | production | minimal B only |
|---------|------------|----------------|
| news-short | 7 条，已有 1 verb，但仍偏名词 | 10 条，动词/动介/形容词更多 |
| gaullismus | 7 条，**全名词类** | 10 条，**仍全名词** |
| msc-oil | 6 条，**全名词** | 10 条，含动词 |

### 7.2 Grammar v2 回退实验

- 回退到 Grammar v2 之前的整文 prompt：Meghan 略多 1 动词，**整体仍偏名词** → **不能**单独怪 Grammar v2。

---

## 8. 总表：所有实验方式一览

| ID | 名称 | API 次数 | 是否含 grammar 推荐 | Vocabulary prompt | 典型结果倾向 |
|----|------|----------|----------------------|-------------------|--------------|
| 1 | 生产整文 | 1 | 是（同 prompt） | Reset v1 嵌在整文里 | **偏名词**，稳定 |
| 2 | 拆分 + Reset v1 | 2 并行 | Call A 是；Call B 否 | Reset v1 only | 短文/新闻 **混合词性** 好；长文不稳定 |
| 3 | 拆分 + 极简 B | 2 并行 | 同左 | 极简 B | 动词/表达 ** often 最好** |
| 4 | 仅词汇 + Reset v1 | 1 | **否** | Reset v1 only | 比生产好有限，**仍常偏名词** |
| 5 | 仅词汇 + 极简 B | 1 | **否** | 极简 B | 明显好于生产；长文仍可能全名词 |
| 6 | 极简 B vs 生产（2026-05-18） | 各 1 | 生产是 / B 否 | 极简 B | 与 5 类似 |

---

## 9. 我们目前认同的结论（给讨论用的命题）

1. **接线有效**：改 prompt 后 live 结果会变，不是「没部署」。  
2. **生产整文 + Grammar v2 + Reset v1 同屏** → vocabulary 强烈倾向 **主题名词摘抄**。  
3. **Grammar 段是重要因素，但不是唯一因素**：  
   - 去掉 grammar、仅用 Reset v1 做单次 vocabulary → Autodiebe 仍 **9/10 名词**；  
   - 需要 **任务隔离**（拆分第二次调用）和/或 **极简 B 类短英文 prompt**。  
4. **拆分并行** 在多数新闻稿上优于生产单次，但 **Gaullismus 类长文** 仍可能全名词；**不能**当作 universal fix。  
5. **极简 B ≠ 生产 Reset v1**：理念相近，**上下文与长度不同**，实测效果可差很多。  
6. **成本**：拆分 = 每次分析至少 2× vocabulary 相关 token（且 core 仍做 grammar）；需与质量权衡。  
7. **未做**：把上述任一路径接入生产 route；改 grammar prompt 内容（仅诊断词汇侧）。

---

## 10. 希望 ChatGPT 帮忙讨论的问题

1. 为何 **Reset v1 与极简 B 文案高度相似**，但「整文 / 仅词汇 Reset v1 / 极简 B」表现差这么多？是 attention、schema 字段竞争，还是 temperature / 条数暗示？  
2. **拆分并行** 优于 **仅词汇单次 Reset v1** 的机制：是否因为 core call 仍「读完全文」间接影响了同一 user message 下的第二次调用？（两次独立 completion，无共享 hidden state）  
3. 长文 **全名词** 的缓解：分块 vocabulary、两阶段（先列表达候选再筛选）、还是换模型？  
4. 若产品要 **保留 Grammar v2**：推荐架构是「2 次调用」「1 次调用但 grammar 后置」「grammar 改为可选」？  
5. `surface_form` 与可分动词（如 `auf rüsten` vs `rüsten … auf`）的规范如何写进 prompt 而不引发 again 名词化？  

---

## 11. 复现命令（Windows PowerShell）

```powershell
cd <repo-root>
# 四篇 fixture：生产 vs 拆分
$env:NODE_OPTIONS='--use-system-ca'
$env:VOCAB_SECOND_CALL_LIVE='1'
npx vitest run --config vitest.live.config.ts src/lib/articleAnalysis/vocabularySecondCallExperiment.live.test.ts --testTimeout=900000

# 自选正文：拆分三种策略
$env:VOCAB_SPLIT_LIVE='1'
$env:VOCAB_SPLIT_FILE='scripts/fixtures/autodiebe-schweiz-article.txt'
npm run vocab-split:try

# 零语法：生产 vs 仅词汇单次（Reset / 极简 B）
$env:VOCAB_ONLY_NO_GRAMMAR_LIVE='1'
npm run vocab-only-no-grammar:try

# 2026-05-18：极简 B vs 生产
$env:VOCAB_ONLY_VS_PROD_LIVE='1'
npx vitest run --config vitest.live.config.ts src/lib/articleAnalysis/vocabularyOnlyVsProductionExperiment.live.test.ts --testTimeout=600000
```

**依赖**：`.env.local` 中 `OPENAI_API_KEY`；Windows 建议 `NODE_OPTIONS=--use-system-ca`。

---

## 12. 报告文件路径（仓库内）

| 报告 | 路径 |
|------|------|
| 四篇 fixture 拆分实验 | `scripts/vocabulary-second-call-experiment-report.json` |
| Autodiebe 拆分 | `scripts/vocabulary-split-custom-report.json` |
| Autodiebe 零语法 | `scripts/vocabulary-only-no-grammar-report.json` |
| 极简 B vs 生产（2026-05-18） | `scripts/vocabulary-only-vs-production-experiment-report.json` |
| Reset 批量回归 | `scripts/vocabulary-reset-batch-report.json` |
| Grammar 回退对比 | `scripts/grammar-rollback-vocabulary-pos-report.json` |

---

*文档生成：2026-05-19，基于 German Reading Coach 本地 live 实验与 `DEVELOPMENT_LOG.md`。*
