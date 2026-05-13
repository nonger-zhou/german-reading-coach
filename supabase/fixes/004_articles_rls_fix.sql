-- German Reading Coach — articles RLS policies 幂等重建（可重复执行）
--
-- 若远程库 policies 缺失或与 user_id = auth.uid() 不一致，在 SQL Editor 执行本脚本。
-- 不关闭 RLS，不使用 service_role。

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "articles_select_own" ON public.articles;
DROP POLICY IF EXISTS "articles_insert_own" ON public.articles;
DROP POLICY IF EXISTS "articles_update_own" ON public.articles;
DROP POLICY IF EXISTS "articles_delete_own" ON public.articles;

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
