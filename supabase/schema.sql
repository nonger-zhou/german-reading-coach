-- German Reading Coach — PostgreSQL schema for Supabase
-- Phase 2: 在 Supabase SQL Editor 或 CLI 中执行；尚未与前端连接。
-- 依赖：Supabase 默认启用 pgcrypto（gen_random_uuid）。

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  display_name text,
  self_selected_level text,
  estimated_reading_level text,
  explanation_intensity text,
  explanation_language text,
  auto_play_pronunciation_on_click boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text,
  url text,
  source_name text,
  original_text text,
  summary_zh text,
  summary_de_simple text,
  reading_questions jsonb DEFAULT '[]'::jsonb,
  user_level_at_analysis text,
  detected_article_level text,
  topic text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vocabulary_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  lemma text,
  display_word text,
  normalized_key text NOT NULL,
  part_of_speech text NOT NULL DEFAULT '',
  gender text,
  plural text,
  level_estimate text,
  zh_meaning text,
  simple_de_explanation text,
  mastery_status text NOT NULL DEFAULT 'new',
  source text,
  source_detail text,
  needs_ai_enrichment boolean NOT NULL DEFAULT false,
  user_deep_note text,
  user_deep_note_updated_at timestamptz,
  encounter_count integer NOT NULL DEFAULT 0,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vocabulary_items_user_norm_pos_unique UNIQUE (user_id, normalized_key, part_of_speech)
);

CREATE TABLE public.vocabulary_senses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  vocabulary_item_id uuid NOT NULL REFERENCES public.vocabulary_items (id) ON DELETE CASCADE,
  zh_meaning text,
  simple_de_explanation text,
  domain text,
  example_sentence text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vocabulary_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  vocabulary_item_id uuid NOT NULL REFERENCES public.vocabulary_items (id) ON DELETE CASCADE,
  vocabulary_sense_id uuid REFERENCES public.vocabulary_senses (id) ON DELETE SET NULL,
  article_id uuid NOT NULL REFERENCES public.articles (id) ON DELETE CASCADE,
  surface_form text,
  sentence text,
  paragraph_index integer,
  start_offset integer,
  end_offset integer,
  fallback_match_text text,
  source text,
  importance_for_article text,
  explanation_priority text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.grammar_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  grammar_key text NOT NULL,
  normalized_key text NOT NULL,
  name_de text,
  name_zh text,
  level_estimate text,
  explanation_zh text,
  explanation_de_simple text,
  mastery_status text NOT NULL DEFAULT 'new',
  source text,
  needs_ai_enrichment boolean NOT NULL DEFAULT false,
  user_deep_note text,
  user_deep_note_updated_at timestamptz,
  encounter_count integer NOT NULL DEFAULT 0,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grammar_items_user_key_norm_unique UNIQUE (user_id, grammar_key, normalized_key)
);

CREATE TABLE public.grammar_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  grammar_item_id uuid NOT NULL REFERENCES public.grammar_items (id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.articles (id) ON DELETE CASCADE,
  selected_text text,
  sentence text,
  paragraph_index integer,
  start_offset integer,
  end_offset integer,
  fallback_match_text text,
  complexity_variant text,
  source text,
  importance_for_article text,
  explanation_priority text,
  explanation_in_context_zh text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX articles_user_id_created_at_idx ON public.articles (user_id, created_at DESC);

CREATE INDEX vocabulary_items_user_id_normalized_key_idx ON public.vocabulary_items (user_id, normalized_key);

CREATE INDEX vocabulary_items_user_id_mastery_status_idx ON public.vocabulary_items (user_id, mastery_status);

CREATE INDEX vocabulary_occurrences_user_id_article_id_idx ON public.vocabulary_occurrences (user_id, article_id);

CREATE INDEX vocabulary_occurrences_vocabulary_item_id_idx ON public.vocabulary_occurrences (vocabulary_item_id);

CREATE INDEX grammar_items_user_id_grammar_key_idx ON public.grammar_items (user_id, grammar_key);

CREATE INDEX grammar_items_user_id_mastery_status_idx ON public.grammar_items (user_id, mastery_status);

CREATE INDEX grammar_occurrences_user_id_article_id_idx ON public.grammar_occurrences (user_id, article_id);

CREATE INDEX grammar_occurrences_grammar_item_id_idx ON public.grammar_occurrences (grammar_item_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER articles_set_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER vocabulary_items_set_updated_at
  BEFORE UPDATE ON public.vocabulary_items
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER vocabulary_senses_set_updated_at
  BEFORE UPDATE ON public.vocabulary_senses
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER grammar_items_set_updated_at
  BEFORE UPDATE ON public.grammar_items
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary_senses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grammar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grammar_occurrences ENABLE ROW LEVEL SECURITY;

-- profiles: 仅本人（id = auth.uid()）；upsert 需同时具备 insert + update 策略。
-- 已部署项目若 policy 异常，可重复执行 supabase/fixes/001_profiles_rls_fix.sql
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_delete_own"
  ON public.profiles FOR DELETE
  USING (id = auth.uid());

-- 表级权限（与 RLS 并存）：authenticated 必须对表有 DML 权限，否则即使用户 JWT 通过 RLS 仍会 42501。
-- 不向 anon 授予 profiles（仅登录用户读写；未登录的 /settings/supabase-test 对 profiles 的探测仍预期被拒）。
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- articles（policy 异常时可重复执行 supabase/fixes/004_articles_rls_fix.sql）
CREATE POLICY "articles_select_own"
  ON public.articles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "articles_insert_own"
  ON public.articles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "articles_update_own"
  ON public.articles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "articles_delete_own"
  ON public.articles FOR DELETE
  USING (user_id = auth.uid());

-- 表级权限（与 RLS 并存）：不向 anon 授予 articles。
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles TO authenticated;

-- vocabulary_items
CREATE POLICY "vocabulary_items_select_own"
  ON public.vocabulary_items FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "vocabulary_items_insert_own"
  ON public.vocabulary_items FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "vocabulary_items_update_own"
  ON public.vocabulary_items FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "vocabulary_items_delete_own"
  ON public.vocabulary_items FOR DELETE
  USING (user_id = auth.uid());

-- vocabulary_senses
CREATE POLICY "vocabulary_senses_select_own"
  ON public.vocabulary_senses FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "vocabulary_senses_insert_own"
  ON public.vocabulary_senses FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "vocabulary_senses_update_own"
  ON public.vocabulary_senses FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "vocabulary_senses_delete_own"
  ON public.vocabulary_senses FOR DELETE
  USING (user_id = auth.uid());

-- vocabulary_occurrences
CREATE POLICY "vocabulary_occurrences_select_own"
  ON public.vocabulary_occurrences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "vocabulary_occurrences_insert_own"
  ON public.vocabulary_occurrences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "vocabulary_occurrences_update_own"
  ON public.vocabulary_occurrences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "vocabulary_occurrences_delete_own"
  ON public.vocabulary_occurrences FOR DELETE
  USING (user_id = auth.uid());

-- grammar_items
CREATE POLICY "grammar_items_select_own"
  ON public.grammar_items FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "grammar_items_insert_own"
  ON public.grammar_items FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "grammar_items_update_own"
  ON public.grammar_items FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "grammar_items_delete_own"
  ON public.grammar_items FOR DELETE
  USING (user_id = auth.uid());

-- grammar_occurrences
CREATE POLICY "grammar_occurrences_select_own"
  ON public.grammar_occurrences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "grammar_occurrences_insert_own"
  ON public.grammar_occurrences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "grammar_occurrences_update_own"
  ON public.grammar_occurrences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "grammar_occurrences_delete_own"
  ON public.grammar_occurrences FOR DELETE
  USING (user_id = auth.uid());

-- 表级权限（与 RLS 并存）：authenticated 必须对 vocabulary_* / grammar_* 有 DML，否则 RLS 通过仍可能 42501。
-- 新建库请一并执行；已部署库若缺权限可重复执行 supabase/fixes/005_vocabulary_grants_fix.sql、006_grammar_grants_fix.sql。
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vocabulary_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vocabulary_senses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vocabulary_occurrences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grammar_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grammar_occurrences TO authenticated;