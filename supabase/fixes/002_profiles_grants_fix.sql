-- German Reading Coach — profiles 表级权限（可重复执行）
--
-- 现象：RLS policy 已存在，但已登录用户仍报
--   permission denied for table profiles / 42501
--   hint: GRANT SELECT ON public.profiles TO authenticated;
-- 原因：PostgreSQL 在 RLS 之前还要求角色对表具备基础 DML 权限。
--
-- 本脚本仅为 authenticated 授予 public.profiles 的 DML，不授予 anon（profiles 仅登录用户可访问）。
-- 不关闭 RLS，不涉及 service_role。

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
