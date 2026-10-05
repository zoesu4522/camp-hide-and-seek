"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { FINAL_COUNT_S, formatSpoken, type TimerPhase, type TimerView } from "@/lib/timer";
import type { GameTimer } from "@/types/game";

export interface TimerBonus {
  id: number;
  text: string;
  positive: boolean;
}

interface Options {
  timer: GameTimer | undefined;
  view: TimerView & { now: number };
  ready: boolean;
  notify: (text: string, tone?: "info" | "error") => void;
}

const ACTIVE: TimerPhase[] = ["lead", "running", "paused"];
const ENDED: TimerPhase[] = ["timeup", "stopped"];
/** 重新整理 / 晚進來時，結束多久內還要顯示結束動畫 */
const LATE_END_WINDOW_MS = 30_000;

/**
 * 觀察倒數狀態的「變化」並觸發音效 / 動畫：
 *   3-2-1（每秒嗶）→ GO（開始音效）→ 最後 10 秒滴答 → 時間到（結束音效 + 動畫）
 *   管理員加時 / 暫停 / 重置 → 提示
 * 只在狀態「改變」時觸發，第一次載入不會重播（除非剛結束不久）。
 */
export function useTimerEvents({ timer, view, ready, notify }: Options) {
  const [bonus, setBonus] = useState<TimerBonus | null>(null);
  const [endOpen, setEndOpen] = useState(false);

  const prev = useRef<{ phase: TimerPhase; sec: number; timer: GameTimer } | null>(null);
  /** 已經播過結束動畫的那一輪（startedAt 當識別），同一輪只播一次 */
  const endedRound = useRef<string | null>(null);
  const nowRef = useRef(view.now);
  useEffect(() => {
    nowRef.current = view.now;
  }, [view.now]);

  const leadSec = Math.ceil(view.leadMs / 1000);
  const remSec = Math.ceil(view.remainingMs / 1000);
  const sec = view.phase === "lead" ? leadSec : remSec;

  useEffect(() => {
    if (!ready || !timer) return;
    const p = prev.current;
    prev.current = { phase: view.phase, sec, timer };
    // setState 放到下一個 tick（不在 effect 內同步 setState）
    const later = (fn: () => void) => window.setTimeout(fn, 0);

    // 第一次：只處理「剛結束不久」
    if (!p) {
      if (ENDED.includes(view.phase)) {
        const endAt = new Date(timer.endedAt ?? timer.endsAt ?? 0).getTime();
        if (nowRef.current - endAt < LATE_END_WINDOW_MS) {
          endedRound.current = timer.startedAt;
          later(() => setEndOpen(true));
        }
      }
      return;
    }

    // 3-2-1
    if (view.phase === "lead" && (p.phase !== "lead" || p.sec !== sec) && sec >= 1 && sec <= 3) sfx.count();

    // GO
    if (p.phase === "lead" && view.phase === "running") sfx.go();

    // 最後 10 秒滴答
    if (view.phase === "running" && p.phase === "running" && sec !== p.sec && sec <= FINAL_COUNT_S && sec >= 1) sfx.tick(sec);

    // 時間到 / 管理員結束
    if (ENDED.includes(view.phase) && !ENDED.includes(p.phase) && endedRound.current !== timer.startedAt) {
      endedRound.current = timer.startedAt;
      sfx.timeUp();
      later(() => setEndOpen(true));
    }

    // 提前完成（8/8 動畫由 CompletionOverlay 負責）
    if (view.phase === "completed" && p.phase !== "completed" && ACTIVE.includes(p.phase)) sfx.go();

    // 重新開始 / 重置 → 關掉舊的結束畫面
    if ((view.phase === "lead" || view.phase === "idle") && ENDED.includes(p.phase)) later(() => setEndOpen(false));

    // 管理員操作提示（同一輪倒數內的版本變化）
    if (timer.version !== p.timer.version) {
      const before = p.timer;
      if (before.status === "running" && timer.status === "running" && before.startedAt === timer.startedAt) {
        const diff = new Date(timer.endsAt!).getTime() - new Date(before.endsAt!).getTime();
        if (Math.abs(diff) >= 1000) {
          sfx.bonus();
          later(() =>
            setBonus({ id: Date.now(), text: `${diff > 0 ? "+" : "−"}${formatSpoken(Math.abs(diff))}`, positive: diff > 0 }),
          );
        }
      } else if (before.status === "paused" && timer.status === "paused") {
        const diff = (timer.remainingMs ?? 0) - (before.remainingMs ?? 0);
        if (Math.abs(diff) >= 1000) {
          sfx.bonus();
          later(() =>
            setBonus({ id: Date.now(), text: `${diff > 0 ? "+" : "−"}${formatSpoken(Math.abs(diff))}`, positive: diff > 0 }),
          );
        }
      } else if (before.status === "running" && timer.status === "paused") {
        sfx.pause();
        later(() => notify("⏸ 管理員暫停了倒數，等一下喔！"));
      } else if (timer.status === "idle" && before.status !== "idle") {
        later(() => notify("倒數已重置"));
      }
    }
  }, [ready, timer, view.phase, sec, notify]);

  // 加時提示自動消失
  useEffect(() => {
    if (!bonus) return;
    const t = window.setTimeout(() => setBonus(null), 2200);
    return () => window.clearTimeout(t);
  }, [bonus]);

  const duck = view.phase === "lead" || (view.phase === "running" && (view.justStarted || remSec <= FINAL_COUNT_S)) || endOpen;

  const closeEnd = useCallback(() => setEndOpen(false), []);
  return { bonus, endOpen, closeEnd, duck };
}
