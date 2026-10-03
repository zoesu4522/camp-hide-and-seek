"use client";

import { AnimatePresence, motion } from "framer-motion";

export interface ToastMessage {
  id: number;
  text: string;
  tone: "info" | "error";
}

/** 頂部小提示（例如：已被別人找到、點亮失敗） */
export default function MessageToast({ message }: { message: ToastMessage | null }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+14px)] z-50 flex justify-center px-4">
      <AnimatePresence>
        {message && (
          <motion.div
            key={message.id}
            role={message.tone === "error" ? "alert" : "status"}
            className={`wood-dark flex max-w-[360px] items-center gap-2 rounded-2xl border px-4 py-3 text-[15px] text-cream ${
              message.tone === "error" ? "border-[#e8794a]/70" : "border-ember/60"
            }`}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <span aria-hidden>{message.tone === "error" ? "😵" : "👀"}</span>
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
