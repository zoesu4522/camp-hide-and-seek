"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const CURRENT = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
const CHECK_EVERY_MS = 60_000;

async function latestBuild(): Promise<string | null> {
  try {
    const res = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { build?: string }).build ?? null;
  } catch {
    return null;
  }
}

/**
 * 偵測新版本：開著的頁面不會自己換成新程式，修正部署後舊分頁會一直跑舊版。
 * - 切回這個頁面時發現新版 → 直接重新整理（自然的時機，不會打斷操作）
 * - 正在看頁面時發現新版 → 顯示「有新版本」按鈕，不強制重新整理（避免打斷上傳）
 */
export default function UpdateChecker() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (CURRENT === "dev" || CURRENT.startsWith("local-")) return;
    let cancelled = false;

    const check = async (reloadIfStale: boolean) => {
      const build = await latestBuild();
      if (cancelled || !build || build === CURRENT) return;
      if (reloadIfStale) window.location.reload();
      else setStale(true);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") check(true);
    };
    const first = window.setTimeout(() => check(false), 5000);
    const id = window.setInterval(() => document.visibilityState === "visible" && check(false), CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, []);

  return (
    <AnimatePresence>
      {stale && (
        <motion.button
          type="button"
          onClick={() => window.location.reload()}
          className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+8px)] z-[80] -translate-x-1/2 whitespace-nowrap rounded-full bg-sky px-4 py-2 text-[14px] text-ink shadow-lg"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
        >
          🔄 有新版本，點我更新
        </motion.button>
      )}
    </AnimatePresence>
  );
}
