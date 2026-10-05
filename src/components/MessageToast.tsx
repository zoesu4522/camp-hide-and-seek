"use client";

import { AnimatePresence, motion, useAnimate, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

export interface ToastMessage {
  id: number;
  text: string;
  tone: "info" | "error";
}

/**
 * 頂部小提示（例如：已被別人找到、點亮失敗、時間到）。
 * - 同一句話連續出現（例如一直點）→ 不換新的，原本那個輕輕晃一下
 * - 換成另一句話 → 新舊重疊在同一個位置淡入淡出，不會左右擠來擠去
 */
export default function MessageToast({ message }: { message: ToastMessage | null }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+14px)] z-50 grid justify-items-center px-4">
      <AnimatePresence initial={false}>
        {message && <Toast key={`${message.tone}:${message.text}`} message={message} />}
      </AnimatePresence>
    </div>
  );
}

function Toast({ message }: { message: ToastMessage }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduce = useReducedMotion();
  const firstId = useRef(message.id);

  // 重複同一則：晃一下提醒「我有收到」
  useEffect(() => {
    if (message.id === firstId.current || reduce || !scope.current) return;
    animate(
      scope.current,
      message.tone === "error" ? { x: [0, -7, 7, -4, 4, 0] } : { scale: [1, 1.05, 1] },
      { duration: 0.35, ease: "easeOut" },
    );
  }, [message.id, message.tone, animate, scope, reduce]);

  return (
    <motion.div
      // 所有 toast 疊在同一格（grid 1/1），切換時不會影響彼此位置
      className="col-start-1 row-start-1"
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
    >
      <div
        ref={scope}
        role={message.tone === "error" ? "alert" : "status"}
        className={`wood-dark flex max-w-[360px] items-center gap-2 rounded-2xl border px-4 py-3 text-[15px] text-cream ${
          message.tone === "error" ? "border-[#e8794a]/70" : "border-ember/60"
        }`}
      >
        <span aria-hidden>{message.tone === "error" ? "😵" : "👀"}</span>
        {message.text}
      </div>
    </motion.div>
  );
}
