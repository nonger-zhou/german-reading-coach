function isRecord(e: unknown): e is Record<string, unknown> {
  return typeof e === "object" && e !== null;
}

/**
 * 将 Supabase PostgREST / 服务端返回的错误格式化为可读文本（含 message、code、hint、details，避免 `[object Object]`）。
 */
export function formatSupabaseOrUnknownError(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  if (isRecord(e)) {
    const msg = e.message;
    const lines: string[] = [];
    if (typeof msg === "string" && msg.length > 0) {
      lines.push(msg);
    }
    const code = e.code;
    if (typeof code === "string" && code.length > 0) {
      lines.push(`code: ${code}`);
    }
    const hint = e.hint;
    if (typeof hint === "string" && hint.length > 0) {
      lines.push(`hint: ${hint}`);
    }
    const details = e.details;
    if (typeof details === "string" && details.length > 0) {
      lines.push(`details: ${details}`);
    }
    if (lines.length > 0) {
      return lines.join("\n");
    }
    try {
      return JSON.stringify(e, null, 2);
    } catch {
      return String(e);
    }
  }
  try {
    return JSON.stringify(e, null, 2);
  } catch {
    return String(e);
  }
}
