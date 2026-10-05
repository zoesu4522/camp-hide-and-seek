"use client";

import { useEffect, useState } from "react";
import { computeTimer, type TimerView } from "@/lib/timer";
import { IDLE_TIMER, type GameTimer } from "@/types/game";

/**
 * 依伺服器時間計算目前倒數畫面。
 * 倒數中每 200ms 更新一次；暫停 / 結束時不跑計時器。
 */
export function useGameTimer(timer: GameTimer | undefined, clockOffset: number): TimerView & { now: number } {
  const t = timer ?? IDLE_TIMER;
  const [now, setNow] = useState(() => Date.now() + clockOffset);
  const view = computeTimer(t, now);
  // 時間到之後就不用再跑
  const ticking = t.status === "running" && view.phase !== "timeup";

  useEffect(() => {
    const tick = () => setNow(Date.now() + clockOffset);
    const first = window.setTimeout(tick, 0);
    if (!ticking) return () => window.clearTimeout(first);
    const id = window.setInterval(tick, 200);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [ticking, clockOffset, t.version]);

  return { ...view, now };
}
