"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

export interface PhotoViewerItem {
  key: string;
  url: string;
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
}

/** 照片放大檢視（玩家端與後台共用） */
export default function PhotoViewer({ item, onClose }: { item: PhotoViewerItem | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const open = item !== null;

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => closeRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        e.preventDefault();
        closeRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          key={item.key}
          className="fixed inset-0 z-[45] flex flex-col items-center justify-center bg-[#020a14]/90 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-label={item.title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.figure
            className="relative w-full max-w-[460px]"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- 使用者上傳照片（Storage URL / data URL） */}
            <img
              src={item.url}
              alt={item.title}
              className="mx-auto block max-h-[70dvh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
            />
            <figcaption className="mt-3 flex items-start justify-between gap-3 text-cream">
              <div>
                <p className="text-[19px]">{item.title}</p>
                {item.subtitle && <p className="mt-0.5 text-[13.5px] text-cream/70">{item.subtitle}</p>}
              </div>
              {item.badge}
            </figcaption>
          </motion.figure>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="mt-5 min-h-11 rounded-full bg-white/12 px-6 text-[15px] text-cream outline-none focus-visible:ring-2 focus-visible:ring-ember"
          >
            關閉
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
