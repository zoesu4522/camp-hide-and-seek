/**
 * Supabase 版後台服務。
 * - 登入：先 rpc is_admin_email 檢查白名單，再 signInWithOtp（magic link，回到 /admin）
 * - 權限：投稿資料受 RLS 保護（is_admin()），審核走 rpc review_submission
 * - 即時：訂閱 submissions（所有事件）與 figures UPDATE
 */
import type { AdminService, AdminSession } from "@/types/game";
import { GAME_SLUG } from "@/types/game";
import { getSupabase, measureClockOffset, PHOTO_BUCKET } from "./client";
import {
  FIGURE_COLUMNS,
  GAME_COLUMNS,
  toGame,
  type GameRow,
  SUBMISSION_COLUMNS,
  toFigure,
  toSubmission,
  type FigureRow,
  type SubmissionRow,
} from "./rows";

async function fetchGameRow(slug: string) {
  const { data, error } = await getSupabase().from("games").select(GAME_COLUMNS).eq("slug", slug).single();
  if (error) throw error;
  return toGame(data as GameRow);
}

async function cleanupPhotos() {
  const sb = getSupabase();
  try {
    for (;;) {
      const { data, error } = await sb.from("camp_photo_cleanup").select("path").limit(100);
      if (error) return { ok: false };
      if (!data?.length) return { ok: true };
      const paths = data.map((row) => row.path as string);
      const removed = await sb.storage.from(PHOTO_BUCKET).remove(paths);
      if (removed.error) return { ok: false };
      const acknowledged = await sb.from("camp_photo_cleanup").delete().in("path", paths);
      if (acknowledged.error) return { ok: false };
    }
  } catch { return { ok: false }; }
}

export const supabaseAdminService: AdminService = {
  async getSession(): Promise<AdminSession | null> {
    const sb = getSupabase();
    const { data } = await sb.auth.getSession();
    const email = data.session?.user.email;
    if (!email) return null;
    const { data: ok } = await sb.rpc("is_admin");
    if (!ok) {
      // 登入了但不在白名單
      await sb.auth.signOut();
      return null;
    }
    return { email };
  },

  async signInWithEmail(email) {
    const sb = getSupabase();
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return { status: "error", message: "Email 格式不正確" };

    const allowed = await sb.rpc("is_admin_email", { p_email: normalized });
    if (allowed.error) return { status: "error" };
    if (!allowed.data) return { status: "not_allowed" };

    const { error } = await sb.auth.signInWithOtp({
      email: normalized,
      options: { emailRedirectTo: `${window.location.origin}/admin`, shouldCreateUser: true },
    });
    if (error) {
      return {
        status: "error",
        message: error.status === 429 ? "寄太多次了，請等一分鐘再試。" : "登入連結寄送失敗，請稍後再試。",
      };
    }
    return { status: "sent" };
  },

  async signOut() {
    await getSupabase().auth.signOut();
  },

  async listSubmissions(slug) {
    const sb = getSupabase();
    const game = await fetchGameRow(slug);
    const id = game.id;
    const [figures, submissions] = await Promise.all([
      sb.from("figures").select(FIGURE_COLUMNS).eq("game_id", id).order("number"),
      sb.from("submissions").select(SUBMISSION_COLUMNS).eq("game_id", id).order("created_at", { ascending: false }).limit(500),
    ]);
    if (figures.error) throw figures.error;
    if (submissions.error) throw submissions.error;
    return {
      game,
      figures: (figures.data as FigureRow[]).map(toFigure),
      submissions: (submissions.data as SubmissionRow[]).map(toSubmission),
    };
  },

  async reviewSubmission(submissionId, action) {
    const { data, error } = await getSupabase().rpc("review_submission", {
      p_submission_id: submissionId,
      p_action: action,
    });
    return { ok: !error && Boolean((data as { ok?: boolean } | null)?.ok) };
  },

  async deleteSubmissions(ids) {
    if (ids.length === 0) return { ok: true, deleted: 0 };
    const sb = getSupabase();
    const { data, error } = await sb.rpc("admin_delete_submissions", { p_submission_ids: ids });
    if (error || !data?.ok) return { ok: false, deleted: 0 };
    const res = data as { deleted: number; photo_paths: string[] };
    const cleanup = await cleanupPhotos();
    return { ok: true, deleted: res.deleted, cleanupPending: !cleanup.ok };
  },

  async resetGame(confirmation) {
    const { data, error } = await getSupabase().rpc("admin_reset_game", { p_game_slug: GAME_SLUG, p_confirmation: confirmation });
    if (error || !data?.ok) return { ok: false, deleted: 0 };
    const cleanup = await cleanupPhotos();
    return { ok: true, deleted: data.deleted, cleanupPending: !cleanup.ok };
  },

  cleanupPhotos,

  async controlTimer(action, seconds) {
    const { data, error } = await getSupabase().rpc("admin_timer", {
      p_action: action,
      p_seconds: seconds ?? null,
      p_game_slug: GAME_SLUG,
    });
    return { ok: !error && Boolean((data as { ok?: boolean } | null)?.ok) };
  },

  getClockOffset: measureClockOffset,

  subscribe(onChange) {
    const sb = getSupabase();
    let timer: number | undefined;
    // 多筆事件合併成一次重新載入
    const debounced = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(onChange, 250);
    };
    const channel = sb
      .channel(`admin:${GAME_SLUG}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, debounced)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "figures" }, debounced)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games" }, () => {
        // 倒數計時要即時，不等 debounce
        window.clearTimeout(timer);
        onChange();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") debounced();
      });
    const onVisible = () => document.visibilityState === "visible" && debounced();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      sb.removeChannel(channel);
    };
  },
};
