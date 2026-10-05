"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { TimerBonus } from "@/hooks/useTimerEvents";
import { FINAL_COUNT_S, formatClock, formatSpoken, type TimerView } from "@/lib/timer";

interface Props {
  view: TimerView;
  bonus: TimerBonus | null;
  found: number;
  total: number;
}

function tone(view: TimerView) {
  if (view.phase === "timeup" || view.phase === "stopped") return { ring: "#ff6b4a", text: "text-[#ffb59f]" };
  if (view.phase === "completed") return { ring: "#7fd08c", text: "text-[#b9f0c2]" };
  if (view.phase === "paused") return { ring: "#9fb3c8", text: "text-cream/80" };
  if (view.ratio > 0.5) return { ring: "#7fd08c", text: "text-cream" };
  if (view.ratio > 0.2) return { ring: "#fdba2d", text: "text-[#ffe08a]" };
  return { ring: "#ff6b4a", text: "text-[#ffb59f]" };
}

/** 每個字元單獨翻動（秒數跳動的手感） */
function FlipClock({ value, className }: { value: string; className?: string }) {
  return (
    <span className={`inline-flex tabular-nums ${className ?? ""}`} aria-hidden>
      {value.split("").map((ch, i) => (
        <span key={`${value.length}-${i}`} className="relative inline-block overflow-hidden" style={{ width: ch === ":" ? "0.32em" : "0.62em" }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={ch}
              className="block text-center"
              initial={{ y: "-70%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "70%", opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

/**
 * 黏在畫面上方的倒數膠囊。
 * 顏色隨剩餘時間 綠 → 黃 → 紅；最後 1 分鐘心跳、最後 10 秒抖動；點一下展開看細節。
 */
export default function TimerBar({ view, bonus, found, total }: Props) {
  const [open, setOpen] = useState(false);
  if (view.phase === "idle") return null;

  const c = tone(view);
  const remSec = Math.ceil(view.remainingMs / 1000);
  const urgent = view.phase === "running" && remSec <= 60;
  const final = view.phase === "running" && remSec <= FINAL_COUNT_S;
  const R = 17;
  const C = 2 * Math.PI * R;

  const label = {
    lead: "準備開始",
    running: "剩餘時間",
    paused: "⏸ 暫停中",
    timeup: "時間到！",
    stopped: "遊戲結束",
    completed: "🎉 提前完成",
    idle: "",
  }[view.phase];

  const showClock = view.phase !== "timeup";
  const spoken =
    view.phase === "timeup"
      ? "倒數時間到"
      : view.phase === "completed"
        ? `提前完成，還剩 ${formatSpoken(view.remainingMs)}`
        : `${label}，${formatSpoken(view.remainingMs)}`;

  return (
    <div className="pointer-events-none sticky top-[calc(env(safe-area-inset-top)+8px)] z-40 mx-auto mt-1 flex w-full justify-center px-4">
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`倒數計時：${spoken}。點我${open ? "收合" : "看詳細"}`}
        className="wood-dark pointer-events-auto relative flex items-center gap-3 rounded-full border border-white/10 py-1.5 pl-1.5 pr-5 shadow-[0_8px_20px_rgba(0,0,0,0.45)] outline-none focus-visible:ring-4 focus-visible:ring-ember/60"
        initial={{ y: -30, opacity: 0, scale: 0.9 }}
        animate={
          final
            ? { y: 0, opacity: 1, scale: [1, 1.08, 1], rotate: [0, -2, 2, 0] }
            : urgent
              ? { y: 0, opacity: 1, scale: [1, 1.04, 1], rotate: 0 }
              : { y: 0, opacity: 1, scale: 1, rotate: 0 }
        }
        transition={
          final || urgent
            ? { duration: final ? 0.5 : 1, repeat: Infinity, repeatDelay: final ? 0.5 : 0, ease: "easeInOut" }
            : { type: "spring", stiffness: 300, damping: 22 }
        }
        whileTap={{ scale: 0.94 }}
        layout
      >
        {/* 進度圈 */}
        <span className="relative grid h-11 w-11 place-items-center" aria-hidden>
          <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
            <circle cx="20" cy="20" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
            <motion.circle
              cx="20"
              cy="20"
              r={R}
              fill="none"
              stroke={c.ring}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={C}
              animate={{ strokeDashoffset: C * (1 - view.ratio), stroke: c.ring }}
              transition={{ duration: 0.4, ease: "linear" }}
            />
          </svg>
          <span className={`text-[18px] ${view.phase === "running" ? "motion-loop inline-block animate-[sway_1s_ease-in-out_infinite]" : ""}`}>
            {view.phase === "timeup" || view.phase === "stopped" ? "⌛" : view.phase === "completed" ? "🏕️" : view.phase === "paused" ? "⏸" : "⏱️"}
          </span>
        </span>

        <span className="flex flex-col items-start leading-none">
          <span className="text-[11.5px] tracking-wider text-cream/65">{label}</span>
          {showClock ? (
            <FlipClock value={formatClock(view.remainingMs)} className={`mt-1 text-[26px] ${c.text}`} />
          ) : (
            <span className={`mt-1 text-[22px] ${c.text}`}>大家辛苦了</span>
          )}
        </span>

        {/* 加時 / 減時 泡泡 */}
        <AnimatePresence>
          {bonus && (
            <motion.span
              key={bonus.id}
              role="status"
              className={`absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[14px] shadow-lg ${
                bonus.positive ? "bg-forest text-white" : "bg-[#e8794a] text-white"
              }`}
              initial={{ x: -20, scale: 0.4, opacity: 0 }}
              animate={{ x: 0, scale: 1, opacity: 1 }}
              exit={{ y: -30, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 16 }}
            >
              {bonus.text} ⏰
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="paper pointer-events-auto absolute top-[calc(100%+8px)] w-[min(320px,calc(100%-32px))] rounded-2xl px-4 py-3 text-center text-ink shadow-xl"
            initial={{ y: -8, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -8, opacity: 0, scale: 0.96 }}
            onClick={() => setOpen(false)}
          >
            <p className="text-[15px]">
              {view.phase === "completed"
                ? `8 個小人全部找到！還剩 ${formatSpoken(view.remainingMs)} 🎉`
                : view.phase === "timeup" || view.phase === "stopped"
                  ? `這一輪結束了，大家一共找到 ${found} / ${total} 個`
                  : view.phase === "paused"
                    ? "管理員暫停了倒數，先休息一下～"
                    : `還有 ${total - found} 個小人躲著，加油！`}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10">
              <motion.div
                className="h-full rounded-full"
                style={{ background: c.ring }}
                animate={{ width: `${Math.round(view.ratio * 100)}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <p className="mt-1.5 text-[12px] text-ink/50">時間由管理員設定，所有人同步</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
