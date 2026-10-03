-- =====================================================================
-- 重置遊戲（只能由管理者在 Supabase SQL Editor 執行，網站上不提供 Reset）
-- 會把 8 個小人變回未找到，並刪除所有投稿紀錄。
-- Storage 裡的照片檔請到 Dashboard → Storage → figure-photos 手動清空
-- （Supabase 不允許用 SQL 直接刪除 storage.objects）。
-- =====================================================================
begin;

update public.figures f
   set is_found = false, found_at = null, photo_path = null, submission_id = null, is_verified = false
  from public.games g
 where f.game_id = g.id and g.slug = 'camp-hide-and-seek';

delete from public.submissions s
 using public.games g
 where s.game_id = g.id and g.slug = 'camp-hide-and-seek';

update public.games set is_completed = false where slug = 'camp-hide-and-seek';

commit;
