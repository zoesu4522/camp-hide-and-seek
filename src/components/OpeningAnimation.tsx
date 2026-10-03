"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CampScenery, SideTrees } from "./CampBackground";
import { Logo, PineIcon, WoodSign } from "./illustrations/Brand";
import CampFigure from "./illustrations/CampFigure";

interface Props {
  onDone: () => void;
}

/** 整段 opening 長度（秒），之後淡出 */
const HOLD = 2.35;
const FADE = 0.4;

function Leaves({ className, flip }: { className: string; flip?: boolean }) {
  return (
    <svg viewBox="0 0 160 160" className={className} style={flip ? { transform: "scaleX(-1)" } : undefined}>
      {[
        [40, 30, 30, "#2f5f39"],
        [70, 48, 50, "#3f7a4a"],
        [96, 70, 64, "#356b40"],
        [50, 70, 80, "#2a5233"],
        [118, 96, 72, "#4f8c5a"],
        [80, 20, 18, "#4a8656"],
      ].map(([x, y, r, c], i) => (
        <ellipse key={i} cx={x as number} cy={y as number} rx="30" ry="12" fill={c as string} transform={`rotate(${r} ${x} ${y})`} />
      ))}
    </svg>
  );
}

/**
 * Opening（約 2.7 秒）
 * 1 深藍黑 → 2 森林淡入（scale 1.08 → 1）→ 3 前景樹葉滑過鏡頭
 * → 4 Logo 落下（spring）→ 5 木牌滑入 → 6 小人從樹後探頭 → 淡出
 */
export default function OpeningAnimation({ onDone }: Props) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setLeaving(true), HOLD * 1000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {!leaving && (
        <motion.div
          key="opening"
          className="fixed inset-0 z-[70] overflow-hidden bg-night"
          exit={{ opacity: 0, transition: { duration: FADE } }}
          aria-label="開場動畫"
          role="presentation"
        >
          {/* Scene 2：森林淡入 + 鏡頭推進 */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ opacity: { duration: 0.6, delay: 0.15 }, scale: { duration: 2.6, ease: [0.22, 1, 0.36, 1] } }}
          >
            <CampScenery />
            <SideTrees />
          </motion.div>

          {/* Scene 3：前景樹葉滑過鏡頭 */}
          <motion.div
            className="pointer-events-none absolute -left-16 -top-10 w-64"
            initial={{ x: 40, y: 20, scale: 1.25, opacity: 0 }}
            animate={{ x: -70, y: -30, scale: 1, opacity: [0, 1, 1] }}
            transition={{ duration: 1.5, delay: 0.25, ease: "easeOut" }}
          >
            <Leaves className="w-full" />
          </motion.div>
          <motion.div
            className="pointer-events-none absolute -bottom-12 -right-16 w-64"
            initial={{ x: -40, y: -10, scale: 1.25, opacity: 0 }}
            animate={{ x: 70, y: 30, scale: 1, opacity: [0, 1, 1] }}
            transition={{ duration: 1.5, delay: 0.3, ease: "easeOut" }}
          >
            <Leaves className="w-full" flip />
          </motion.div>

          <div className="relative mx-auto flex h-full max-w-[430px] flex-col items-center px-4 pt-[calc(env(safe-area-inset-top)+28px)]">
            {/* Scene 4：Logo 從上方落下 */}
            <motion.div
              initial={{ y: -180, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 13, delay: 0.7 }}
            >
              <Logo className="text-[clamp(50px,14.5vw,64px)]" />
            </motion.div>

            {/* Scene 5：木牌從下方滑入 */}
            <motion.div
              className="mt-4 w-full max-w-[340px]"
              initial={{ y: 120, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 20, delay: 1.1 }}
            >
              <WoodSign>
                一起找出 8 個躲起來的小人吧！
                <PineIcon className="ml-1 inline-block h-4 w-4 -translate-y-0.5 text-forest" />
              </WoodSign>
            </motion.div>

            {/* Scene 6：小人從樹後探頭 */}
            <div className="relative mt-14 h-44 w-48">
              <motion.div
                className="absolute bottom-0 left-[40%] w-24"
                style={{ transformOrigin: "bottom center" }}
                initial={{ x: -80, rotate: -12 }}
                animate={{ x: 0, rotate: [-12, 8, 0] }}
                transition={{ delay: 1.45, duration: 0.6, ease: "easeOut" }}
              >
                <CampFigure pose="wave" className="w-full" />
              </motion.div>
              <div
                className="absolute bottom-0 left-[12%] top-0 w-14 rounded-lg"
                style={{ background: "linear-gradient(90deg, #2a1a0e, #4a2e17 45%, #2a1a0e)" }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLeaving(true)}
            className="absolute bottom-[calc(env(safe-area-inset-bottom)+14px)] right-3 min-h-11 rounded-full px-4 text-[13px] text-cream/55 outline-none focus-visible:ring-2 focus-visible:ring-cream/60"
          >
            跳過動畫 ›
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
