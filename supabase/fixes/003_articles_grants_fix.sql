-- German Reading Coach — articles 表级权限（可重复执行）
--
-- 若已登录插入/查询 articles 仍报 permission denied / 42501，且 hint 指向 GRANT，
-- 说明 RLS 已配置但 authenticated 缺少对 public.articles 的基础 DML 权限。
--
-- 不向 anon 授予 articles；不关 RLS；不涉及 service_role。

GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles TO authenticated;
