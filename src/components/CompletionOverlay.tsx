"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import CampFigure, { SLOT_POSES } from "./illustrations/CampFigure";

interface Props {
  open: boolean;
  total: number;
  onClose: () => void;
}

// 8 個小人從左下 / 右下 / 左右側跳入，落在一排弧線上
const JUMPERS = SLOT_POSES.map((pose, i) => {
  const fromLeft = i < 4;
  const fromSide = i % 4 === 0 || i % 4 === 3;
  const col = i; // 0..7
  return {
    pose: pose === "lie" || pose === "curl" || pose === "bow" ? ("cheer" as const) : pose,
    fromX: fromLeft ? -220 : 220,
    fromY: fromSide ? -40 : 260,
    x: (col - 3.5) * 38,
    y: Math.abs(col - 3.5) * 5,
    delay: 0.75 + (fromLeft ? i : 7 - i) * 0.07,
  };
});

function Campfire() {
  return (
    <svg viewBox="0 0 120 110" className="w-full" aria-hidden>
      <ellipse cx="60" cy="100" rx="46" ry="7" fill="#000" opacity="0.35" />
      <rect x="20" y="86" width="80" height="12" rx="6" fill="#6b4421" transform="rotate(-12 60 92)" />
      <rect x="20" y="86" width="80" height="12" rx="6" fill="#8b572a" transform="rotate(12 60 92)" />
      <path d="M60 10 C78 34 90 52 82 72 C78 84 70 90 60 90 C48 90 38 82 36 70 C32 52 50 40 60 10 Z" fill="#ff8a1f" />
      <path d="M60 32 C70 48 76 58 72 72 C70 80 66 84 60 84 C53 84 47 79 46 71 C45 58 54 50 60 32 Z" fill="#fdba2d" />
      <path d="M60 54 C65 62 67 68 65 75 C64 79 62 81 60 81 C57 81 54 78 54 74 C54 68 58 63 60 54 Z" fill="#fff3c4" />
    </svg>
  );
}

export default function CompletionOverlay({ open, total, onClose }: Props) {
  const reduce = useReducedMotion();
  const ctaRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timers: number[] = [];

    // confetti 延遲載入，避免進首屏 bundle
    import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled || reduce) return;
      const colors = ["#FDBA2D", "#FFF5E7", "#5D9A68", "#55B7E9", "#A86B32"];
      const fire = (opts: Parameters<typeof confetti>[0]) =>
        confetti({ colors, disableForReducedMotion: true, zIndex: 65, ...opts });
      timers.push(
        window.setTimeout(() => {
          fire({ particleCount: 90, spread: 80, startVelocity: 48, origin: { x: 0.5, y: 0.55 } });
        }, 550),
        window.setTimeout(() => {
          fire({ particleCount: 45, angle: 60, spread: 60, origin: { x: 0, y: 0.8 } });
          fire({ particleCount: 45, angle: 120, spread: 60, origin: { x: 1, y: 0.8 } });
        }, 900),
      );
    });
    timers.push(window.setTimeout(() => ctaRef.current?.focus(), 1900));

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, reduce, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="completion"
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="complete-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
        >
          {/* 1. 畫面變暗 */}
          <motion.div
            className="absolute inset-0 bg-[#020a14]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.82 }}
            transition={{ duration: 0.3 }}
          />

          {/* 3. 營火亮起（光暈） */}
          <motion.div
            className="absolute left-1/2 top-[54%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: "radial-gradient(closest-side, rgba(253,170,45,0.55), rgba(253,120,45,0.18) 55%, rgba(253,120,45,0))" }}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: [0, 1, 0.85], scale: [0.3, 1.15, 1] }}
            transition={{ duration: 0.8, delay: 0.45 }}
            aria-hidden
          />

          <div className="relative flex w-full max-w-[400px] flex-col items-center text-center">
            {/* 2. 8 / 8 */}
            <motion.div
              className="text-outline text-[76px] leading-none text-ember"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.15 }}
            >
              {total} / {total}
            </motion.div>

            {/* 營火 */}
            <motion.div
              className="mt-1 w-24"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.5 }}
            >
              <div className="motion-loop animate-flicker" style={{ animationDuration: "1.6s" }}>
                <Campfire />
              </div>
            </motion.div>

            {/* 5. 8 個小人跳入 */}
            <div className="relative -mt-2 h-[78px] w-full" aria-hidden>
              {JUMPERS.map((j, i) => (
                <motion.div
                  key={i}
                  className="absolute bottom-0 left-1/2 -ml-[22px] w-11"
                  initial={{ x: j.fromX, y: j.fromY, opacity: 0, rotate: j.fromX < 0 ? -30 : 30 }}
                  animate={{
                    x: j.x,
                    y: [j.fromY, -70 + j.y, j.y],
                    opacity: 1,
                    rotate: 0,
                  }}
                  transition={{
                    delay: j.delay,
                    duration: 0.6,
                    x: { duration: 0.6, ease: "easeOut", delay: j.delay },
                    y: { duration: 0.6, times: [0, 0.55, 1], ease: ["easeOut", "easeIn"], delay: j.delay },
                  }}
                >
                  <CampFigure pose={j.pose} className="w-full" />
                </motion.div>
              ))}
            </div>

            {/* 6. 主標題 */}
            <motion.h2
              id="complete-title"
              className="text-outline mt-4 text-[38px] leading-tight text-cream"
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 16, delay: 1.3 }}
            >
              <span aria-hidden>🎉 </span>任務完成！<span aria-hidden> 🎉</span>
            </motion.h2>

            {/* 7. 副標題 */}
            <motion.p
              className="mt-2 text-[17px] text-cream/90"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 1.55 }}
            >
              8 個躲起來的小人全部找到啦！
            </motion.p>

            {/* 8. CTA */}
            <motion.button
              ref={ctaRef}
              type="button"
              onClick={onClose}
              className="mt-7 min-h-[52px] rounded-2xl px-7 text-[17px] text-ink outline-none focus-visible:ring-4 focus-visible:ring-sky/70"
              style={{
                background: "linear-gradient(180deg, #ffd66b 0%, #fdba2d 60%, #e9a01b 100%)",
                boxShadow: "inset 0 -4px 0 rgba(139,87,42,0.45), 0 8px 20px rgba(253,186,45,0.4)",
              }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 1.8 }}
              whileTap={{ scale: 0.96 }}
            >
              看看大家找到的小人
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
