/** 一次「分析完成后自动写入」的计数。成功与否只看这次尝试，不删除库里已有的词。 */

export type AnalysisSaveTally = {
  vocabAttempted: number;
  vocabSaved: number;
  questionsSaved: boolean;
};

export function analysisSaveSucceeded(tally: AnalysisSaveTally): boolean {
  return tally.vocabSaved === tally.vocabAttempted && tally.questionsSaved;
}

/**
 * 阅读页「分析」按钮旁的短句。
 * 没写完时说明写上了几个，并提示重试不会再调用 AI。
 */
export function analysisSaveUserMessage(tally: AnalysisSaveTally): string {
  const failed = Math.max(0, tally.vocabAttempted - tally.vocabSaved);
  if (analysisSaveSucceeded(tally)) {
    if (tally.vocabAttempted === 0) {
      return "阅读问题已写入。这次没有新的词汇。";
    }
    return `已写入 ${tally.vocabSaved} 个词和阅读问题。`;
  }

  const retry = "点「重试保存」即可，不会再次调用 AI。";
  if (!tally.questionsSaved && failed > 0) {
    return `已写入 ${tally.vocabSaved} / ${tally.vocabAttempted} 个词。阅读问题没写上。${retry}`;
  }
  if (!tally.questionsSaved) {
    if (tally.vocabAttempted === 0) {
      return `阅读问题没写上。${retry}`;
    }
    return `词汇已写入 ${tally.vocabSaved} 个，阅读问题没写上。${retry}`;
  }
  return `已写入 ${tally.vocabSaved} / ${tally.vocabAttempted} 个词，阅读问题已写入。还有 ${failed} 个词没写上。${retry}`;
}
