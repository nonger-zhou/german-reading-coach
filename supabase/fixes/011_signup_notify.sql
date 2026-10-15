-- 011：新用户注册时通知站长（可选功能）
--
-- 原理：auth.users 每新增一行，触发器用 pg_net 异步 POST 到线上 /api/hooks/new-user，
-- 由该接口通过 Resend 发邮件。pg_net 是异步的，接口失败也不会影响用户注册。
--
-- 使用前：
-- 1. Vercel Production 已配置 RESEND_API_KEY、SIGNUP_NOTIFY_TO、SIGNUP_WEBHOOK_SECRET，并已部署含该接口的版本；
-- 2. 把下面「把密钥粘贴在这里」替换成与 SIGNUP_WEBHOOK_SECRET 完全相同的字符串（保留两边的单引号）；
-- 3. 在 Supabase → SQL Editor 中整段执行。可重复执行。
--
-- 关闭通知：drop trigger if exists on_auth_user_created_notify on auth.users;

create extension if not exists pg_net;

create or replace function public.notify_new_user_signup()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net
as $$
begin
  begin
    perform net.http_post(
      url := 'https://german-reading-coach.vercel.app/api/hooks/new-user',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', '把密钥粘贴在这里'
      ),
      body := jsonb_build_object(
        'id', new.id,
        'email', new.email,
        'created_at', new.created_at,
        'provider', new.raw_app_meta_data ->> 'provider'
      )
    );
  exception when others then
    -- 通知失败绝不能阻止注册
    raise warning 'notify_new_user_signup failed: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.notify_new_user_signup() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_notify on auth.users;
create trigger on_auth_user_created_notify
  after insert on auth.users
  for each row execute function public.notify_new_user_signup();

-- 检查：应返回一行
-- select tgname from pg_trigger where tgname = 'on_auth_user_created_notify';
-- 查看最近的发送结果（status_code 200 表示接口收到并发出邮件）：
-- select id, status_code, content, created from net._http_response order by created desc limit 5;
