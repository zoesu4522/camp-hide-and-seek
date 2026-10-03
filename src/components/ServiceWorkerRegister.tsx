"use client";

import { useEffect } from "react";

/** 只在 production 註冊 service worker（快取靜態素材，不做 offline sync） */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* 註冊失敗不影響遊戲 */
    });
  }, []);
  return null;
}
