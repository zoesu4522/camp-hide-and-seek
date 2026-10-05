import type { Figure, Game, GameTimer, Submission } from "@/types/game";
import { photoPublicUrl } from "./client";

/** DB row 型別（snake_case） */
export interface GameRow {
  id: string;
  slug: string;
  title: string;
  is_completed: boolean;
  timer_status: GameTimer["status"] | null;
  timer_duration_ms: number | null;
  timer_started_at: string | null;
  timer_ends_at: string | null;
  timer_remaining_ms: number | null;
  timer_ended_at: string | null;
  timer_end_reason: GameTimer["endReason"];
  timer_version: number | null;
}

export interface FigureRow {
  id: string;
  game_id: string;
  number: number;
  is_found: boolean;
  found_at: string | null;
  photo_path: string | null;
  submission_id: string | null;
  found_by_name: string | null;
  is_verified: boolean;
}

export interface SubmissionRow {
  id: string;
  game_id: string;
  figure_number: number;
  player_id: string;
  player_name: string | null;
  photo_path: string;
  photo_bytes: number | null;
  upload_status: Submission["uploadStatus"];
  upload_error: string | null;
  review_status: Submission["reviewStatus"];
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export const GAME_COLUMNS =
  "id, slug, title, is_completed, timer_status, timer_duration_ms, timer_started_at, timer_ends_at, timer_remaining_ms, timer_ended_at, timer_end_reason, timer_version";
export const FIGURE_COLUMNS = "id, game_id, number, is_found, found_at, photo_path, submission_id, found_by_name, is_verified";
export const SUBMISSION_COLUMNS =
  "id, game_id, figure_number, player_id, player_name, photo_path, photo_bytes, upload_status, upload_error, review_status, created_at, reviewed_at, reviewed_by";

export const toGame = (r: GameRow): Game => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  isCompleted: r.is_completed,
  timer: {
    status: r.timer_status ?? "idle",
    durationMs: r.timer_duration_ms ?? null,
    startedAt: r.timer_started_at ?? null,
    endsAt: r.timer_ends_at ?? null,
    remainingMs: r.timer_remaining_ms ?? null,
    endedAt: r.timer_ended_at ?? null,
    endReason: r.timer_end_reason ?? null,
    version: r.timer_version ?? 0,
  },
});

export const toFigure = (r: FigureRow): Figure => ({
  id: r.id,
  gameId: r.game_id,
  number: r.number,
  isFound: r.is_found,
  foundAt: r.found_at,
  photoUrl: photoPublicUrl(r.photo_path),
  submissionId: r.submission_id,
  foundByName: r.found_by_name ?? null,
  isVerified: r.is_verified,
});

export const toSubmission = (r: SubmissionRow): Submission => ({
  id: r.id,
  gameId: r.game_id,
  figureNumber: r.figure_number,
  playerId: r.player_id,
  playerName: r.player_name ?? null,
  // 上傳失敗的投稿 Storage 裡沒有檔案
  photoUrl: r.upload_status === "uploaded" ? photoPublicUrl(r.photo_path) : null,
  photoBytes: r.photo_bytes,
  uploadStatus: r.upload_status,
  uploadError: r.upload_error,
  reviewStatus: r.review_status,
  createdAt: r.created_at,
  reviewedAt: r.reviewed_at,
  reviewedBy: r.reviewed_by,
});
