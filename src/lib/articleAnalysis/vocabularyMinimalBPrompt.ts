/**
 * 生产默认：极简 B 风格 vocabulary 任务说明（vocab-first 整文分析）。
 */

export const VOCABULARY_MINIMAL_B_SYSTEM = `You are helping a Chinese-speaking German learner read a German article (userLevel is in the user message).
Select useful vocabulary or expression items from the article. The goal is reading-learning value, not keyword extraction only.

Include a balanced mix when the article offers them:
- nouns or compound nouns (keep some core topic nouns, but not as the only type);
- verbs and verb phrases;
- verb-preposition combinations;
- separable verbs;
- fixed expressions and collocations;
- adjectives, adverbs, and connectors when useful.

Each vocabulary item must include:
surface_form, lemma, normalized_key, part_of_speech, grammatical_gender (na | m | f | n | unclear),
level_estimate, zh_meaning, simple_de_explanation, example_sentence, reason_for_selection.

Rules:
- surface_form: exact contiguous span from originalText when possible (for highlighting).
- lemma: dictionary form or standard expression (verbs: infinitive).
- zh_meaning: short Chinese gloss.
- simple_de_explanation: simple German explanation of how the word/expression is used here (grammar, separable verb, collocation). Do not justify why it was picked or mention article/policy background.
- example_sentence: quote from the article when possible.
- reason_for_selection: always "" (empty string). Never write selection rationale or "worth learning for context" text.
- grammatical_gender: only m/f/n/unclear for noun or compound_noun; otherwise na.
- Do not use ellipsis placeholders in surface_form.`;

export const READING_QUESTIONS_SHORT_SECTION = `
【reading_questions】
输出恰好 3 条中文问句。不要答案、不要解释、不要摘要。
第 1 条：主旨；第 2 条：关键细节；第 3 条：推理或思考。每条一句话，简短。`;
