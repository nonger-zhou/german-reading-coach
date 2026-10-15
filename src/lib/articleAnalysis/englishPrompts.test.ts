import { describe, expect, it } from "vitest";
import {
  ENGLISH_GRAMMAR_TYPE_VALUES,
  GRAMMAR_ENRICHMENT_JSON_SCHEMA_EN,
  GRAMMAR_ENRICH_SYSTEM_PROMPT_EN,
  GRAMMAR_EXPLAIN_SELECTION_SYSTEM_PROMPT_EN,
  parseEnglishGrammarType,
  SYSTEM_PROMPT_VOCAB_FIRST_EN,
  VOCAB_ENRICH_SYSTEM_PROMPT_EN,
} from "./englishPrompts";
import {
  SYSTEM_PROMPT_LEGACY,
  SYSTEM_PROMPT_VOCAB_FIRST,
} from "./openaiArticleAnalysis";
import { GRAMMAR_ENRICHMENT_JSON_SCHEMA } from "./enrichmentJsonSchemas";
import { GRAMMAR_EXPLAIN_SELECTION_SYSTEM_PROMPT } from "./grammarExplainSelectionPrompt";
import { ARTICLE_VOCAB_FIRST_JSON_SCHEMA } from "./articleAnalysisVocabFirstJsonSchema";

describe("English prompts", () => {
  it("article analysis asks for Chinese gloss + simple English explanation, no gender, English item types", () => {
    expect(SYSTEM_PROMPT_VOCAB_FIRST_EN).toContain("英语阅读学习助手");
    expect(SYSTEM_PROMPT_VOCAB_FIRST_EN).toContain("SIMPLE ENGLISH");
    expect(SYSTEM_PROMPT_VOCAB_FIRST_EN).toContain('always "na"');
    expect(SYSTEM_PROMPT_VOCAB_FIRST_EN).toContain("phrasal verbs");
    expect(SYSTEM_PROMPT_VOCAB_FIRST_EN).toContain("【用户词汇画像优先】");
    expect(SYSTEM_PROMPT_VOCAB_FIRST_EN).not.toMatch(/德语|German|separable/);
  });

  it("enrich and sentence-explain prompts are English-specific", () => {
    for (const p of [VOCAB_ENRICH_SYSTEM_PROMPT_EN, GRAMMAR_ENRICH_SYSTEM_PROMPT_EN, GRAMMAR_EXPLAIN_SELECTION_SYSTEM_PROMPT_EN]) {
      expect(p).toContain("英语");
      expect(p).not.toMatch(/德语|可分动词|Konjunktiv/);
    }
  });

  it("English grammar enrichment schema keeps the German field set but uses English grammar types", () => {
    const en = GRAMMAR_ENRICHMENT_JSON_SCHEMA_EN.schema;
    const de = GRAMMAR_ENRICHMENT_JSON_SCHEMA.schema;
    expect([...en.required].sort()).toEqual([...de.required].sort());
    expect(en.properties.grammar_type.enum).toEqual([...ENGLISH_GRAMMAR_TYPE_VALUES]);
    expect(parseEnglishGrammarType("Present Perfect")).toBe("present_perfect");
    expect(parseEnglishGrammarType("konjunktiv_ii")).toBe("other");
  });

  it("English analysis reuses the same JSON shape (simple_de_explanation holds the English explanation)", () => {
    expect(ARTICLE_VOCAB_FIRST_JSON_SCHEMA.schema.properties.vocabulary.items.required).toContain(
      "simple_de_explanation",
    );
  });
});

describe("German prompts are untouched", () => {
  it("German prompt texts match the pre-English snapshot", async () => {
    await expect(
      JSON.stringify(
        {
          SYSTEM_PROMPT_VOCAB_FIRST,
          SYSTEM_PROMPT_LEGACY,
          GRAMMAR_EXPLAIN_SELECTION_SYSTEM_PROMPT,
        },
        null,
        1,
      ),
    ).toMatchFileSnapshot("./__snapshots__/german-prompts.json");
  });
});
