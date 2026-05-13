/** 与 DB 唯一键 (user_id, normalized_key, part_of_speech) 对齐：null 与空串视为同一档（旧数据 / 用户添加） */
export function sameVocabPartOfSpeechForUnique(
  db: string | null | undefined,
  uiPos: string,
): boolean {
  const d = db == null ? "" : String(db).trim();
  const u = (uiPos ?? "").trim();
  return d === u;
}

export function isPostgresUniqueViolation(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const o = e as { code?: unknown; message?: unknown };
  return (
    o.code === "23505" ||
    (typeof o.message === "string" &&
      o.message.includes("vocabulary_items_user_norm_pos_unique"))
  );
}
