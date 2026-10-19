-- Optional accounts: one backup of each learner's progress.
-- Run once in Supabase → SQL Editor → New query → paste → Run.
--
-- Only the signed-in user can read or change their own row (row level security).
-- Deleting the account (from the app) deletes the row too.

create table if not exists public.user_progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  progress   jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_progress enable row level security;

drop policy if exists "own progress: read"   on public.user_progress;
drop policy if exists "own progress: insert" on public.user_progress;
drop policy if exists "own progress: update" on public.user_progress;
drop policy if exists "own progress: delete" on public.user_progress;
create policy "own progress: read"   on public.user_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "own progress: insert" on public.user_progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own progress: update" on public.user_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own progress: delete" on public.user_progress for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_progress to authenticated;
revoke all on public.user_progress from anon;

-- "Delete my account" in the app: removes the login and (via the cascade) the saved progress.
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
