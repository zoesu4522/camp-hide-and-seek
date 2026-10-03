"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Figure } from "@/types/game";
import CampFigure, { SLOT_POSES } from "./illustrations/CampFigure";

interface Props {
  figure: Figure;
  /** 剛被找到（本地或同步），播放 sparkles + FOUND! */
  celebrate: boolean;
  onSelect: (figure: Figure) => void;
  onView: (figure: Figure) => void;
}

const SPARKS = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2;
  return { x: Math.cos(a) * 46, y: Math.sin(a) * 52, c: i % 2 ? "#FDBA2D" : "#FFF5E7" };
});

export default function FigureCard({ figure, celebrate, onSelect, onView }: Props) {
  const pose = SLOT_POSES[(figure.number - 1) % SLOT_POSES.length];
  const found = figure.isFound;

  return (
    <div className="relative [perspective:700px]">
      <motion.button
        type="button"
        onClick={() => (found ? onView(figure) : onSelect(figure))}
        aria-label={
          found
            ? `${figure.number} 號小人：已找到，點我看照片`
            : `${figure.number} 號小人：還沒找到，點我回報找到了`
        }
        className="relative block aspect-[3/4] w-full rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-ember/80 [transform-style:preserve-3d]"
        initial={false}
        animate={{ rotateY: found ? 180 : 0, scale: found ? [1, 1.15, 1] : 1 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        whileTap={{ scale: 0.95 }}
      >
        {/* 正面：未找到 */}
        <span className="backface-hidden absolute inset-0 flex flex-col items-center overflow-hidden rounded-2xl border-2 border-[#d8c3a3] bg-[#e9dcc6] shadow-[inset_0_-4px_0_rgba(139,87,42,0.25),0_6px_12px_rgba(0,0,0,0.35)]">
          <span className="relative mt-[10%] flex w-[72%] justify-center opacity-50">
            <CampFigure pose={pose} variant="hidden" className="w-full" />
            <span className="absolute inset-0 grid place-items-center pb-[18%] text-[clamp(20px,6vw,28px)] text-[#eadfcd]">
              ?
            </span>
          </span>
          <span className="absolute bottom-1.5 rounded-md bg-wood px-2 text-[13px] leading-5 text-cream shadow">
            #{figure.number}
          </span>
        </span>

        {/* 背面：已找到 */}
        <span
          className="backface-hidden absolute inset-0 flex flex-col items-center overflow-hidden rounded-2xl border-2 border-ember"
          style={{
            transform: "rotateY(180deg)",
            background: "radial-gradient(120% 80% at 50% 30%, #fffdf6 0%, #fff1d2 55%, #ffd98a 100%)",
            boxShadow: "0 0 0 3px rgba(253,186,45,0.35), 0 0 18px 4px rgba(253,186,45,0.45), 0 6px 12px rgba(0,0,0,0.35)",
          }}
        >
          {figure.photoUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- 玩家上傳照片 */}
              <img src={figure.photoUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
            </>
          ) : (
            <span className="mt-[8%] w-[74%]">
              <CampFigure pose={pose} className="w-full" />
            </span>
          )}
          <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-forest text-white shadow">
            <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden>
              <path d="M3 8.5 L6.5 12 L13 4.5" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="absolute bottom-1.5 whitespace-nowrap rounded-md bg-forest px-1.5 text-[clamp(9px,2.7vw,11px)] font-bold leading-5 tracking-wide text-white shadow">
            #{figure.number} FOUND
          </span>
        </span>
      </motion.button>

      {/* 慶祝：sparkles + FOUND! */}
      <AnimatePresence>
        {celebrate && (
          <motion.div
            key="celebrate"
            className="pointer-events-none absolute inset-0 z-10"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden
          >
            {SPARKS.map((s, i) => (
              <motion.span
                key={i}
                className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full"
                style={{ background: s.c, boxShadow: `0 0 6px ${s.c}` }}
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{ x: s.x, y: s.y, scale: [0, 1.2, 0], opacity: [1, 1, 0] }}
                transition={{ duration: 0.8, delay: 0.35, ease: "easeOut" }}
              />
            ))}
            <motion.span
              className="text-outline-sm absolute inset-x-0 -top-3 text-center text-[16px] text-ember"
              initial={{ opacity: 0, y: 8, scale: 0.6 }}
              animate={{ opacity: [0, 1, 1, 0], y: [8, -6, -10, -16], scale: [0.6, 1.1, 1, 1] }}
              transition={{ duration: 1.4, delay: 0.4, times: [0, 0.2, 0.75, 1] }}
            >
              FOUND!
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
