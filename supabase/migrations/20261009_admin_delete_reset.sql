-- Install functions only; this migration does NOT delete existing game data.
begin;
create table if not exists public.camp_photo_cleanup (
  path text primary key,
  created_at timestamptz not null default now()
);
alter table public.camp_photo_cleanup enable row level security;
revoke all on public.camp_photo_cleanup from anon, authenticated;
grant select, delete on public.camp_photo_cleanup to authenticated;
drop policy if exists admin_cleanup on public.camp_photo_cleanup;
create policy admin_cleanup on public.camp_photo_cleanup for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.admin_delete_submissions(p_submission_ids uuid[])
returns jsonb language plpgsql volatile security definer set search_path = ''
set lock_timeout = '5s'
as $$
declare
  v_ids uuid[];
  v_games uuid[];
  v_count integer;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  -- Same order as upload/review: submissions -> figures -> games.
  -- Excludes in-flight finalization while resetting dependent rows.
  lock table public.submissions in share row exclusive mode;
  lock table public.figures in share row exclusive mode;
  lock table public.games in share row exclusive mode;
  select array_agg(id), array_agg(distinct game_id) into v_ids, v_games
    from public.submissions where id = any(p_submission_ids)
      and (upload_status in ('uploaded','failed') or review_status in ('rejected','duplicate')
        or (upload_status = 'uploading' and created_at < now() - interval '10 minutes'));
  insert into public.camp_photo_cleanup(path)
    select photo_path from public.submissions where id = any(v_ids) and photo_path is not null
    on conflict do nothing;
  update public.figures set is_found = false, found_at = null, photo_path = null,
    submission_id = null, found_by_name = null, is_verified = false
    where submission_id = any(v_ids);
  delete from public.submissions where id = any(v_ids);
  get diagnostics v_count = row_count;
  update public.games g set is_completed = not exists (
    select 1 from public.figures f where f.game_id = g.id and not f.is_found
  ) where g.id = any(v_games);
  return jsonb_build_object('ok',true,'deleted',v_count);
end;
$$;

create or replace function public.admin_reset_game(p_game_slug text, p_confirmation text)
returns jsonb language plpgsql volatile security definer set search_path = ''
set lock_timeout = '5s'
as $$
declare v_game uuid; v_count integer;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_confirmation is distinct from '重置遊戲' then raise exception 'confirmation_required' using errcode = '22023'; end if;
  lock table public.submissions in share row exclusive mode;
  lock table public.figures in share row exclusive mode;
  lock table public.games in share row exclusive mode;
  select id into v_game from public.games where slug = p_game_slug;
  if not found then raise exception 'game_not_found' using errcode = 'P0002'; end if;
  insert into public.camp_photo_cleanup(path)
    select photo_path from public.submissions where game_id = v_game and photo_path is not null
    on conflict do nothing;
  update public.figures set is_found = false, found_at = null, photo_path = null,
    submission_id = null, found_by_name = null, is_verified = false where game_id = v_game;
  delete from public.submissions where game_id = v_game;
  get diagnostics v_count = row_count;
  update public.games set is_completed = false,
    timer_status = 'idle', timer_duration_ms = null, timer_started_at = null, timer_ends_at = null,
    timer_remaining_ms = null, timer_ended_at = null, timer_end_reason = null,
    timer_version = timer_version + 1 where id = v_game;
  return jsonb_build_object('ok',true,'deleted',v_count);
end;
$$;
revoke all on function public.admin_delete_submissions(uuid[]), public.admin_reset_game(text,text) from public, anon, authenticated;
grant execute on function public.admin_delete_submissions(uuid[]), public.admin_reset_game(text,text) to authenticated;
commit;
