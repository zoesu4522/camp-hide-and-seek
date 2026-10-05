"use client";

import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import CampFigure from "../illustrations/CampFigure";
import { FINAL_COUNT_S, type TimerView } from "@/lib/timer";
import type { GameTimer } from "@/types/game";

interface Props {
  view: TimerView;
  timer: GameTimer | undefined;
  endOpen: boolean;
  onCloseEnd: () => void;
  found: number;
  total: number;
}

/** 倒數相關的全螢幕動畫：3-2-1-GO、最後 10 秒大數字、時間到 */
export default function TimerOverlays({ view, timer, endOpen, onCloseEnd, found, total }: Props) {
  const leadSec = Math.ceil(view.leadMs / 1000);
  const remSec = Math.ceil(view.remainingMs / 1000);
  // 暫停後繼續：剩餘 < 總時間
  const resumed = !!timer?.durationMs && view.remainingMs < timer.durationMs - 1500;

  return (
    <>
      <AnimatePresence>
        {view.phase === "lead" && leadSec >= 1 && leadSec <= 3 && (
          <LeadOverlay key="lead" sec={leadSec} resumed={resumed} />
        )}
        {view.phase === "running" && view.justStarted && <GoOverlay key="go" resumed={resumed} />}
      </AnimatePresence>

      <AnimatePresence>
        {view.phase === "running" && !view.justStarted && remSec <= FINAL_COUNT_S && remSec >= 1 && (
          <FinalCountdown key="final" sec={remSec} />
        )}
      </AnimatePresence>

      <EndOverlay
        open={endOpen}
        reason={view.phase === "stopped" ? "stopped" : "timeup"}
        found={found}
        total={total}
        onClose={onCloseEnd}
      />
    </>
  );
}

/* ---------------- 3-2-1 ---------------- */

function LeadOverlay({ sec, resumed }: { sec: number; resumed: boolean }) {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[62] flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      role="status"
      aria-live="assertive"
    >
      <div className="absolute inset-0 bg-[#020a14]/[0.88]" />
      <motion.p
        className="text-outline-sm relative text-[20px] tracking-[0.2em] text-cream/90"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        {resumed ? "倒數繼續！" : "倒數即將開始"}
      </motion.p>
      <div className="relative mt-4 grid h-[220px] w-[220px] place-items-center">
        {/* 擴散光圈 */}
        <motion.span
          key={`ring-${sec}`}
          className="absolute inset-0 rounded-full border-[6px] border-ember"
          initial={{ scale: 0.4, opacity: 0.9 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
        <span className="absolute inset-6 rounded-full bg-[radial-gradient(closest-side,rgba(253,186,45,0.35),transparent)]" />
        <AnimatePresence mode="popLayout">
          <motion.span
            key={sec}
            className="text-outline relative text-[150px] leading-none text-ember"
            initial={{ scale: 2.4, opacity: 0, rotate: -12 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.3, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 18 }}
          >
            {sec}
          </motion.span>
        </AnimatePresence>
      </div>
      <motion.div
        className="relative mt-2 w-20"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 1, repeat: Infinity }}
        aria-hidden
      >
        <CampFigure pose="search" className="w-full" />
      </motion.div>
    </motion.div>
  );
}

/* ---------------- GO! ---------------- */

const RAYS = Array.from({ length: 12 }, (_, i) => i * 30);

function GoOverlay({ resumed }: { resumed: boolean }) {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[62] flex items-center justify-center overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      role="status"
      aria-live="assertive"
    >
      <motion.div
        className="absolute inset-0 bg-[#020a14]"
        initial={{ opacity: 0.88 }}
        animate={{ opacity: 0.55 }}
        transition={{ duration: 0.8 }}
      />
      {RAYS.map((deg) => (
        <motion.span
          key={deg}
          className="absolute left-1/2 top-1/2 h-2 w-28 origin-left rounded-full bg-ember"
          style={{ rotate: deg }}
          initial={{ x: 30, scaleX: 0.2, opacity: 1 }}
          animate={{ x: 160, scaleX: 1, opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      ))}
      <div className="relative flex flex-col items-center">
        <motion.span
          className="text-outline text-[120px] leading-none text-ember"
          initial={{ scale: 0.2, rotate: -20 }}
          animate={{ scale: [0.2, 1.3, 1], rotate: [-20, 6, 0] }}
          transition={{ duration: 0.5, times: [0, 0.6, 1] }}
        >
          GO!
        </motion.span>
        <motion.span
          className="text-outline-sm mt-1 text-[22px] text-cream"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          {resumed ? "繼續找小人！" : "開始找小人！🔦"}
        </motion.span>
        <div className="mt-2 flex gap-1" aria-hidden>
          {(["cheer", "star", "cheer"] as const).map((p, i) => (
            <motion.div
              key={i}
              className="w-14"
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: [60, -18, 0], opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.5 }}
            >
              <CampFigure pose={p} className="w-full" />
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------- 最後 10 秒 ---------------- */

function FinalCountdown({ sec }: { sec: number }) {
  const hot = sec <= 3;
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[45] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      aria-hidden
    >
      {/* 邊框紅光脈動 */}
      <motion.div
        key={`glow-${sec}`}
        className="absolute inset-0"
        style={{ boxShadow: `inset 0 0 ${hot ? 120 : 70}px rgba(255,80,50,${hot ? 0.65 : 0.4})` }}
        initial={{ opacity: 1 }}
        animate={{ opacity: 0.25 }}
        transition={{ duration: 0.9 }}
      />
      <span className="absolute h-[260px] w-[260px] rounded-full bg-[radial-gradient(closest-side,rgba(2,10,20,0.75),rgba(2,10,20,0))]" />
      <AnimatePresence mode="popLayout">
        <motion.span
          key={sec}
          className={`text-outline relative leading-none ${hot ? "text-[#ff7a59]" : "text-cream"}`}
          style={{ fontSize: hot ? 190 : 150, opacity: 0.85 }}
          initial={{ scale: 1.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.85 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 20 }}
        >
          {sec}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}

/* ---------------- 時間到 ---------------- */

function CountUp({ to, delay }: { to: number; delay: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctl = animate(0, to, {
      duration: 0.8,
      delay,
      ease: "easeOut",
      onUpdate: (v) => {
        el.textContent = String(Math.round(v));
      },
    });
    return () => ctl.stop();
  }, [to, delay]);
  return <span ref={ref}>0</span>;
}

function cheerText(found: number, total: number) {
  if (found >= total) return "全部找到，太神啦！";
  if (found >= total - 2) return "差一點點就全部找到了！";
  if (found >= total / 2) return "找到一大半，很厲害！";
  if (found > 0) return "小人們躲得太好了～";
  return "小人們全部躲過了！下次再挑戰！";
}

function EndOverlay({
  open,
  reason,
  found,
  total,
  onClose,
}: {
  open: boolean;
  reason: "timeup" | "stopped";
  found: number;
  total: number;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const ctaRef = useRef<HTMLButtonElement>(null);
  const title = reason === "timeup" ? ["時", "間", "到", "！"] : ["遊", "戲", "結", "束"];

  useEffect(() => {
    if (!open) return;
    const t2 = window.setTimeout(() => ctaRef.current?.focus(), 1800);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t2);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="timer-end"
          className="fixed inset-0 z-[63] flex items-center justify-center overflow-hidden px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="timer-end-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
        >
          <motion.div
            className="absolute inset-0 bg-[#1a0606]"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0.86] }}
            transition={{ duration: 0.6, times: [0, 0.3, 1] }}
          />
          {/* 紅色閃光 */}
          <motion.div
            className="absolute inset-0 bg-[#ff5a3c]"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.35, 0, 0.2, 0] }}
            transition={{ duration: 0.9 }}
            aria-hidden
          />

          <motion.div
            className="relative flex w-full max-w-[380px] flex-col items-center text-center"
            // 字掉下來後震一下（同一個元素，不重新掛載，動畫只播一次）
            animate={reduce ? undefined : { x: [0, -14, 12, -8, 6, -3, 0] }}
            transition={{ duration: 0.5, delay: 0.65 }}
          >
            {/* 沙漏 */}
            <motion.div
              className="text-[64px] leading-none"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: [-180, 0, 0, 180] }}
              transition={{ duration: 1.6, times: [0, 0.35, 0.75, 1], delay: 0.1 }}
              aria-hidden
            >
              ⌛
            </motion.div>

            {/* 標題一個字一個字掉下來 */}
            <h2 id="timer-end-title" className="mt-2 flex text-[54px] leading-tight text-cream" aria-label={title.join("")}>
              {title.map((ch, i) => (
                <motion.span
                  key={i}
                  className="text-outline inline-block"
                  initial={{ y: -260, rotate: i % 2 ? 20 : -20, opacity: 0 }}
                  animate={{ y: 0, rotate: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 14, delay: 0.25 + i * 0.1 }}
                  aria-hidden
                >
                  {ch}
                </motion.span>
              ))}
            </h2>

            {/* 小人們累倒 */}
            <div className="mt-1 flex h-[70px] items-end gap-1" aria-hidden>
              {(["lie", "curl", "kneel", "curl", "lie"] as const).map((p, i) => (
                <motion.div
                  key={i}
                  className="w-12"
                  initial={{ y: -120, opacity: 0, rotate: i % 2 ? 40 : -40 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.75 + i * 0.07 }}
                >
                  <CampFigure pose={p} variant="found" className={`w-full ${i % 2 ? "-scale-x-100" : ""}`} />
                </motion.div>
              ))}
            </div>

            <motion.div
              className="paper mt-4 w-full rounded-[24px] px-5 py-4 text-ink"
              initial={{ y: 30, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 1.1 }}
            >
              <p className="text-[15px] text-ink/70">大家一共找到</p>
              <p className="mt-1 text-[44px] leading-none text-wood">
                <CountUp to={found} delay={1.3} /> <span className="text-[26px] text-ink/50">/ {total}</span>
              </p>
              <p className="mt-2 text-[16px]">{cheerText(found, total)}</p>
            </motion.div>

            <motion.button
              ref={ctaRef}
              type="button"
              onClick={onClose}
              className="mt-6 min-h-[52px] rounded-2xl px-7 text-[17px] text-ink outline-none focus-visible:ring-4 focus-visible:ring-sky/70"
              style={{
                background: "linear-gradient(180deg, #ffd66b 0%, #fdba2d 60%, #e9a01b 100%)",
                boxShadow: "inset 0 -4px 0 rgba(139,87,42,0.45), 0 8px 20px rgba(253,186,45,0.4)",
              }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 1.6 }}
              whileTap={{ scale: 0.96 }}
            >
              回到營地
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
