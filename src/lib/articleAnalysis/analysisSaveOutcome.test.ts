import { describe, expect, it } from "vitest";
import {
  analysisSaveSucceeded,
  analysisSaveUserMessage,
} from "./analysisSaveOutcome";

describe("analysisSaveUserMessage", () => {
  it("says words and questions were written when everything succeeded", () => {
    const tally = { vocabAttempted: 8, vocabSaved: 8, questionsSaved: true };
    expect(analysisSaveSucceeded(tally)).toBe(true);
    expect(analysisSaveUserMessage(tally)).toBe("已写入 8 个词和阅读问题。");
  });

  it("allows a result with no vocabulary", () => {
    const tally = { vocabAttempted: 0, vocabSaved: 0, questionsSaved: true };
    expect(analysisSaveSucceeded(tally)).toBe(true);
    expect(analysisSaveUserMessage(tally)).toContain("没有新的词汇");
  });

  it("counts a partial vocabulary write and offers a retry that does not call AI", () => {
    const tally = { vocabAttempted: 8, vocabSaved: 3, questionsSaved: true };
    expect(analysisSaveSucceeded(tally)).toBe(false);
    const message = analysisSaveUserMessage(tally);
    expect(message).toContain("已写入 3 / 8 个词");
    expect(message).toContain("阅读问题已写入");
    expect(message).toContain("不会再次调用 AI");
  });

  it("mentions questions when they fail after some words were saved", () => {
    const message = analysisSaveUserMessage({
      vocabAttempted: 4,
      vocabSaved: 4,
      questionsSaved: false,
    });
    expect(message).toContain("词汇已写入 4 个");
    expect(message).toContain("阅读问题没写上");
    expect(message).toContain("重试保存");
  });

  it("reports zero words when nothing was written", () => {
    const message = analysisSaveUserMessage({
      vocabAttempted: 5,
      vocabSaved: 0,
      questionsSaved: false,
    });
    expect(message).toContain("已写入 0 / 5 个词");
    expect(message).toContain("阅读问题没写上");
  });
});
