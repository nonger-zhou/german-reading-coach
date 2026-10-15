/** 整文分析是否使用 legacy（含自动 grammar + 摘要）路径。默认 false。 */
export function isLegacyAutoGrammarAnalysisEnabled(): boolean {
  const v = process.env.ENABLE_AUTO_GRAMMAR_ANALYSIS?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
