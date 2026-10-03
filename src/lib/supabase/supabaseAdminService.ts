/**
 * Supabase 版後台服務。
 * - 登入：先 rpc is_admin_email 檢查白名單，再 signInWithOtp（magic link，回到 /admin）
 * - 權限：投稿資料受 RLS 保護（is_admin()），審核走 rpc review_submission
 * - 即時：訂閱 submissions（所有事件）與 figures UPDATE
 */
import type { AdminService, AdminSession } from "@/types/game";
import { GAME_SLUG } from "@/types/game";
import { getSupabase } from "./client";
import {
  FIGURE_COLUMNS,
  SUBMISSION_COLUMNS,
  toFigure,
  toSubmission,
  type FigureRow,
  type SubmissionRow,
} from "./rows";

async function gameId(slug: string): Promise<string> {
  const { data, error } = await getSupabase().from("games").select("id").eq("slug", slug).single();
  if (error) throw error;
  return (data as { id: string }).id;
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
    const id = await gameId(slug);
    const [figures, submissions] = await Promise.all([
      sb.from("figures").select(FIGURE_COLUMNS).eq("game_id", id).order("number"),
      sb.from("submissions").select(SUBMISSION_COLUMNS).eq("game_id", id).order("created_at", { ascending: false }).limit(500),
    ]);
    if (figures.error) throw figures.error;
    if (submissions.error) throw submissions.error;
    return {
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
