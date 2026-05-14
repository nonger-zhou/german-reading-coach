/** DB `part_of_speech`：空串参与唯一约束；兼容阅读页旧文案「用户添加」 */
export function vocabPartOfSpeechForDb(ui: string): string {
  if (!ui || ui.trim() === "" || ui === "用户添加") return "";
  return ui.trim();
}
