/**
 * Supabase 版 GameService（Phase 5–6）。
 *
 * 點亮流程：
 *   rpc start_submission → Storage 上傳照片（只能傳到該投稿路徑）
 *     ├ 失敗 → rpc mark_submission_failed（後台看得到失敗原因）
 *     └ 成功 → rpc submit_figure_found（只更新 is_found = false 的 row）
 * Realtime：訂閱 figures UPDATE（filter game_id）與 games UPDATE（倒數計時）。
 *   每次（重新）連上都會重抓一次 figures，補上斷線期間漏掉的更新；
 *   回到前景（visibilitychange）也會重抓。重複資料由 useCampGame 去重。
 */
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { GameService, MarkFoundResult } from "@/types/game";
import { getSupabase, measureClockOffset, PHOTO_BUCKET } from "./client";
import { FIGURE_COLUMNS, GAME_COLUMNS, toFigure, toGame, type FigureRow, type GameRow } from "./rows";

interface CreateSubmissionResult {
  submission_id: string;
  photo_path: string;
  already_found: boolean;
}

interface SubmitResult {
  status: "success" | "already_found";
  figure: FigureRow;
  found_count: number;
}

async function fetchFigures(gameId: string) {
  const { data, error } = await getSupabase()
    .from("figures")
    .select(FIGURE_COLUMNS)
    .eq("game_id", gameId)
    .order("number");
  if (error) throw error;
  return (data as FigureRow[]).map(toFigure);
}

export const supabaseGameService: GameService = {
  async fetchGame(slug) {
    const { data, error } = await getSupabase().from("games").select(GAME_COLUMNS).eq("slug", slug).single();
    if (error) throw error;
    const game = toGame(data as GameRow);
    return { game, figures: await fetchFigures(game.id) };
  },

  async submitFind(slug, { figureNumber, photo, playerId, playerName, onProgress }): Promise<MarkFoundResult> {
    const sb = getSupabase();

    onProgress?.(0.05);
    const created = await sb.rpc("start_submission", {
      p_game_slug: slug,
      p_figure_number: figureNumber,
      p_player_id: playerId,
      p_player_name: playerName,
      p_photo_bytes: photo.size,
    });
    if (created.error) {
      return { status: "error", error: created.error.message.includes("time_up") ? "time_up" : "unknown" };
    }
    const sub = created.data as CreateSubmissionResult;

    // supabase-js 上傳沒有進度事件，用階段性進度表示
    let p = 0.2;
    onProgress?.(p);
    const ticker = window.setInterval(() => {
      p = Math.min(0.9, p + 0.08);
      onProgress?.(p);
    }, 400);
    const uploaded = await sb.storage.from(PHOTO_BUCKET).upload(sub.photo_path, photo, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: false,
    });
    window.clearInterval(ticker);

    if (uploaded.error) {
      await sb.rpc("mark_submission_failed", {
        p_submission_id: sub.submission_id,
        p_error: uploaded.error.message.slice(0, 280),
      });
      return { status: "error", error: "upload_failed" };
    }
    onProgress?.(1);

    // 網路抖動時重試一次（RPC 是 idempotent）
    let result = await sb.rpc("submit_figure_found", { p_submission_id: sub.submission_id });
    if (result.error) result = await sb.rpc("submit_figure_found", { p_submission_id: sub.submission_id });
    if (result.error) return { status: "error", error: "unknown" };

    const r = result.data as SubmitResult;
    return { status: r.status, figure: toFigure(r.figure), foundCount: r.found_count };
  },

  subscribe(gameId, onFigureUpdate, onGameUpdate) {
    const sb = getSupabase();
    let disposed = false;

    const resync = () => {
      fetchFigures(gameId)
        .then((list) => !disposed && list.forEach(onFigureUpdate))
        .catch(() => {
          /* 下次重連再補 */
        });
      if (onGameUpdate) {
        sb.from("games")
          .select(GAME_COLUMNS)
          .eq("id", gameId)
          .single()
          .then(({ data }) => !disposed && data && onGameUpdate(toGame(data as GameRow)));
      }
    };

    const channel: RealtimeChannel = sb
      .channel(`figures:${gameId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "figures", filter: `game_id=eq.${gameId}` },
        (payload) => onFigureUpdate(toFigure(payload.new as FigureRow)),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload) => onGameUpdate?.(toGame(payload.new as GameRow)),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") resync();
      });

    const onVisible = () => document.visibilityState === "visible" && resync();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", resync);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", resync);
      sb.removeChannel(channel);
    };
  },

  getClockOffset: measureClockOffset,
};
