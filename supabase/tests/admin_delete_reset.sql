-- Disposable local database only, after stubs + schema. Rolls back all fixtures.
begin;
insert into public.admin_users(email) values ('reset-test@example.com') on conflict do nothing;
select set_config('request.jwt.claims','{"email":"reset-test@example.com","role":"authenticated"}',true);
do $$
declare g uuid; f uuid; s uuid := gen_random_uuid(); r jsonb; n integer;
begin
  if has_function_privilege('anon','public.admin_reset_game(text,text)','EXECUTE') then raise exception 'anon reset permission'; end if;
  if has_function_privilege('anon','public.admin_delete_submissions(uuid[])','EXECUTE') then raise exception 'anon delete permission'; end if;
  select id into g from public.games where slug='camp-hide-and-seek';
  select id into f from public.figures where game_id=g and number=1;
  insert into public.submissions(id,game_id,figure_id,figure_number,player_id,photo_path,upload_status,review_status)
    values(s,g,f,1,'TEST','games/camp-hide-and-seek/1/test.jpg','uploaded','approved');
  update public.figures set is_found=true,found_at=now(),submission_id=s,photo_path='games/camp-hide-and-seek/1/test.jpg',is_verified=true where id=f;
  update public.games set is_completed=true where id=g;
  r := public.admin_delete_submissions(array[s]);
  if (r->>'deleted')::int <> 1 then raise exception 'successful photo not deleted'; end if;
  if exists(select 1 from public.figures where id=f and (is_found or submission_id is not null or photo_path is not null or is_verified)) then raise exception 'figure not cleared'; end if;
  if exists(select 1 from public.games where id=g and is_completed) then raise exception 'completion not cleared'; end if;
  if not exists(select 1 from public.camp_photo_cleanup where path='games/camp-hide-and-seek/1/test.jpg') then raise exception 'cleanup not queued'; end if;
  r := public.admin_delete_submissions(array[s]);
  if (r->>'deleted')::int <> 0 then raise exception 'delete not idempotent'; end if;
  r := public.start_submission('camp-hide-and-seek',2,'TEST2','測試',100);
  s := (r->>'submission_id')::uuid;
  perform public.admin_timer('start',60,'camp-hide-and-seek');
  begin
    perform public.admin_reset_game('camp-hide-and-seek','wrong');
    raise exception 'invalid confirmation accepted';
  exception when sqlstate '22023' then null; end;
  if not exists(select 1 from public.submissions where id=s) then raise exception 'failed confirmation changed data'; end if;
  select timer_version into n from public.games where id=g;
  r := public.admin_reset_game('camp-hide-and-seek','重置遊戲');
  if exists(select 1 from public.submissions where game_id=g) then raise exception 'reports remain'; end if;
  if exists(select 1 from public.figures where game_id=g and (is_found or submission_id is not null)) then raise exception 'progress remains'; end if;
  if not exists(select 1 from public.games where id=g and timer_status='idle' and timer_version=n+1 and not is_completed) then raise exception 'timer not reset'; end if;
  begin
    perform public.submit_figure_found(s);
    raise exception 'stale upload accepted';
  exception when sqlstate 'P0002' then null; end;
  perform set_config('request.jwt.claims','{"email":"outsider@example.com","role":"authenticated"}',true);
  begin
    perform public.admin_reset_game('camp-hide-and-seek','重置遊戲');
    raise exception 'non admin reset accepted';
  exception when sqlstate '42501' then null; end;
  begin
    perform public.admin_delete_submissions(array[s]);
    raise exception 'non admin delete accepted';
  exception when sqlstate '42501' then null; end;
end;
$$;
rollback;
select 'PASS: successful deletion, idempotency, reset, stale uploads, confirmation and permissions' as result;
