"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { FoundEvent } from "@/types/game";
import CampFigure, { SLOT_POSES } from "./illustrations/CampFigure";

interface Props {
  event: FoundEvent | null;
  total: number;
}

const RAYS = Array.from({ length: 10 }, (_, i) => i * 36);

/** 有人找到小人時的半屏短動畫（約 1.4 秒自動退場，不攔截點擊） */
export default function FoundToast({ event, total }: Props) {
  return (
    <AnimatePresence>
      {event && (
        <motion.div
          key={event.key}
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="status"
          aria-live="assertive"
        >
          <div className="absolute inset-0 bg-[#020a14]/45" />

          <motion.div
            className="paper relative w-full max-w-[300px] rounded-[26px] px-5 pb-5 pt-4 text-center"
            initial={{ scale: 0.6, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: -20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 22 }}
          >
            {/* 光芒 */}
            <div className="absolute left-1/2 top-12 -translate-x-1/2" aria-hidden>
              {RAYS.map((deg, i) => (
                <span key={deg} className="absolute left-0 top-0" style={{ transform: `rotate(${deg}deg)` }}>
                  <motion.span
                    className="absolute -left-[1.5px] top-0 block h-2.5 w-[3px] rounded-full bg-ember"
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: [30, 54], opacity: [0, 1, 0] }}
                    transition={{ duration: 0.7, delay: 0.1 + (i % 2) * 0.05 }}
                  />
                </span>
              ))}
            </div>

            <div className="text-[22px]" aria-hidden>
              ✨
            </div>
            <motion.div
              className="mx-auto -mt-1 w-24"
              initial={{ rotateY: 90, scale: 0.7 }}
              animate={{ rotateY: 0, scale: 1 }}
              transition={{ duration: 0.45, delay: 0.05 }}
            >
              {event.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- 玩家上傳照片
                <img
                  src={event.photoUrl}
                  alt=""
                  className="aspect-[3/4] w-full rounded-xl border-[3px] border-white object-cover shadow-[0_6px_14px_rgba(0,0,0,0.25)]"
                  style={{ rotate: "-3deg" }}
                />
              ) : (
                <CampFigure pose={SLOT_POSES[(event.number - 1) % SLOT_POSES.length]} className="w-full" />
              )}
            </motion.div>
            <p className="mt-2 text-[28px] leading-tight text-ink">
              找到 <span className="text-wood">#{event.number}</span>！
            </p>
            <p className="mt-0.5 text-[13px] text-ink/60">
              {event.source === "local" ? "已同步給所有玩家" : "其他玩家剛剛找到了"}
            </p>
            <div className="mx-auto mt-3 w-fit rounded-xl bg-wood px-4 py-1.5 text-cream">
              <span className="text-[13px] tracking-widest">目前進度　</span>
              <span className="text-[20px]">
                {event.foundCount} / {total}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
