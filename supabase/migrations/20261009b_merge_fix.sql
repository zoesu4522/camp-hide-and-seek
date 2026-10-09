-- =====================================================================
-- 2026-10-09 整合修正（在 Supabase SQL Editor 執行一次即可，不會刪除任何遊戲資料）
--
-- 1. 還原 admin_delete_submissions 為 camp_photo_cleanup 版本
--    （先前被另一個版本覆蓋，刪除照片時沒有排入待清除清單）
-- 2. admin_reset_game(text, text)：重置時 round + 1（玩家只收到一次「遊戲已重置」）
-- 3. 移除多餘的 admin_reset_game(text)（沒有確認文字的版本）
-- 4. start_submission：遊戲開始前 / 3-2-1 / 暫停中不能上傳（已在正式資料庫生效，這裡再套用一次確保一致）
-- =====================================================================
begin;

alter table public.games add column if not exists round integer not null default 0;

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
    timer_version = timer_version + 1, round = round + 1 where id = v_game;
  return jsonb_build_object('ok',true,'deleted',v_count);
end;
$$;

create or replace function public.start_submission(
  p_game_slug     text,
  p_figure_number integer,
  p_player_id     text,
  p_player_name   text,
  p_photo_bytes   integer default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_game   public.games%rowtype;
  v_figure public.figures%rowtype;
  v_id     uuid := gen_random_uuid();
  v_path   text;
  v_recent integer;
  v_name   text := nullif(left(regexp_replace(trim(coalesce(p_player_name, '')), '[[:cntrl:]]', '', 'g'), 20), '');
begin
  select * into v_game from public.games where slug = p_game_slug;
  if not found then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;

  select * into v_figure from public.figures where game_id = v_game.id and number = p_figure_number;
  if not found then
    raise exception 'figure_not_found' using errcode = 'P0002';
  end if;

  -- 遊戲還沒開始（管理員還沒按開始、或正在 3-2-1）不能回報；暫停中也不行
  if v_game.timer_status = 'idle' or (v_game.timer_status = 'running' and now() < v_game.timer_started_at) then
    raise exception 'not_started' using errcode = 'P0001';
  end if;
  if v_game.timer_status = 'paused' then
    raise exception 'paused' using errcode = 'P0001';
  end if;

  -- 倒數結束後不能再回報（3 秒緩衝給剛好按下的人）
  if (v_game.timer_status = 'running' and now() > v_game.timer_ends_at + interval '3 seconds')
     or (v_game.timer_status = 'ended' and v_game.timer_end_reason in ('manual', 'time_up')) then
    raise exception 'time_up' using errcode = 'P0001';
  end if;

  if p_player_id is null or p_player_id !~ '^[A-Za-z0-9_-]{1,32}$' then
    raise exception 'invalid_player_id' using errcode = '22023';
  end if;

  -- 簡單防洗版：同一位玩家 1 分鐘內最多 10 筆
  select count(*) into v_recent from public.submissions
  where game_id = v_game.id and player_id = p_player_id and created_at > now() - interval '1 minute';
  if v_recent >= 10 then
    raise exception 'rate_limited' using errcode = '53400';
  end if;

  v_path := format('games/%s/%s/%s.jpg', v_game.slug, v_figure.number, v_id);

  insert into public.submissions (id, game_id, figure_id, figure_number, player_id, player_name, photo_path, photo_bytes)
  values (v_id, v_game.id, v_figure.id, v_figure.number, p_player_id, v_name, v_path, p_photo_bytes);

  return jsonb_build_object(
    'submission_id', v_id,
    'photo_path', v_path,
    'already_found', v_figure.is_found
  );
end;
$$;

drop function if exists public.admin_reset_game(text);

revoke all on function public.admin_delete_submissions(uuid[]), public.admin_reset_game(text,text) from public, anon, authenticated;
grant execute on function public.admin_delete_submissions(uuid[]), public.admin_reset_game(text,text) to authenticated;

commit;
