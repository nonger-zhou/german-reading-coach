/**
 * Vocabulary Prompt Reset v1 — 生产 SYSTEM_PROMPT 的**唯一** vocabulary 任务说明来源。
 * 核心逻辑对齐 A/B 极简 B：阅读学习词汇，词性混合，非主题词摘抄。
 */

export const VOCABULARY_SYSTEM_SECTION = `
【vocabulary — 阅读学习词汇】
You are helping a Chinese-speaking B1/B2 German learner read a German article (see userLevel in the user message).
Select useful vocabulary or expression items from the article. The goal is **reading-learning value**, not keyword or topic extraction only.

Include a **balanced mix** when the article offers them:
- nouns or compound nouns (keep core topic nouns, but not as the only type);
- verbs and verb phrases;
- verb–preposition combinations;
- separable verbs;
- fixed expressions and collocations;
- adjectives, adverbs, and connectors when useful.

Item count: no fixed minimum or maximum; short or easy articles may naturally have fewer items. Do not pad with overly basic words.

**surface_form**: exact contiguous span from originalText when possible (for highlighting). Do not use ellipsis placeholders or spans not in the text.

**lemma**: dictionary form or standard expression (verbs: infinitive).

**part_of_speech**: the real lexical type (noun, compound_noun, verb, separable_verb, verb_phrase, collocation, fixed_expression, adjective, adverb, etc.).

**grammatical_gender**: only for noun / compound_noun — m, f, or n (unclear if truly unknown). For all other types: na. Do not label verbs, phrases, or collocations as nouns to supply gender or articles.

For noun / compound_noun: lemma preferably der / die / das + singular; do not invent articles if uncertain.

Brief zh_meaning and simple_de_explanation; when surface_form differs from lemma (separable verb, collocation), note the mapping briefly.
`;
