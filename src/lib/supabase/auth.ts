import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** 新建 profile 时的默认值（与 /account 需求一致） */
export const DEFAULT_PROFILE_VALUES = {
  self_selected_level: "B1",
  estimated_reading_level: "B1-B2",
  explanation_language: "zh",
  explanation_intensity: "medium",
  auto_play_pronunciation_on_click: false,
} as const;

export type UserProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  self_selected_level: string | null;
  estimated_reading_level: string | null;
  explanation_intensity: string | null;
  explanation_language: string | null;
  auto_play_pronunciation_on_click: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * 读取或创建当前用户的 profile（RLS + anon JWT）。
 * 1) select + maybeSingle
 * 2) 若不存在则 upsert（onConflict: id），再 select 单行返回
 */
export async function ensureUserProfile(user: User): Promise<{
  profile: UserProfileRow;
  created: boolean;
}> {
  const supabase = getSupabaseBrowserClient();

  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    return { profile: existing as UserProfileRow, created: false };
  }

  const payload = {
    id: user.id,
    email: user.email ?? null,
    ...DEFAULT_PROFILE_VALUES,
  };

  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" });

  if (upsertError) {
    throw upsertError;
  }

  const { data: row, error: afterError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (afterError) {
    throw afterError;
  }

  return { profile: row as UserProfileRow, created: true };
}
