import { describe, expect, it } from "vitest";
import {
  SYSTEM_PROMPT_LEGACY,
  SYSTEM_PROMPT_VOCAB_FIRST,
} from "./openaiArticleAnalysis";

describe("vocab-first production SYSTEM_PROMPT", () => {
  it("includes minimal B vocabulary task and short reading questions", () => {
    expect(SYSTEM_PROMPT_VOCAB_FIRST).toContain("reading-learning value");
    expect(SYSTEM_PROMPT_VOCAB_FIRST).toContain("balanced mix");
    expect(SYSTEM_PROMPT_VOCAB_FIRST).toContain("【reading_questions】");
    expect(SYSTEM_PROMPT_VOCAB_FIRST).toContain("恰好 3 条");
  });

  it("does not include Grammar v2 or Reset v1 vocabulary section title", () => {
    expect(SYSTEM_PROMPT_VOCAB_FIRST).not.toContain("Grammar Analysis v2");
    expect(SYSTEM_PROMPT_VOCAB_FIRST).not.toContain(
      "【vocabulary — 阅读学习词汇】",
    );
    expect(SYSTEM_PROMPT_VOCAB_FIRST).not.toContain("grammar 每条输出");
  });
});

describe("legacy SYSTEM_PROMPT", () => {
  it("still includes Grammar v2 for ENABLE_AUTO_GRAMMAR_ANALYSIS", () => {
    expect(SYSTEM_PROMPT_LEGACY).toContain("Grammar Analysis v2");
    expect(SYSTEM_PROMPT_LEGACY).toContain("【vocabulary — 阅读学习词汇】");
  });
});
