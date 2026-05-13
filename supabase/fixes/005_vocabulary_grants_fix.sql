-- German Reading Coach — vocabulary 表权限 + RLS（可重复执行）
--
-- 在 Supabase Dashboard → SQL Editor 中执行本文件；词汇与语法需与 006_grammar_grants_fix.sql 分别或合并执行。
--
-- 现象：客户端对已登录用户访问 vocabulary_* 报 permission denied / 42501，
-- hint 指向 GRANT —— 多为 authenticated 缺少表级 DML 权限。
--
-- 不向 anon 授予任何 vocabulary 表；不关闭 RLS；不使用 service_role。
--
-- 包含：GRANT + RLS policy 幂等重建（user_id = auth.uid()）。

-- ---------------------------------------------------------------------------
-- 表级权限：authenticated 的 SELECT/INSERT/UPDATE/DELETE
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vocabulary_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vocabulary_senses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vocabulary_occurrences TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS：保持开启，本人数据（user_id = auth.uid()）
-- ---------------------------------------------------------------------------

ALTER TABLE public.vocabulary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary_senses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary_occurrences ENABLE ROW LEVEL SECURITY;

-- vocabulary_items
DROP POLICY IF EXISTS "vocabulary_items_select_own" ON public.vocabulary_items;
DROP POLICY IF EXISTS "vocabulary_items_insert_own" ON public.vocabulary_items;
DROP POLICY IF EXISTS "vocabulary_items_update_own" ON public.vocabulary_items;
DROP POLICY IF EXISTS "vocabulary_items_delete_own" ON public.vocabulary_items;

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
DROP POLICY IF EXISTS "vocabulary_senses_select_own" ON public.vocabulary_senses;
DROP POLICY IF EXISTS "vocabulary_senses_insert_own" ON public.vocabulary_senses;
DROP POLICY IF EXISTS "vocabulary_senses_update_own" ON public.vocabulary_senses;
DROP POLICY IF EXISTS "vocabulary_senses_delete_own" ON public.vocabulary_senses;

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
DROP POLICY IF EXISTS "vocabulary_occurrences_select_own" ON public.vocabulary_occurrences;
DROP POLICY IF EXISTS "vocabulary_occurrences_insert_own" ON public.vocabulary_occurrences;
DROP POLICY IF EXISTS "vocabulary_occurrences_update_own" ON public.vocabulary_occurrences;
DROP POLICY IF EXISTS "vocabulary_occurrences_delete_own" ON public.vocabulary_occurrences;

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
