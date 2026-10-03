"use client";

import { AnimatePresence, motion } from "framer-motion";
import { easeOutSoft } from "@/motion/variants";

interface Props {
  found: number;
  total: number;
  onReplayCelebration?: () => void;
}

export default function ProgressBoard({ found, total, onReplayCelebration }: Props) {
  const remaining = total - found;
  const pct = (found / total) * 100;
  const done = found >= total;

  return (
    <section aria-labelledby="progress-title" className="relative mx-auto mt-2 w-full max-w-[360px] px-4">
      {/* 吊牌 */}
      <div className="relative z-10 mx-auto -mb-3 w-fit">
        <div className="wood rounded-lg px-4 py-1">
          <h2 id="progress-title" className="text-outline-sm text-[15px] tracking-[0.2em] text-cream">
            目前進度
          </h2>
        </div>
      </div>

      <div className="wood relative rounded-[22px] px-5 pb-4 pt-5">
        <span className="nail absolute left-3 top-3" />
        <span className="nail absolute right-3 top-3" />

        <div className="flex items-end justify-center gap-2" aria-live="polite" aria-atomic>
          <span className="sr-only">
            已找到 {found} 個，共 {total} 個小人
          </span>
          <span aria-hidden className="relative inline-flex h-[60px] w-[52px] justify-center overflow-visible">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={found}
                className="text-outline absolute bottom-0 text-[60px] leading-none text-cream"
                initial={{ opacity: 0, y: -18, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: [1, 1.2, 1] }}
                exit={{ opacity: 0, y: 18 }}
                transition={{ duration: 0.3, scale: { duration: 0.3, times: [0, 0.5, 1] } }}
              >
                {found}
              </motion.span>
            </AnimatePresence>
          </span>
          <span aria-hidden className="text-outline mb-1 text-[44px] leading-none text-cream/90">
            /
          </span>
          <span aria-hidden className="text-outline text-[60px] leading-none text-ember">
            {total}
          </span>
        </div>

        {/* 進度條：連續填滿 + 8 格分隔 */}
        <div
          className="relative mt-3 h-4 overflow-hidden rounded-full bg-[#3b2412] shadow-[inset_0_2px_3px_rgba(0,0,0,0.5)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={found}
          aria-label="尋找進度"
        >
          <motion.div
            className="absolute inset-y-0 left-0 origin-left rounded-full"
            style={{
              width: "100%",
              background: "linear-gradient(180deg, #ffe08a 0%, #fdba2d 55%, #e2961a 100%)",
            }}
            initial={false}
            animate={{ scaleX: pct / 100 }}
            transition={{ duration: 0.7, ease: easeOutSoft }}
          />
          <div className="absolute inset-0 flex">
            {Array.from({ length: total - 1 }, (_, i) => (
              <span key={i} className="h-full flex-1 border-r-2 border-[#3b2412]/70" />
            ))}
            <span className="flex-1" />
          </div>
        </div>

        <p className="mt-2.5 text-center text-[14px] text-cream/90">
          {done ? (
            <button
              type="button"
              onClick={onReplayCelebration}
              className="min-h-11 rounded-full px-3 text-ember underline-offset-4 hover:underline"
            >
              🎉 任務完成！再看一次慶祝
            </button>
          ) : found === 0 ? (
            "出發吧！8 個小人都還躲著"
          ) : (
            <>
              還有 <span className="text-ember">{remaining}</span> 個小人躲著
            </>
          )}
        </p>
      </div>
    </section>
  );
}
