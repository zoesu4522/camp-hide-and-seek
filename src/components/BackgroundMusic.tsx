"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore } from "react";
import { isMuted, setMuted, subscribeMuted, unlockSound } from "@/lib/sound";

const SRC = "/audio/campsite-curiosity.mp3";
const VOLUME = 0.45;
/** 倒數 3-2-1 / 最後 10 秒時壓低音樂，讓音效更清楚 */
const DUCK_VOLUME = 0.12;

export interface BackgroundMusicHandle {
  /** 在使用者手勢（點擊）中呼叫，確保手機也能開始播放 */
  start: () => void;
}

/**
 * 背景音樂。
 * - 打開網頁就嘗試自動播放；瀏覽器（尤其 iPhone / Android）擋下有聲自動播放時，
 *   會在使用者第一次點擊畫面（例如輸入名字按「開始」）時開始播放。
 * - 右下角按鈕可靜音（音樂 + 倒數音效一起），偏好記在 localStorage。
 * - 切到背景分頁時暫停，回來再繼續。
 */
const BackgroundMusic = forwardRef<BackgroundMusicHandle, { duck?: boolean }>(function BackgroundMusic({ duck = false }, ref) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const muted = useSyncExternalStore(subscribeMuted, isMuted, () => false);
  const mutedRef = useRef(muted);
  const duckRef = useRef(duck);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // 音量淡入淡出（ducking）
  useEffect(() => {
    duckRef.current = duck;
    const a = audioRef.current;
    if (!a) return;
    const target = duck ? DUCK_VOLUME : VOLUME;
    const id = window.setInterval(() => {
      const diff = target - a.volume;
      if (Math.abs(diff) < 0.02) {
        a.volume = target;
        window.clearInterval(id);
      } else a.volume = Math.min(1, Math.max(0, a.volume + diff * 0.35));
    }, 40);
    return () => window.clearInterval(id);
  }, [duck]);

  const tryPlay = useCallback(() => {
    const a = audioRef.current;
    if (!a || mutedRef.current) return;
    a.volume = duckRef.current ? DUCK_VOLUME : VOLUME;
    a.play().catch(() => {
      /* 被自動播放政策擋下：等使用者手勢 */
    });
  }, []);

  useImperativeHandle(ref, () => ({ start: tryPlay }), [tryPlay]);

  useEffect(() => {
    mutedRef.current = isMuted();
    tryPlay();

    // 第一次互動時再試一次（手機自動播放限制），順便解鎖音效
    const onGesture = () => {
      unlockSound();
      tryPlay();
      if (audioRef.current && !audioRef.current.paused) remove();
    };
    const events = ["pointerdown", "touchend", "keydown"] as const;
    const remove = () => events.forEach((ev) => window.removeEventListener(ev, onGesture));
    events.forEach((ev) => window.addEventListener(ev, onGesture, { passive: true }));

    const onVisibility = () => {
      const a = audioRef.current;
      if (!a) return;
      if (document.visibilityState === "hidden") a.pause();
      else tryPlay();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      remove();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tryPlay]);

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    if (!next) unlockSound();
    const a = audioRef.current;
    if (!a) return;
    if (next) a.pause();
    else tryPlay();
  };

  const on = playing && !muted;

  return (
    <>
      <audio
        ref={audioRef}
        src={SRC}
        loop
        preload="auto"
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button
        type="button"
        onClick={toggle}
        aria-pressed={!muted}
        aria-label={muted ? "開啟聲音" : "關閉聲音"}
        className="wood-dark fixed bottom-[calc(env(safe-area-inset-bottom)+14px)] right-3 z-[55] grid h-12 w-12 place-items-center rounded-full border border-ember/40 text-[20px] outline-none focus-visible:ring-4 focus-visible:ring-ember/60"
      >
        <span aria-hidden className={on ? "motion-loop inline-block animate-[twinkle_1.6s_ease-in-out_infinite]" : "opacity-70"}>
          {muted ? "🔇" : on ? "🎵" : "🔈"}
        </span>
      </button>
    </>
  );
});

export default BackgroundMusic;
