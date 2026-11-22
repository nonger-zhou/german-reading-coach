-- 013：iPhone 分享保存（导入令牌 + 手机收件箱）（可重复执行）
--
-- 1. import_tokens：iPhone 快捷指令用的「个人导入令牌」。只存 SHA-256 摘要，不存令牌原文；
--    令牌在浏览器里生成、只显示一次；可作废。
-- 2. clip_inbox：手机收件箱。分享时提取不完整或失败的文章先放这里（保留标题、链接、已提取的部分），
--    不进文章列表；用户在 /import 顶部补全后再保存，或删除。
-- 3. 两个 security definer 函数（供 /api/clip 用公开 anon key 调用，凭令牌识别用户）：
--    clip_resolve_token(令牌) → 用户 id（无效返回 null）
--    clip_ingest(令牌, …)     → 存为文章（完整）或放入收件箱（不完整 / 失败）
--    这样服务器不需要 service role key；函数只接受有效令牌，且只写该令牌所属用户的数据。
--
-- 按 2026-10-30 起的 Supabase 规则：新表在同一文件里显式 GRANT；不向 anon 授予任何表权限。
-- 不改动已有表结构（articles / profiles 只读写已有列）。

-- 1) 导入令牌 -------------------------------------------------------------------
create table if not exists public.import_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists import_tokens_user_idx on public.import_tokens (user_id);

grant select, insert, update, delete on public.import_tokens to authenticated;
grant select, insert, update, delete on public.import_tokens to service_role;

alter table public.import_tokens enable row level security;

drop policy if exists "import_tokens_select_own" on public.import_tokens;
drop policy if exists "import_tokens_insert_own" on public.import_tokens;
drop policy if exists "import_tokens_update_own" on public.import_tokens;
drop policy if exists "import_tokens_delete_own" on public.import_tokens;

create policy "import_tokens_select_own" on public.import_tokens
  for select using (user_id = auth.uid());
create policy "import_tokens_insert_own" on public.import_tokens
  for insert with check (user_id = auth.uid());
create policy "import_tokens_update_own" on public.import_tokens
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "import_tokens_delete_own" on public.import_tokens
  for delete using (user_id = auth.uid());

-- 2) 手机收件箱 -----------------------------------------------------------------
create table if not exists public.clip_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  url text,
  source_name text,
  published_at_text text,
  /** 已提取到的部分正文（可能为空） */
  extracted_text text,
  word_count integer not null default 0,
  status text not null check (status in ('partial', 'failed')),
  /** [{code, message}]：为什么判定不完整 */
  reasons jsonb not null default '[]'::jsonb,
  /** page = iPhone Safari 页面上提取；server = 服务器按网址抓取 */
  via text not null check (via in ('page', 'server')),
  language text check (language in ('de', 'en')),
  created_at timestamptz not null default now()
);

create index if not exists clip_inbox_user_created_idx
  on public.clip_inbox (user_id, created_at desc);

-- 收件箱只由 clip_ingest 写入；用户可查看、删除（补全保存后删除）
grant select, update, delete on public.clip_inbox to authenticated;
grant select, insert, update, delete on public.clip_inbox to service_role;

alter table public.clip_inbox enable row level security;

drop policy if exists "clip_inbox_select_own" on public.clip_inbox;
drop policy if exists "clip_inbox_update_own" on public.clip_inbox;
drop policy if exists "clip_inbox_delete_own" on public.clip_inbox;

create policy "clip_inbox_select_own" on public.clip_inbox
  for select using (user_id = auth.uid());
create policy "clip_inbox_update_own" on public.clip_inbox
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "clip_inbox_delete_own" on public.clip_inbox
  for delete using (user_id = auth.uid());

-- 3) 函数 ------------------------------------------------------------------------
create or replace function public.clip_resolve_token(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  v_user uuid;
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 200 then
    return null;
  end if;
  v_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  select user_id into v_user
    from public.import_tokens
   where token_hash = v_hash and revoked_at is null;
  if v_user is not null then
    update public.import_tokens set last_used_at = now() where token_hash = v_hash;
  end if;
  return v_user;
end;
$$;

create or replace function public.clip_ingest(
  p_token text,
  p_kind text,              -- 'article' | 'inbox'
  p_title text,
  p_url text,
  p_source_name text,
  p_published_at_text text,
  p_text text,
  p_language text,
  p_status text,            -- inbox：'partial' | 'failed'
  p_reasons jsonb,
  p_via text,               -- 'page' | 'server'
  p_word_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid;
  v_lang text := case when p_language = 'en' then 'en' else 'de' end;
  v_level text;
  v_id uuid;
begin
  v_user := public.clip_resolve_token(p_token);
  if v_user is null then
    raise exception 'invalid_import_token' using errcode = '28000';
  end if;

  if p_kind = 'article' then
    if coalesce(length(trim(p_text)), 0) < 120 then
      raise exception 'empty_article_text' using errcode = '22023';
    end if;
    select case when v_lang = 'en' then self_selected_level_en else self_selected_level end
      into v_level
      from public.profiles where id = v_user;
    if v_level is null or v_level not in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2') then
      v_level := 'B1';
    end if;

    insert into public.articles (
      user_id, title, url, source_name, original_text, user_level_at_analysis, language,
      topic, summary_zh, summary_de_simple, detected_article_level
    ) values (
      v_user,
      nullif(left(trim(coalesce(p_title, '')), 500), ''),
      nullif(left(trim(coalesce(p_url, '')), 2000), ''),
      nullif(left(trim(coalesce(p_source_name, '')), 200), ''),
      left(p_text, 200000),
      v_level,
      v_lang,
      null, null, null, null
    )
    returning id into v_id;

    -- 同一链接之前没存全、这次存全了：从收件箱移除
    if coalesce(trim(p_url), '') <> '' then
      delete from public.clip_inbox where user_id = v_user and url = trim(p_url);
    end if;

    return jsonb_build_object('kind', 'article', 'id', v_id, 'language', v_lang);
  end if;

  -- 同一链接只保留最新一条
  if coalesce(trim(p_url), '') <> '' then
    delete from public.clip_inbox where user_id = v_user and url = trim(p_url);
  end if;

  insert into public.clip_inbox (
    user_id, title, url, source_name, published_at_text, extracted_text, word_count,
    status, reasons, via, language
  ) values (
    v_user,
    nullif(left(trim(coalesce(p_title, '')), 500), ''),
    nullif(left(trim(coalesce(p_url, '')), 2000), ''),
    nullif(left(trim(coalesce(p_source_name, '')), 200), ''),
    nullif(left(trim(coalesce(p_published_at_text, '')), 200), ''),
    nullif(left(coalesce(p_text, ''), 200000), ''),
    greatest(coalesce(p_word_count, 0), 0),
    case when p_status = 'failed' then 'failed' else 'partial' end,
    coalesce(p_reasons, '[]'::jsonb),
    case when p_via = 'server' then 'server' else 'page' end,
    v_lang
  )
  returning id into v_id;

  return jsonb_build_object('kind', 'inbox', 'id', v_id, 'language', v_lang);
end;
$$;

-- 只允许通过 API 调用这两个函数（anon = 快捷指令请求经服务器转发；令牌是唯一凭证）
revoke all on function public.clip_resolve_token(text) from public;
revoke all on function public.clip_ingest(text, text, text, text, text, text, text, text, text, jsonb, text, integer) from public;
grant execute on function public.clip_resolve_token(text) to anon, authenticated, service_role;
grant execute on function public.clip_ingest(text, text, text, text, text, text, text, text, text, jsonb, text, integer) to anon, authenticated, service_role;

-- 检查：
-- select count(*) from public.import_tokens;   -- 新表应为 0
-- select count(*) from public.clip_inbox;      -- 新表应为 0
-- select public.clip_resolve_token('x');       -- 应返回 null
