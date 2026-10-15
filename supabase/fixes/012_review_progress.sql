-- 012：复习进度存入数据库（可重复执行）
--
-- 之前复习排期（Leitner 盒子 + 下次复习时间）只存在浏览器 localStorage，换设备从头开始。
-- 本表按「用户 + 词条」存一行排期；德语 / 英语天然分开（词条本身带 language）。
--
-- 未执行本文件时，复习页自动退回原来的浏览器存储，功能照常。
-- 执行后，复习页第一次打开时会把本浏览器里已有的排期自动搬进本表。
--
-- 不改 vocabulary_items（避免更新 updated_at 影响词库的时间分组）；不向 anon 授权；不关闭 RLS。

create table if not exists public.vocabulary_review_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  vocabulary_item_id uuid not null references public.vocabulary_items (id) on delete cascade,
  box smallint not null check (box between 1 and 10),
  due_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, vocabulary_item_id)
);

create index if not exists vocabulary_review_progress_item_idx
  on public.vocabulary_review_progress (vocabulary_item_id);

grant select, insert, update, delete on public.vocabulary_review_progress to authenticated;

alter table public.vocabulary_review_progress enable row level security;

drop policy if exists "vocabulary_review_progress_select_own" on public.vocabulary_review_progress;
drop policy if exists "vocabulary_review_progress_insert_own" on public.vocabulary_review_progress;
drop policy if exists "vocabulary_review_progress_update_own" on public.vocabulary_review_progress;
drop policy if exists "vocabulary_review_progress_delete_own" on public.vocabulary_review_progress;

create policy "vocabulary_review_progress_select_own"
  on public.vocabulary_review_progress for select
  using (user_id = auth.uid());

create policy "vocabulary_review_progress_insert_own"
  on public.vocabulary_review_progress for insert
  with check (user_id = auth.uid());

create policy "vocabulary_review_progress_update_own"
  on public.vocabulary_review_progress for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "vocabulary_review_progress_delete_own"
  on public.vocabulary_review_progress for delete
  using (user_id = auth.uid());

-- 检查：应返回 0（新表）或已有行数
-- select count(*) from public.vocabulary_review_progress;
