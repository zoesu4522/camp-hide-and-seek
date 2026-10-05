/**
 * 倒數計時：純函式（前台 / 後台 / mock 共用）。
 * 伺服器存的是「絕對時間」（endsAt），每台手機用校正過的時間自己算剩餘，
 * 所以 26 支手機看到的秒數會一致，斷線重連也不會跑掉。
 */
import type { GameTimer, TimerAction } from "@/types/game";

/** 按下開始到 GO 的準備時間（3-2-1） */
export const LEAD_MS = 3000;
/** GO! 字樣停留時間 */
export const GO_MS = 1100;
/** 最後幾秒顯示大數字 */
export const FINAL_COUNT_S = 10;
/** 時間到之後，伺服器仍接受回報的緩衝 */
export const GRACE_MS = 3000;

export type TimerPhase = "idle" | "lead" | "running" | "paused" | "timeup" | "completed" | "stopped";

export interface TimerView {
  phase: TimerPhase;
  /** 剩餘毫秒（lead 期間 = 完整時間） */
  remainingMs: number;
  /** lead 期間距離 GO 的毫秒 */
  leadMs: number;
  /** 剩餘比例 0~1 */
  ratio: number;
  /** 剛 GO 不久（顯示 GO!） */
  justStarted: boolean;
}

const t = (iso: string | null) => (iso ? new Date(iso).getTime() : NaN);

export function computeTimer(timer: GameTimer, now: number): TimerView {
  const duration = Math.max(1, timer.durationMs ?? 1);
  const base = { leadMs: 0, justStarted: false };
  switch (timer.status) {
    case "idle":
      return { ...base, phase: "idle", remainingMs: 0, ratio: 1 };
    case "paused": {
      const rem = Math.max(0, timer.remainingMs ?? 0);
      return { ...base, phase: "paused", remainingMs: rem, ratio: Math.min(1, rem / duration) };
    }
    case "ended": {
      const rem = Math.max(0, timer.remainingMs ?? 0);
      const phase = timer.endReason === "completed" ? "completed" : timer.endReason === "manual" ? "stopped" : "timeup";
      return { ...base, phase, remainingMs: rem, ratio: Math.min(1, rem / duration) };
    }
    case "running": {
      const start = t(timer.startedAt);
      const end = t(timer.endsAt);
      if (now < start) {
        const rem = end - start;
        return { phase: "lead", remainingMs: rem, leadMs: start - now, ratio: Math.min(1, rem / duration), justStarted: false };
      }
      const rem = Math.max(0, end - now);
      if (rem <= 0) return { ...base, phase: "timeup", remainingMs: 0, ratio: 0 };
      return { ...base, phase: "running", remainingMs: rem, ratio: Math.min(1, rem / duration), justStarted: now - start < GO_MS };
    }
  }
}

/** 已結束且不能再回報（提前完成除外） */
export const isLocked = (phase: TimerPhase) => phase === "timeup" || phase === "stopped";

/** 12:05 / 1:02:03 */
export function formatClock(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** 「12 分 5 秒」 */
export function formatSpoken(ms: number): string {
  const total = Math.round(Math.max(0, ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s} 秒`;
  return s === 0 ? `${m} 分鐘` : `${m} 分 ${s} 秒`;
}

/** 和 supabase admin_timer 相同的規則（mock 用） */
export function applyTimerAction(timer: GameTimer, action: TimerAction, seconds: number | undefined, now: number): GameTimer | null {
  const iso = (ms: number) => new Date(ms).toISOString();
  const left =
    timer.status === "running" ? Math.max(0, t(timer.endsAt) - Math.max(now, t(timer.startedAt))) : null;
  const v = timer.version + 1;
  switch (action) {
    case "start": {
      if (!seconds || seconds < 10 || seconds > 10800) return null;
      return {
        status: "running",
        durationMs: seconds * 1000,
        startedAt: iso(now + LEAD_MS),
        endsAt: iso(now + LEAD_MS + seconds * 1000),
        remainingMs: null,
        endedAt: null,
        endReason: null,
        version: v,
      };
    }
    case "pause":
      if (timer.status !== "running" || !left) return null;
      return { ...timer, status: "paused", remainingMs: left, version: v };
    case "resume":
      if (timer.status !== "paused") return null;
      return {
        ...timer,
        status: "running",
        startedAt: iso(now + LEAD_MS),
        endsAt: iso(now + LEAD_MS + (timer.remainingMs ?? 0)),
        remainingMs: null,
        version: v,
      };
    case "add": {
      if (!seconds) return null;
      const d = seconds * 1000;
      const duration = Math.max(1000, (timer.durationMs ?? 0) + d);
      if (timer.status === "running" && left) {
        return { ...timer, endsAt: iso(Math.max(now, t(timer.startedAt)) + Math.max(1000, left + d)), durationMs: duration, version: v };
      }
      if (timer.status === "paused") {
        return { ...timer, remainingMs: Math.max(1000, (timer.remainingMs ?? 0) + d), durationMs: duration, version: v };
      }
      return null;
    }
    case "end": {
      if (timer.status !== "running" && timer.status !== "paused") return null;
      const timeUp = timer.status === "running" && left === 0;
      return {
        ...timer,
        status: "ended",
        endReason: timeUp ? "time_up" : "manual",
        endedAt: timeUp ? timer.endsAt : iso(now),
        remainingMs: left ?? timer.remainingMs,
        version: v,
      };
    }
    case "reset":
      return {
        status: "idle",
        durationMs: null,
        startedAt: null,
        endsAt: null,
        remainingMs: null,
        endedAt: null,
        endReason: null,
        version: v,
      };
  }
}
