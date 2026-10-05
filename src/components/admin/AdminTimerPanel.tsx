"use client";

import { useEffect, useState } from "react";
import { useGameTimer } from "@/hooks/useGameTimer";
import { formatClock } from "@/lib/timer";
import type { AdminService, GameTimer, TimerAction } from "@/types/game";

interface Props {
  service: AdminService;
  timer: GameTimer | undefined;
  onChanged: () => void;
}

const PRESETS = [5, 10, 15, 20, 30, 45, 60];

const PHASE_LABEL = {
  idle: { text: "尚未開始", cls: "bg-white/10 text-cream/70" },
  lead: { text: "3-2-1 準備中", cls: "bg-ember/20 text-ember" },
  running: { text: "● 倒數中", cls: "bg-forest/25 text-[#9fe0aa]" },
  paused: { text: "⏸ 暫停中", cls: "bg-white/10 text-cream" },
  timeup: { text: "⌛ 時間到", cls: "bg-[#e8794a]/20 text-[#ffab88]" },
  stopped: { text: "已手動結束", cls: "bg-[#e8794a]/20 text-[#ffab88]" },
  completed: { text: "🎉 提前完成", cls: "bg-sky/20 text-[#9bd8f7]" },
} as const;

/** 後台：倒數計時控制（所有玩家即時同步） */
export default function AdminTimerPanel({ service, timer, onChanged }: Props) {
  const [offset, setOffset] = useState(0);
  const [minutes, setMinutes] = useState(15);
  const [custom, setCustom] = useState("");
  const [confirm, setConfirm] = useState<TimerAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const view = useGameTimer(timer, offset);

  useEffect(() => {
    let cancelled = false;
    service
      .getClockOffset()
      .then((o) => !cancelled && setOffset(o))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [service]);

  // 確認提示 5 秒後自動取消
  useEffect(() => {
    if (!confirm) return;
    const t = window.setTimeout(() => setConfirm(null), 5000);
    return () => window.clearTimeout(t);
  }, [confirm]);

  const customMin = Number(custom);
  const chosen = custom ? customMin : minutes;
  const validChosen = Number.isFinite(chosen) && chosen >= 1 && chosen <= 180;

  const run = async (action: TimerAction, seconds?: number, needConfirm = false) => {
    if (needConfirm && confirm !== action) {
      setConfirm(action);
      return;
    }
    setConfirm(null);
    setBusy(true);
    setError(null);
    const res = await service.controlTimer(action, seconds).catch(() => ({ ok: false }));
    if (!res.ok) setError("操作沒有成功（可能狀態已被其他管理員改變），已重新整理。");
    setBusy(false);
    onChanged();
  };

  const phase = view.phase;
  const active = phase === "lead" || phase === "running" || phase === "paused";
  const badge = PHASE_LABEL[phase];
  const btn = "min-h-11 rounded-xl px-4 text-[15px] disabled:opacity-50";

  return (
    <section className="mt-5 rounded-2xl border border-ember/30 bg-[#132a40] p-4" aria-labelledby="timer-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="timer-title" className="text-[17px]">
          ⏱ 倒數計時
        </h2>
        <span className={`rounded-full px-3 py-0.5 text-[13px] ${badge.cls}`}>{badge.text}</span>
      </div>

      {phase !== "idle" && (
        <p
          className={`mt-2 text-center text-[52px] leading-none tabular-nums ${
            phase === "running" && view.remainingMs <= 60_000 ? "text-[#ff8f6e]" : "text-cream"
          }`}
          aria-live="off"
        >
          {phase === "timeup" ? "0:00" : formatClock(view.remainingMs)}
        </p>
      )}
      {phase === "lead" && <p className="mt-1 text-center text-[13px] text-ember">玩家畫面正在播 3-2-1（{Math.ceil(view.leadMs / 1000)}）</p>}

      {!active && (
        <div className="mt-3">
          <p className="text-[13px] text-cream/60">選擇時間（分鐘）</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMinutes(m);
                  setCustom("");
                }}
                aria-pressed={!custom && minutes === m}
                className={`min-h-10 min-w-12 rounded-full px-3 text-[15px] ${
                  !custom && minutes === m ? "bg-ember text-ink" : "border border-white/15 text-cream/85"
                }`}
              >
                {m}
              </button>
            ))}
            <label className="flex items-center gap-1.5 rounded-full border border-white/15 pl-3 pr-1 text-[14px] text-cream/70">
              自訂
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={180}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="—"
                aria-label="自訂分鐘數"
                className="h-9 w-16 rounded-full bg-[#07182b] px-2 text-center text-cream outline-none focus:ring-2 focus:ring-ember"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !validChosen}
              onClick={() => run("start", Math.round(chosen * 60), true)}
              className={`${btn} bg-forest text-white`}
            >
              {confirm === "start" ? `確定開始 ${chosen} 分鐘？再按一次` : `▶ 開始倒數 ${validChosen ? `${chosen} 分鐘` : ""}`}
            </button>
            {phase !== "idle" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => run("reset", undefined, true)}
                className={`${btn} border border-white/15 text-cream/80`}
              >
                {confirm === "reset" ? "確定重置？" : "重置"}
              </button>
            )}
          </div>
          <p className="mt-2 text-[12.5px] text-cream/50">按下開始後，所有玩家會同時看到 3-2-1 和開始音效。</p>
        </div>
      )}

      {active && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {phase === "paused" ? (
            <button type="button" disabled={busy} onClick={() => run("resume")} className={`${btn} bg-forest text-white`}>
              ▶ 繼續
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || phase === "lead"}
              onClick={() => run("pause")}
              className={`${btn} bg-white/10 text-cream`}
            >
              ⏸ 暫停
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => run("add", 60)} className={`${btn} border border-forest/60 text-[#9fe0aa]`}>
            +1 分
          </button>
          <button type="button" disabled={busy} onClick={() => run("add", 300)} className={`${btn} border border-forest/60 text-[#9fe0aa]`}>
            +5 分
          </button>
          <button
            type="button"
            disabled={busy || view.remainingMs <= 61_000}
            onClick={() => run("add", -60)}
            className={`${btn} border border-white/15 text-cream/80`}
          >
            −1 分
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run("end", undefined, true)}
            className={`${btn} bg-[#d9633a] text-white`}
          >
            {confirm === "end" ? "確定結束？再按一次" : "⏹ 結束"}
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-[#2a1610] px-3 py-2 text-[14px] text-[#ffcbb5]" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
