/** vocabulary 选词短原则（05-15 口径；局部回退，非 05-17 补丁堆叠） */

export const VOCABULARY_LEXICAL_SCOPE_SECTION = `
【vocabulary — B1/B2 阅读学习词汇】
vocabulary 用于阅读前预习，帮助学习者读懂主旨与关键细节；不是把文章主题词或抽象名词抄成列表。
应主动推荐文中影响理解的**广义 lexical item**，例如：单词、复合名词、动词、可分动词、动词短语、固定搭配、常见表达。
篇幅短或整体较易的文章，词汇条数可自然较少；不要为凑条数加入过于基础、帮助很小的项目。
`;

export const VOCABULARY_SURFACE_FORM_LEMMA_SECTION = `
【surface_form 与 lemma】
- **surface_form**：尽量使用 originalText 中**真实连续出现**的片段（便于定位与高亮）。
- **lemma**：词典形式或标准表达（动词多用不定式）。
- 释义中可说明 surface_form 与 lemma 的对应（可分动词、搭配、变形等）。
- **禁止**在 surface_form 中使用文中不存在的拼接或省略号占位，例如 wies … zurück、richtet … ein；若推荐搭配，请从正文截取连续子串（如 wies die Kritik zurück）。
`;
