export const GAME_SLUG = "camp-hide-and-seek";
export const TOTAL_FIGURES = 8;

/** 倒數計時狀態（資料庫存的狀態；「時間到」= running 且現在 > endsAt） */
export type TimerStatus = "idle" | "running" | "paused" | "ended";
export type TimerEndReason = "completed" | "manual" | "time_up";

export interface GameTimer {
  status: TimerStatus;
  durationMs: number | null;
  /** GO 的時間（比按下開始晚 3 秒，用來播 3-2-1） */
  startedAt: string | null;
  endsAt: string | null;
  /** 暫停 / 結束時的剩餘毫秒 */
  remainingMs: number | null;
  endedAt: string | null;
  endReason: TimerEndReason | null;
  /** 每次操作 +1 */
  version: number;
}

export const IDLE_TIMER: GameTimer = {
  status: "idle",
  durationMs: null,
  startedAt: null,
  endsAt: null,
  remainingMs: null,
  endedAt: null,
  endReason: null,
  version: 0,
};

export type TimerAction = "start" | "pause" | "resume" | "add" | "end" | "reset";

export interface Game {
  id: string;
  slug: string;
  title: string;
  isCompleted: boolean;
  timer: GameTimer;
}

export interface Figure {
  id: string;
  gameId: string;
  number: number;
  isFound: boolean;
  foundAt: string | null;
  /** 目前點亮這個小人的照片（被退回後清空） */
  photoUrl: string | null;
  /** 對應的投稿 id */
  submissionId: string | null;
  /** 找到的玩家名稱 */
  foundByName: string | null;
  /** 管理員已確認照片正確 */
  isVerified: boolean;
}

/** 照片上傳狀態（後台用來看「上傳是否成功」） */
export type UploadStatus = "uploading" | "uploaded" | "failed";

/**
 * 審核狀態（上傳即點亮，後台可退回）
 * - active：已點亮，等待管理員確認
 * - approved：管理員確認正確
 * - rejected：管理員退回，小人變回未找到
 * - duplicate：上傳成功，但小人已被別人先點亮（未點亮）
 * - none：上傳未完成
 */
export type ReviewStatus = "none" | "active" | "approved" | "rejected" | "duplicate";

export interface Submission {
  id: string;
  gameId: string;
  figureNumber: number;
  playerId: string;
  playerName: string | null;
  photoUrl: string | null;
  photoBytes: number | null;
  uploadStatus: UploadStatus;
  uploadError: string | null;
  reviewStatus: ReviewStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export type MarkFoundStatus = "success" | "already_found" | "error";

export interface MarkFoundResult {
  status: MarkFoundStatus;
  figure?: Figure;
  foundCount?: number;
  /** status = error 時的原因 */
  error?: "upload_failed" | "time_up" | "unknown";
}

export type GameLoadStatus = "loading" | "ready" | "error";

/** 一次「找到小人」事件（本地點亮或其他玩家同步），用於觸發動畫，已去重。 */
export interface FoundEvent {
  key: string;
  number: number;
  source: "local" | "remote";
  foundCount: number;
  photoUrl: string | null;
  foundByName: string | null;
}

/** 照片被管理員退回 → 小人重新躲起來 */
export interface RejectEvent {
  key: string;
  number: number;
}

export interface SubmitFindInput {
  figureNumber: number;
  photo: Blob;
  playerId: string;
  playerName: string;
  onProgress?: (ratio: number) => void;
}

/** 資料來源介面：目前用 mock，Phase 3 之後換成 Supabase（Storage + RPC + Realtime）。 */
export interface GameService {
  fetchGame(slug: string): Promise<{ game: Game; figures: Figure[] }>;
  /** 上傳照片並點亮小人（照片必填） */
  submitFind(slug: string, input: SubmitFindInput): Promise<MarkFoundResult>;
  subscribe(gameId: string, onFigureUpdate: (figure: Figure) => void, onGameUpdate?: (game: Game) => void): () => void;
  /** 伺服器時間 − 本機時間（ms），用來校正手機時間不準 */
  getClockOffset(): Promise<number>;
}

/* ---------- 後台 ---------- */

export interface AdminSession {
  email: string;
}

export type SignInResult = { status: "sent" } | { status: "not_allowed" } | { status: "error"; message?: string };

export interface AdminService {
  getSession(): Promise<AdminSession | null>;
  /** Email magic link 登入 */
  signInWithEmail(email: string): Promise<SignInResult>;
  signOut(): Promise<void>;
  listSubmissions(slug: string): Promise<{ game: Game; figures: Figure[]; submissions: Submission[] }>;
  /** 倒數計時控制（start / add 需要秒數） */
  controlTimer(action: TimerAction, seconds?: number): Promise<{ ok: boolean }>;
  getClockOffset(): Promise<number>;
  reviewSubmission(submissionId: string, action: "approve" | "reject", reviewer: string): Promise<{ ok: boolean }>;
  /** 刪除投稿紀錄與照片（只會刪掉 isDeletable 的） */
  deleteSubmissions(submissionIds: string[]): Promise<{ ok: boolean; deleted: number; cleanupPending?: boolean }>;
  resetGame(confirmation: string): Promise<{ ok: boolean; deleted: number; cleanupPending?: boolean }>;
  cleanupPhotos(): Promise<{ ok: boolean }>;
  /** 任何投稿或小人狀態變更時呼叫 */
  subscribe(onChange: () => void): () => void;
}

/** 可刪除成功、失敗、退回、重複與超過 10 分鐘的未完成投稿。刪除目前照片會撤回點亮。 */
export function isDeletable(s: Submission, now = Date.now()): boolean {
  if (s.uploadStatus === "uploaded") return true;
  if (s.reviewStatus === "rejected" || s.reviewStatus === "duplicate") return true;
  if (s.uploadStatus === "failed") return true;
  return s.uploadStatus === "uploading" && now - new Date(s.createdAt).getTime() > 10 * 60 * 1000;
}
