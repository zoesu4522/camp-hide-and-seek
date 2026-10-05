-- =====================================================================
-- Camp Hide & Seek / 露營躲貓貓 — Supabase schema
--
-- 使用方式：Supabase Dashboard → SQL Editor → New query → 貼上整份 → Run
-- 可以重複執行（idempotent），不會清掉已有資料。
--
-- 內容：
--   1. tables：games / figures / submissions / admin_users
--   2. updated_at trigger、constraints、index
--   3. Storage bucket：figure-photos（公開讀取、匿名只能上傳到自己剛建立的投稿路徑）
--   4. RLS：玩家只能讀 games / figures；投稿紀錄只有管理員能讀；所有寫入都走 RPC
--   5. RPC：start_submission / mark_submission_failed / submit_figure_found（玩家）
--           is_admin / is_admin_email / review_submission（後台）
--   6. Realtime：games（倒數計時）、figures、submissions
--   8. 倒數計時：admin_timer（後台控制）/ server_now（校正玩家手機時間）
--   7. seed：camp-hide-and-seek + 8 個小人
--
-- ⚠️ 最下面要把管理員 Email 換成你的（admin_users）
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
create table if not exists public.games (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  is_completed boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.figures (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references public.games(id) on delete cascade,
  number        integer not null check (number between 1 and 99),
  is_found      boolean not null default false,
  found_at      timestamptz,
  photo_path    text,
  submission_id uuid,
  found_by_name text,
  is_verified   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint figures_game_number_key unique (game_id, number),
  constraint figures_found_consistency check (
    (is_found and found_at is not null) or (not is_found and found_at is null and not is_verified)
  )
);

create table if not exists public.submissions (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references public.games(id) on delete cascade,
  figure_id     uuid not null references public.figures(id) on delete cascade,
  figure_number integer not null,
  player_id     text not null check (char_length(player_id) between 1 and 32),
  player_name   text check (player_name is null or char_length(player_name) between 1 and 20),
  photo_path    text not null unique,
  photo_bytes   integer check (photo_bytes is null or photo_bytes between 0 and 10485760),
  upload_status text not null default 'uploading'
                check (upload_status in ('uploading', 'uploaded', 'failed')),
  upload_error  text check (upload_error is null or char_length(upload_error) <= 300),
  review_status text not null default 'none'
                check (review_status in ('none', 'active', 'approved', 'rejected', 'duplicate')),
  reviewed_at   timestamptz,
  reviewed_by   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'figures_submission_id_fkey') then
    alter table public.figures
      add constraint figures_submission_id_fkey
      foreign key (submission_id) references public.submissions(id) on delete set null;
  end if;
end $$;

-- 舊版資料庫升級：補上玩家名稱欄位
alter table public.submissions add column if not exists player_name text
  check (player_name is null or char_length(player_name) between 1 and 20);
alter table public.figures add column if not exists found_by_name text;

-- 倒數計時（管理員設定，所有玩家透過 Realtime 同步）
--   timer_status：idle 未開始 / running 倒數中 / paused 暫停 / ended 已結束
--   running 時以 timer_ends_at 為準；timer_started_at 是「GO」的時間（比按下開始晚 3 秒，用來播 3-2-1）
--   running 且 now() > timer_ends_at 即為「時間到」
alter table public.games add column if not exists timer_status text not null default 'idle'
  check (timer_status in ('idle', 'running', 'paused', 'ended'));
alter table public.games add column if not exists timer_duration_ms integer;
alter table public.games add column if not exists timer_started_at timestamptz;
alter table public.games add column if not exists timer_ends_at timestamptz;
alter table public.games add column if not exists timer_remaining_ms integer;
alter table public.games add column if not exists timer_ended_at timestamptz;
alter table public.games add column if not exists timer_end_reason text
  check (timer_end_reason is null or timer_end_reason in ('completed', 'manual', 'time_up'));
alter table public.games add column if not exists timer_version integer not null default 0;

-- 後台管理員白名單（Email 小寫）
create table if not exists public.admin_users (
  email      text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Index / updated_at trigger
-- ---------------------------------------------------------------------
create index if not exists figures_game_id_idx on public.figures (game_id);
create index if not exists submissions_game_created_idx on public.submissions (game_id, created_at desc);
create index if not exists submissions_figure_id_idx on public.submissions (figure_id);
create index if not exists submissions_player_idx on public.submissions (game_id, player_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists games_set_updated_at on public.games;
create trigger games_set_updated_at before update on public.games
  for each row execute function public.set_updated_at();

drop trigger if exists figures_set_updated_at on public.figures;
create trigger figures_set_updated_at before update on public.figures
  for each row execute function public.set_updated_at();

drop trigger if exists submissions_set_updated_at on public.submissions;
create trigger submissions_set_updated_at before update on public.submissions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. Storage bucket
--    公開讀取（大家都能看照片），檔案 ≤ 5MB，只收圖片
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('figure-photos', 'figure-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- 4. Helper functions（security definer：繞過 RLS 做檢查，只回傳 boolean）
-- ---------------------------------------------------------------------

-- 目前登入者是否為管理員（依 JWT email）
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- 登入頁寄 magic link 前先檢查是否在白名單（避免寄信給非管理員）
create or replace function public.is_admin_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users a where a.email = lower(trim(p_email)));
$$;

-- Storage 上傳檢查：路徑必須是 10 分鐘內建立、還在 uploading 的投稿
create or replace function public.can_upload_photo(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.submissions s
    where s.photo_path = p_path
      and s.upload_status = 'uploading'
      and s.created_at > now() - interval '10 minutes'
  );
$$;

-- ---------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------
alter table public.games       enable row level security;
alter table public.figures     enable row level security;
alter table public.submissions enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "games are readable by everyone" on public.games;
create policy "games are readable by everyone" on public.games
  for select to anon, authenticated using (true);

drop policy if exists "figures are readable by everyone" on public.figures;
create policy "figures are readable by everyone" on public.figures
  for select to anon, authenticated using (true);

-- 投稿紀錄（含玩家代號、上傳失敗原因）只有管理員看得到
drop policy if exists "submissions readable by admins" on public.submissions;
create policy "submissions readable by admins" on public.submissions
  for select to authenticated using (public.is_admin());

drop policy if exists "admin list readable by admins" on public.admin_users;
create policy "admin list readable by admins" on public.admin_users
  for select to authenticated using (public.is_admin());

-- 所有寫入都只能透過下面的 RPC（security definer）
revoke insert, update, delete, truncate on public.games, public.figures, public.submissions, public.admin_users
  from anon, authenticated;

-- Storage：匿名可上傳到「自己剛建立的投稿路徑」；公開 bucket 讀取不需要 policy
drop policy if exists "players upload pending submission photo" on storage.objects;
create policy "players upload pending submission photo" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'figure-photos' and public.can_upload_photo(name));

-- ---------------------------------------------------------------------
-- 6. RPC：玩家
-- ---------------------------------------------------------------------

-- Step 1：建立投稿，取得照片上傳路徑
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

-- 照片上傳失敗：記錄原因（後台看得到）
create or replace function public.mark_submission_failed(p_submission_id uuid, p_error text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.submissions
     set upload_status = 'failed',
         upload_error  = left(coalesce(p_error, 'upload failed'), 300)
   where id = p_submission_id
     and upload_status = 'uploading';
end;
$$;

-- Step 2：照片上傳完成 → 點亮小人（idempotent：只更新 is_found = false 的 row）
-- 回傳 { status: 'success' | 'already_found', figure, found_count }
create or replace function public.submit_figure_found(p_submission_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sub         public.submissions%rowtype;
  v_figure      public.figures%rowtype;
  v_found_count integer;
  v_total       integer;
  v_status      text;
begin
  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found then
    raise exception 'submission_not_found' using errcode = 'P0002';
  end if;

  -- 重送同一筆：直接回傳目前狀態
  if v_sub.upload_status = 'uploaded' then
    select * into v_figure from public.figures where id = v_sub.figure_id;
    select count(*) filter (where is_found) into v_found_count from public.figures where game_id = v_sub.game_id;
    return jsonb_build_object(
      'status', case when v_figure.submission_id = v_sub.id then 'success' else 'already_found' end,
      'figure', to_jsonb(v_figure),
      'found_count', v_found_count
    );
  end if;

  if v_sub.upload_status <> 'uploading' then
    raise exception 'submission_not_uploading' using errcode = '22023';
  end if;

  -- 確認照片真的已經在 Storage
  if not exists (
    select 1 from storage.objects o where o.bucket_id = 'figure-photos' and o.name = v_sub.photo_path
  ) then
    raise exception 'photo_not_uploaded' using errcode = 'P0002';
  end if;

  update public.submissions set upload_status = 'uploaded' where id = v_sub.id;

  -- 併發安全：只有 is_found = false 才會被更新，兩人同時送只有一人成功
  update public.figures
     set is_found      = true,
         found_at      = now(),
         photo_path    = v_sub.photo_path,
         submission_id = v_sub.id,
         found_by_name = v_sub.player_name,
         is_verified   = false
   where id = v_sub.figure_id
     and is_found = false
  returning * into v_figure;

  if found then
    v_status := 'success';
    update public.submissions set review_status = 'active' where id = v_sub.id;
  else
    v_status := 'already_found';
    update public.submissions set review_status = 'duplicate' where id = v_sub.id;
    select * into v_figure from public.figures where id = v_sub.figure_id;
  end if;

  select count(*) filter (where is_found), count(*)
    into v_found_count, v_total
    from public.figures where game_id = v_sub.game_id;

  update public.games
     set is_completed = (v_found_count = v_total)
   where id = v_sub.game_id
     and is_completed is distinct from (v_found_count = v_total);

  -- 8/8 全部找到 → 倒數提前結束（記下剩餘時間）
  if v_status = 'success' and v_found_count = v_total then
    update public.games
       set timer_status       = 'ended',
           timer_end_reason   = 'completed',
           timer_ended_at     = now(),
           timer_remaining_ms = case
             when timer_status = 'paused' then timer_remaining_ms
             else greatest(0, (extract(epoch from (timer_ends_at - greatest(now(), timer_started_at))) * 1000)::integer)
           end,
           timer_version      = timer_version + 1
     where id = v_sub.game_id
       and (timer_status = 'paused' or (timer_status = 'running' and timer_ends_at > now()));
  end if;

  return jsonb_build_object('status', v_status, 'figure', to_jsonb(v_figure), 'found_count', v_found_count);
end;
$$;

-- ---------------------------------------------------------------------
-- 7. RPC：後台
-- ---------------------------------------------------------------------

-- 確認正確 / 退回（退回 → 小人變回未找到，所有玩家透過 Realtime 同步）
create or replace function public.review_submission(p_submission_id uuid, p_action text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sub         public.submissions%rowtype;
  v_email       text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_found_count integer;
  v_total       integer;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_action not in ('approve', 'reject') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;

  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found then
    raise exception 'submission_not_found' using errcode = 'P0002';
  end if;
  if v_sub.upload_status <> 'uploaded' or v_sub.review_status <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'not_reviewable');
  end if;

  update public.submissions
     set review_status = case when p_action = 'approve' then 'approved' else 'rejected' end,
         reviewed_at   = now(),
         reviewed_by   = v_email
   where id = v_sub.id;

  if p_action = 'approve' then
    update public.figures set is_verified = true where id = v_sub.figure_id and submission_id = v_sub.id;
  else
    update public.figures
       set is_found = false, found_at = null, photo_path = null, submission_id = null,
           found_by_name = null, is_verified = false
     where id = v_sub.figure_id and submission_id = v_sub.id;
  end if;

  select count(*) filter (where is_found), count(*)
    into v_found_count, v_total
    from public.figures where game_id = v_sub.game_id;
  update public.games
     set is_completed = (v_found_count = v_total)
   where id = v_sub.game_id
     and is_completed is distinct from (v_found_count = v_total);

  return jsonb_build_object('ok', true, 'found_count', v_found_count);
end;
$$;


-- ---------------------------------------------------------------------
-- 7b. 倒數計時
-- ---------------------------------------------------------------------

-- 伺服器時間：玩家手機時間可能不準，用來算時差
create or replace function public.server_now()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

-- 後台控制倒數：start / pause / resume / add / end / reset
--   start  p_seconds = 倒數秒數（10 秒 ~ 3 小時），3 秒後 GO
--   add    p_seconds = 加減秒數（-3600 ~ 3600）
create or replace function public.admin_timer(
  p_action    text,
  p_seconds   integer default null,
  p_game_slug text default 'camp-hide-and-seek'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_now  timestamptz := now();
  v_lead interval := interval '3 seconds';
  v_left integer;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select * into v_game from public.games where slug = p_game_slug for update;
  if not found then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;

  -- running 時剩餘毫秒（3-2-1 期間算完整時間）
  if v_game.timer_status = 'running' then
    v_left := greatest(0, (extract(epoch from (v_game.timer_ends_at - greatest(v_now, v_game.timer_started_at))) * 1000)::integer);
  end if;

  if p_action = 'start' then
    if p_seconds is null or p_seconds not between 10 and 10800 then
      raise exception 'invalid_seconds' using errcode = '22023';
    end if;
    update public.games
       set timer_status = 'running', timer_duration_ms = p_seconds * 1000,
           timer_started_at = v_now + v_lead, timer_ends_at = v_now + v_lead + make_interval(secs => p_seconds),
           timer_remaining_ms = null, timer_ended_at = null, timer_end_reason = null,
           timer_version = timer_version + 1
     where id = v_game.id;

  elsif p_action = 'pause' then
    if v_game.timer_status <> 'running' or v_left = 0 then
      return jsonb_build_object('ok', false, 'reason', 'not_running');
    end if;
    update public.games
       set timer_status = 'paused', timer_remaining_ms = v_left, timer_version = timer_version + 1
     where id = v_game.id;

  elsif p_action = 'resume' then
    if v_game.timer_status <> 'paused' then
      return jsonb_build_object('ok', false, 'reason', 'not_paused');
    end if;
    update public.games
       set timer_status = 'running',
           timer_started_at = v_now + v_lead,
           timer_ends_at = v_now + v_lead + make_interval(secs => v_game.timer_remaining_ms / 1000.0),
           timer_remaining_ms = null, timer_version = timer_version + 1
     where id = v_game.id;

  elsif p_action = 'add' then
    if p_seconds is null or p_seconds = 0 or p_seconds not between -3600 and 3600 then
      raise exception 'invalid_seconds' using errcode = '22023';
    end if;
    if v_game.timer_status = 'running' and v_left > 0 then
      update public.games
         set timer_ends_at = greatest(v_now, timer_started_at) + make_interval(secs => greatest(1000, v_left + p_seconds * 1000) / 1000.0),
             timer_duration_ms = greatest(1000, timer_duration_ms + p_seconds * 1000),
             timer_version = timer_version + 1
       where id = v_game.id;
    elsif v_game.timer_status = 'paused' then
      update public.games
         set timer_remaining_ms = greatest(1000, timer_remaining_ms + p_seconds * 1000),
             timer_duration_ms = greatest(1000, timer_duration_ms + p_seconds * 1000),
             timer_version = timer_version + 1
       where id = v_game.id;
    else
      return jsonb_build_object('ok', false, 'reason', 'not_running');
    end if;

  elsif p_action = 'end' then
    if v_game.timer_status not in ('running', 'paused') then
      return jsonb_build_object('ok', false, 'reason', 'not_running');
    end if;
    update public.games
       set timer_status = 'ended',
           timer_end_reason = case when v_game.timer_status = 'running' and v_left = 0 then 'time_up' else 'manual' end,
           timer_ended_at = case when v_game.timer_status = 'running' and v_left = 0 then timer_ends_at else v_now end,
           timer_remaining_ms = coalesce(v_left, timer_remaining_ms),
           timer_version = timer_version + 1
     where id = v_game.id;

  elsif p_action = 'reset' then
    update public.games
       set timer_status = 'idle', timer_duration_ms = null, timer_started_at = null, timer_ends_at = null,
           timer_remaining_ms = null, timer_ended_at = null, timer_end_reason = null,
           timer_version = timer_version + 1
     where id = v_game.id;

  else
    raise exception 'invalid_action' using errcode = '22023';
  end if;

  select * into v_game from public.games where id = v_game.id;
  return jsonb_build_object('ok', true, 'server_now', v_now, 'game', to_jsonb(v_game));
end;
$$;

-- ---------------------------------------------------------------------
-- 函式權限：預設收回，只開放需要的
-- ---------------------------------------------------------------------
revoke all on function public.is_admin()                                      from public, anon, authenticated;
revoke all on function public.is_admin_email(text)                            from public, anon, authenticated;
revoke all on function public.can_upload_photo(text)                          from public, anon, authenticated;
revoke all on function public.start_submission(text, integer, text, text, integer) from public, anon, authenticated;
revoke all on function public.mark_submission_failed(uuid, text)              from public, anon, authenticated;
revoke all on function public.submit_figure_found(uuid)                       from public, anon, authenticated;
revoke all on function public.review_submission(uuid, text)                   from public, anon, authenticated;
revoke all on function public.set_updated_at()                                from public, anon, authenticated;
revoke all on function public.server_now()                                    from public, anon, authenticated;
revoke all on function public.admin_timer(text, integer, text)                from public, anon, authenticated;

grant execute on function public.is_admin()                                      to anon, authenticated;
grant execute on function public.is_admin_email(text)                            to anon, authenticated;
grant execute on function public.can_upload_photo(text)                          to anon, authenticated;
grant execute on function public.start_submission(text, integer, text, text, integer) to anon, authenticated;
grant execute on function public.mark_submission_failed(uuid, text)              to anon, authenticated;
grant execute on function public.submit_figure_found(uuid)                       to anon, authenticated;
grant execute on function public.review_submission(uuid, text)                   to authenticated;
grant execute on function public.server_now()                                    to anon, authenticated;
grant execute on function public.admin_timer(text, integer, text)                to authenticated;

-- ---------------------------------------------------------------------
-- 8. Realtime（games / figures：所有玩家；submissions：RLS 限管理員）
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'figures'
  ) then
    alter publication supabase_realtime add table public.figures;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'submissions'
  ) then
    alter publication supabase_realtime add table public.submissions;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 9. Seed
-- ---------------------------------------------------------------------
insert into public.games (slug, title)
values ('camp-hide-and-seek', '躲貓貓小人')
on conflict (slug) do nothing;

insert into public.figures (game_id, number)
select g.id, n
from public.games g
cross join generate_series(1, 8) as n
where g.slug = 'camp-hide-and-seek'
on conflict (game_id, number) do nothing;

-- ⚠️ 換成你的管理員 Email（小寫）。可以加多位。
insert into public.admin_users (email)
values ('your-admin@example.com')
on conflict (email) do nothing;
