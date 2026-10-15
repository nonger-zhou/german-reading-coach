# 导入来源分类、现行用法与开发路线图

本文档说明：**哪些网页/材料适合用现有能力导入**，**三类典型链接怎么用**，以及 **PDF / OCR / SCORM 测验** 的排期建议。与 **`docs/PRD.md` §1.4.2**、**`PROJECT_STATUS.md`「待开发 / Backlog」** 配套维护。

---

## 1. 来源类型（技术分类）

| 类型 | 典型形态 | 能否复制文字 | 现有产品能力 | 排期 |
|------|----------|--------------|--------------|------|
| **HTML 正文页** | 新闻、博客、官网 FAQ（`<p>` / 块级 `section`） | 通常可以 | **链接导入**、**Chrome 插件**、手动粘贴 | **现在就用（P0）** |
| **A：网上直链 PDF** | 浏览器打开 `.pdf`（含 Moodle `pluginfile.php/…pdf`） | 常受限；SCREEN 版多为图 | 插件拖选 / 粘贴兜底 | **P2–P3**（文字层 PDF → OCR） |
| **B：网页内 PDF 阅读器** | 普通 URL + 内嵌 pdf.js 等 | 部分站点有文字层 | 同 HTML，需站点适配 | **P2** |
| **C：互动 / 防复制包** | SCORM 学习检测、纯 Canvas 题面 | 往往不能 | **不适用**自动全文导入 | **P4 以后**（按屏 OCR 须单独立项） |

**原则（不变）**：只处理用户**已合法可见**的内容；不绕过 Moodle / 付费墙 / 登录墙的服务端破解抓取。

---

## 2. 三条链接：现在具体怎么用

### 2.1 L-GAV 官网 — 十个常见问题（推荐，P0）

**示例**：[Die 10 häufigsten Fragen & Antworten](https://l-gav.ch/fragen-antworten/die-10-haeufigsten-fragen-antworten)

| 项 | 说明 |
|----|------|
| **类型** | 普通 **HTML** FAQ 页（不是 PDF，不是 SCORM） |
| **主要用途** | **原文排版阅读**：整段德文进阅读页左侧正文，保留段落结构，用于 **点词 / 拖选加词库、AI 分析、高亮定位**；不是「只抠几个词」的词典模式 |
| **今天怎么做** | ① **`/import` → 链接导入** 粘贴上述 URL；或 ② 浏览器打开该页 → **Chrome 插件已重载** →「导入到 German Reading Coach」 |
| **保存后** | 在 **`/articles/[id]`** 按正常阅读流程：AI 分析词汇、手动添加、掌握状态等 |
| **不必等** | PDF 解析、OCR、SCORM 适配 |

**与 G1 课程的关系**：Moodle 里常有资源 **「L-GAV Die 10 häufigsten Fragen und die Antworten URL」**，指的就是此外链；与下文 Ratgeber **PDF 节选不是同一份材料**。

**注意**：导入的是 **FAQ 问答正文**，版式以清理后的 **纯文本段落** 为准（空行分段）；复杂页眉页脚、导航会被清理，**不保证与官网像素级一致**，但适合阅读教练的「读 + 标词」流程。

---

### 2.2 GastroSuisse eLearning — Ratgeber PDF（SCREEN 节选）

**示例**（需课程登录）：  
`https://g1-gastrosuisse-elearning.ch/pluginfile.php/…/EG_Ratgeber_L-GAV_DE_2022_SCREEN_Auszug.pdf`

| 项 | 说明 |
|----|------|
| **类型** | **A**：Moodle 提供的 **直链 PDF**；文件名 **SCREEN** 多表示 **分页图片/屏幕阅读版**，常 **无可靠文字层** → 偏 **OCR** |
| **现在怎么做** | 在 **已登录** 浏览器中打开 PDF → 能 **拖选** 的段落用 **插件**（优先选中文本再点导入）或 **复制 → `/import` 粘贴**；无法选中则 **暂不指望** 一键全文 |
| **产品排期** | **P2**：可读文字层的网页 PDF；**P3**：扫描/SCREEN PDF 与按页 OCR。**不与 SCORM 同期做** |

---

### 2.3 GastroSuisse eLearning — SCORM 学习检测（Lernkontrolle）

**示例形态**：`…/mod/scorm/player.php?…&display=popup`（弹窗 SCORM 播放器）

| 项 | 说明 |
|----|------|
| **类型** | **C**：**SCORM 互动测验**；题面常在 **iframe** 内，**只能勾选选项、不能复制字** |
| **现在怎么做** | **不要** 期待链接导入/插件全文；若只为记词： **截图 → 外部 OCR/笔记 → 手动粘贴** 能复制的部分到 `/import` |
| **产品排期** | **P4 以后**；须单独定义范围（例如「仅当前屏题干 OCR」）与 **合规**（个人学习、不代替提交答案） |

---

## 3. 建议的开发优先级（下一步做什么）

### 现在做（P0）— 不新开 PDF/OCR/SCORM 大项

1. **用好现有导入 + 阅读闭环**（见 **`docs/PERSONAL_USE_CHECKLIST.md`**）。
2. **HTML 类材料**：官网 FAQ、新闻、博客（含 `section.snm-text` 类机构站，已加强块级提取）。
3. **插件**：改代码后必须在 `chrome://extensions/` **重新加载**。

### 短期（P1）— 文档与提示（小投入）

- 在 **`/import`** 增加简短说明：链接导入 / 插件 / 粘贴各适合哪种来源（可链到本文档）。
- 插件或导入页提示：**Chrome 内置 PDF 标签** → 请 **拖选正文** 后导入。
- 维护本文档与 **`docs/USER_MANUAL.md`** 导入一节同步。

### 中期（P2）— 若 G1 以 PDF 教材为主

- **浏览器内可读 PDF**（含文字层的 `pdf.js` 等）：提取文字 → 现有 `/import` → 阅读页。
- **仍不做了**：SCORM 自动抓题、Moodle 服务端代登录抓 PDF。

### 中后期（P3–P4）

| 阶段 | 内容 |
|------|------|
| **P3** | SCREEN/扫描 PDF、按页 **OCR** + 校对 UI |
| **P4** | SCORM / 防复制测验页（按屏 OCR 或明确不做） |

---

## 4. 与 PRD 路线图的关系

| PRD 既有项 | 本文档定位 |
|------------|------------|
| **PDF 导入**（§2 暂不做） | 拆为 P2 文字层 PDF、P3 扫描/OCR |
| **Phase 5 拍照 OCR** | 与 P3 按屏 OCR 同类，可合并评估 |
| **Chrome 插件 MVP**（已实现） | P0 主力之一；HTML + 块级 section |

---

## 5. 维护

- 新增典型站点或 G1 资源类型时，更新 **§2** 与 **§3**。
- 实现 P2+ 功能时，同步 **`docs/PRD.md`**、**`PROJECT_STATUS.md`**、**`DEVELOPMENT_LOG.md`**。
