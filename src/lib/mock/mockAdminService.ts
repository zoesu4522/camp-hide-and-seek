/**
 * Mock 版後台服務。
 *
 * 登入流程模擬 Supabase Auth Email magic link：
 *   signInWithEmail → 「已寄出登入連結」→ 使用者點信中連結 → 回到 /admin 取得 session
 * mock 沒有真的寄信，登入頁會出現「模擬點擊信中連結」按鈕（mockCompleteMagicLink）。
 *
 * 正式版（Phase 3）：supabase.auth.signInWithOtp + admin_users 白名單 + RLS / security definer RPC。
 */
import { isDeletable, type AdminService, type AdminSession, type Figure, type Submission } from "@/types/game";
import { applyTimerAction } from "@/lib/timer";
import { onDbChange, readDb, recount, wait, writeDb } from "./mockDb";

const SESSION_KEY = "camp-hide-and-seek:mock-admin-session";
const PENDING_KEY = "camp-hide-and-seek:mock-admin-pending";

export const mockAdminService: AdminService = {
  async getSession() {
    await wait(150);
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as AdminSession) : null;
    } catch {
      return null;
    }
  },

  async signInWithEmail(email) {
    await wait(500);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: "error", message: "Email 格式不正確" };
    try {
      window.localStorage.setItem(PENDING_KEY, email.trim().toLowerCase());
    } catch {
      return { status: "error" };
    }
    return { status: "sent" };
  },

  async signOut() {
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  },

  async listSubmissions() {
    await wait(200);
    const db = readDb();
    return { game: db.game, figures: db.figures, submissions: db.submissions };
  },

  async deleteSubmissions(ids) {
    await wait(250);
    const db = readDb();
    const inUse = new Set(db.figures.map((f) => f.submissionId));
    const target = new Set(ids);
    const keep = db.submissions.filter((s) => !(target.has(s.id) && !inUse.has(s.id) && isDeletable(s)));
    writeDb({ ...db, submissions: keep });
    return { ok: true, deleted: db.submissions.length - keep.length };
  },

  async controlTimer(action, seconds) {
    await wait(150);
    const db = readDb();
    const next = applyTimerAction(db.game.timer, action, seconds, Date.now());
    if (!next) return { ok: false };
    writeDb({ ...db, game: { ...db.game, timer: next } });
    return { ok: true };
  },

  async getClockOffset() {
    return 0;
  },

  async reviewSubmission(submissionId, action, reviewer) {
    await wait(300);
    const db = readDb();
    const sub = db.submissions.find((s) => s.id === submissionId);
    if (!sub || sub.uploadStatus !== "uploaded") return { ok: false };
    const now = new Date().toISOString();

    const submissions: Submission[] = db.submissions.map((s) =>
      s.id === submissionId
        ? { ...s, reviewStatus: action === "approve" ? "approved" : "rejected", reviewedAt: now, reviewedBy: reviewer }
        : s,
    );

    const figures: Figure[] = db.figures.map((f) => {
      if (f.submissionId !== submissionId) return f;
      return action === "approve"
        ? { ...f, isVerified: true }
        : { ...f, isFound: false, foundAt: null, photoUrl: null, submissionId: null, foundByName: null, isVerified: false };
    });

    writeDb(recount({ ...db, submissions, figures }));
    return { ok: true };
  },

  subscribe(onChange) {
    return onDbChange(() => onChange());
  },
};

/** mock：模擬使用者點了信中的 magic link */
export function mockCompleteMagicLink(): AdminSession | null {
  try {
    const email = window.localStorage.getItem(PENDING_KEY);
    if (!email) return null;
    const session = { email };
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    window.localStorage.removeItem(PENDING_KEY);
    return session;
  } catch {
    return null;
  }
}
