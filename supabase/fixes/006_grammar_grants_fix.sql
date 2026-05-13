-- German Reading Coach — grammar 表权限 + RLS（可重复执行）
--
-- 现象：客户端对已登录用户访问 grammar_* 报 permission denied / 42501，
-- hint 指向 GRANT —— 多为 authenticated 缺少表级 DML 权限。
--
-- 不向 anon 授予任何 grammar 表；不关闭 RLS；不使用 service_role。
--
-- 包含：GRANT + RLS policy 幂等重建（user_id = auth.uid()）。

-- ---------------------------------------------------------------------------
-- 表级权限：authenticated 的 SELECT/INSERT/UPDATE/DELETE
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grammar_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grammar_occurrences TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS：保持开启，本人数据（user_id = auth.uid()）
-- ---------------------------------------------------------------------------

ALTER TABLE public.grammar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grammar_occurrences ENABLE ROW LEVEL SECURITY;

-- grammar_items
DROP POLICY IF EXISTS "grammar_items_select_own" ON public.grammar_items;
DROP POLICY IF EXISTS "grammar_items_insert_own" ON public.grammar_items;
DROP POLICY IF EXISTS "grammar_items_update_own" ON public.grammar_items;
DROP POLICY IF EXISTS "grammar_items_delete_own" ON public.grammar_items;

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
DROP POLICY IF EXISTS "grammar_occurrences_select_own" ON public.grammar_occurrences;
DROP POLICY IF EXISTS "grammar_occurrences_insert_own" ON public.grammar_occurrences;
DROP POLICY IF EXISTS "grammar_occurrences_update_own" ON public.grammar_occurrences;
DROP POLICY IF EXISTS "grammar_occurrences_delete_own" ON public.grammar_occurrences;

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
