/**
 * 合并写入 `vocabulary_items.lemma`：历史上曾把 lemma 误写成 display_word；
 * 若新 AI 给出带 der/die/das 的词典形，应覆盖仅含句中形式的旧值。
 */
export function mergeLemmaForVocabularyPersist(
  existingLemma: string | null | undefined,
  incomingLemma: string,
  displayWord: string,
): string {
  const inc = (incomingLemma ?? "").trim();
  const ex = (existingLemma ?? "").trim();
  const disp = (displayWord ?? "").trim();
  if (!inc && !ex) return disp;
  if (!inc) return ex || disp;
  if (!ex) return inc;
  if (ex === disp && inc !== disp) return inc;
  const articleLead = (s: string) => /^(der|die|das|ein|eine)\b/i.test(s);
  if (articleLead(inc) && !articleLead(ex)) return inc;
  if (articleLead(inc) && articleLead(ex)) return inc;
  return inc.length > ex.length ? inc : ex;
}
