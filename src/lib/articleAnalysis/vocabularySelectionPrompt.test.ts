import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT } from "./openaiArticleAnalysis";

describe("openaiArticleAnalysis SYSTEM_PROMPT (d4aee6e 词汇口径 + Grammar v2)", () => {
  it("restores lexical variety and noun article guidance", () => {
    expect(SYSTEM_PROMPT).toContain("词汇推荐范围");
    expect(SYSTEM_PROMPT).toContain("可分动词");
    expect(SYSTEM_PROMPT).toContain("der / die / das");
    expect(SYSTEM_PROMPT).toContain("separable_verb");
    expect(SYSTEM_PROMPT).toContain("grammar_type");
    expect(SYSTEM_PROMPT).toContain("Grammar Analysis v2");
  });

  it("uses single-call prompt without plan-C or 05-17 patches", () => {
    expect(SYSTEM_PROMPT).not.toContain("词性多样性");
    expect(SYSTEM_PROMPT).not.toContain("不要输出 vocabulary");
    expect(SYSTEM_PROMPT).not.toContain("8–12");
    expect(SYSTEM_PROMPT).not.toContain("Step 1");
    expect(SYSTEM_PROMPT).not.toContain("轻结构化候选流程");
    expect(SYSTEM_PROMPT).not.toContain("grammar **最多 8 条**");
  });

  it("grammar and vocabulary have no fixed count cap in prompt", () => {
    expect(SYSTEM_PROMPT).toContain("grammar（语法点）：**不设固定条数上限**");
    expect(SYSTEM_PROMPT).toContain("不设固定条数上限");
  });
});
