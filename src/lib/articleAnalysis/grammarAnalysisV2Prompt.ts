/** Grammar Analysis v2：整文分析 SYSTEM_PROMPT 语法章节（Phase 1） */

export const GRAMMAR_ANALYSIS_V2_SYSTEM_SECTION = `
【Grammar Analysis v2 — 语法推荐（最多 8 条，可少于 8 条）】

**原则（必须遵守）**
- Accuracy is more important than quantity. 准确性优先于数量。
- 不要为了凑满 8 条而编造语法点；没有明确、真实、有学习价值的结构时，只返回 2–5 条甚至 0 条。
- Do not invent grammar points. Do not force a Nebensatz label.
- Do not classify a phrase as a clause. Do not classify a fronted adverbial as a subordinate clause.
- 每条 grammar item **只选一个**最主要、最有学习价值的 **grammar_type**（见 schema 枚举）。同一 selected_text 或同一句不要拆成多条重复项（如不要对同一句同时输出 temporalangabe + modalverb + satzklammer）。
- 先判断 **grammar_type** 与 **selected_text 是片段还是整句**，再写 name_de / name_zh / explanation_zh。解释里可顺带提及次要成分，但不要另占一条。

**grammar 与 vocabulary 分工**
- 动词介词搭配（sich kümmern um、es geht um Geld、warten auf …）默认进 **vocabulary/collocation**，不要标为 nebensatz。
- 仅 **um + 钟点/时间**（um elf Uhr）且 selected_text **只有该短语** 时 → 进 vocabulary/phrase，**不要**作为 grammar 条目。
- 若 selected_text 是整句且学习点是 **时间状语前置 + V2 主句**（如 Um elf Uhr muss ich …）→ grammar_type = **hauptsatz_v2**。
- 若 vocabulary 已推荐同一表达且非句法结构重点，grammar **不要**在同一位置重复。

**每条 grammar 必填字段**
- **grammar_type**（枚举，入库时 **grammar_key = grammar_type**）
- **normalized_key**：区分同一类型下的不同具体结构（小写归一化；可与 grammar_type 相同或更细，如含 selected_text 关键词）
- **selected_text**：必须是原文**连续子串**
- **name_de** / **name_zh**：人类可读标题（不要只写「从句」）
- **is_subordinate_clause**：true 仅当确为从句/关系从句/um…zu 等非主句结构；主句、介词短语、祈使句等为 false
- **finite_verb**：句中变位动词（无则 ""）
- **finite_verb_position**：second | final | first | none | unknown
- **explanation_zh**、**explanation_de_simple**、**level_estimate**、**example_sentence**、**reason_for_selection**（与既有字段一致）

**主句 V2（hauptsatz_v2）**
- 变位动词通常在第二位：Vorfeld（状语/短语/主语等）+ **finite verb** + 其余成分。
- 状语前置（Heute / Danach / Um elf Uhr / In der Schweiz … + finite verb 第二位）仍是**主句**，不是 Nebensatz。
- 祈使句（Nimm …!）、一般疑问句（Muss ich …?）Phase 1 可归 **hauptsatz_v2** 或 **other**，**不要**标 nebensatz。

**从句 Nebensatz（nebensatz）**
须同时满足：有从属连词（dass, weil, wenn, ob, als, obwohl, während, bevor, nachdem, seitdem, sobald, da, falls 等）或明确从句结构；有完整谓语；变位动词通常在句末。
- 仅选 **dass ich krank bin** 这类从句片段 → 可标 nebensatz（含 finite verb bin）。
- 不要只因句首有 um/wenn/als 或句子较长就标从句。

**关系从句（relativsatz）**
- 须有关系代词 der/die/das/welcher… 引导的嵌入从句，谓语在从句末。
- **Der Mann steht dort.** 中 der 是定冠词 → **不是** relativsatz。

**um 的三种用法（必区分）**
1. **um + 时间**（um elf Uhr, um Mitternacht）→ 仅短语时：**temporalangabe**（若误作 grammar 条目）或不应出现在 grammar；整句学习 V2 → **hauptsatz_v2**。
2. **um … zu + Infinitiv** → **infinitiv_um_zu**（不是普通 nebensatz，无变位动词）。
3. **动词 + um**（es geht um, sich kümmern um）→ 优先 vocabulary；grammar 用 **verb_praeposition** 仅当整句结构教学必要且未在 vocabulary 重复。

**无变位动词**
- 通常**不能**标 nebensatz；例外：**infinitiv_um_zu**、明确的介词短语类型（temporalangabe / praepositionalphrase）若 selected_text 仅为短语且确有语法教学价值（优先少推）。

**B1/B2 除从句外也可推荐**：hauptsatz_v2, satzklammer, modalverb, passiv, perfekt, praeteritum, konjunktiv_i/ii, adjektivdeklination, nominalisierung, participialkonstruktion 等——但每条仍须符合上文规则，且不与 vocabulary 重复堆砌。

【反例 — 必须遵守】

反例 1 — 整句
原文：Um elf Uhr muss ich Medikamente nehmen.
正确：grammar_type=hauptsatz_v2；name_de 如 Hauptsatz mit Temporalangabe im Vorfeld；is_subordinate_clause=false；finite_verb=muss；finite_verb_position=second。
错误：nebensatz, infinitiv_um_zu, finalsatz。

反例 2 — 仅短语
selected_text：Um elf Uhr
→ 不要作为 grammar 条目（进 vocabulary）；若必须分类则为 temporalangabe，禁止 nebensatz。

反例 3
Heute gehe ich nach Zürich. → hauptsatz_v2（Heute 前置，gehe 第二位），不是 nebensatz。

反例 4
Ich nehme Medikamente, weil ich krank bin. → nebensatz；is_subordinate_clause=true；finite_verb 在从句中为 bin，position=final。

反例 5
Ich lerne Deutsch, um besser arbeiten zu können. → infinitiv_um_zu；不是 nebensatz。

反例 6
Der Mann, der dort steht, ist mein Lehrer. → relativsatz。

反例 7
Der Mann steht dort. → hauptsatz_v2；der 是冠词不是关系代词。
`;

export const GRAMMAR_ENRICH_V2_SYSTEM_SECTION = `
【Grammar Analysis v2 — 手动标记语法补充解释】

在写 name_de / name_zh / explanation_zh 之前，必须先根据 selected_text 与 occurrence_sentence 判断 **grammar_type**（枚举）及是否从句。

**纠错（必填 when applicable）**
- **grammar_type**：纠正后的类型（入库建议：grammar_key = grammar_type）
- **was_label_corrected**：若 current_name 或 grammar_key 与正确类型不符则为 true
- **corrected_label**：纠正后的人类可读标签（可与 name_zh 一致或更短）
- **correction_reason**：简短说明（中文或德英均可），说明为何原标签错误

若用户或 grammar_key 将「Um elf Uhr」或「Um elf Uhr muss ich …」标成 Nebensatz/从句，必须纠正：
- 仅 Um elf Uhr → temporalangabe，不是从句
- 整句 Um elf Uhr muss ich … → hauptsatz_v2，不是 Nebensatz

**字段**
- explanation_zh：至少 2–3 句，引用句中具体德语片段；说明主句/从句/不定式/介词短语，不要套话。
- explanation_de_simple、name_de、name_zh、level_estimate、reason_for_selection、example_sentence 与既有要求一致。
- **is_subordinate_clause**、**finite_verb**、**finite_verb_position**（无变位动词则 verb 为 ""，position 为 none）

**Konjunktiv 纠错（保留）**
- "Es habe ... gefehlt" → Konjunktiv I，不是 Konjunktiv II。

**反例**（与整文分析相同，略）
1. Um elf Uhr muss ich … → hauptsatz_v2，非 nebensatz
2. Um elf Uhr  alone → temporalangabe，非 nebensatz
3. Heute gehe ich … → hauptsatz_v2
4. weil ich krank bin → nebensatz
5. um … zu können → infinitiv_um_zu
6. Der Mann, der dort steht → relativsatz
7. Der Mann steht dort → hauptsatz_v2，非 relativsatz
`;
