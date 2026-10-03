"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

const MUTE_KEY = "camp-hide-and-seek:music-muted";
const SRC = "/audio/campsite-curiosity.mp3";
const VOLUME = 0.45;

export interface BackgroundMusicHandle {
  /** 在使用者手勢（點擊）中呼叫，確保手機也能開始播放 */
  start: () => void;
}

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * 背景音樂。
 * - 打開網頁就嘗試自動播放；瀏覽器（尤其 iPhone / Android）擋下有聲自動播放時，
 *   會在使用者第一次點擊畫面（例如輸入名字按「開始」）時開始播放。
 * - 右下角按鈕可靜音，偏好記在 localStorage。
 * - 切到背景分頁時暫停，回來再繼續。
 */
const BackgroundMusic = forwardRef<BackgroundMusicHandle>(function BackgroundMusic(_props, ref) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const mutedRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);

  const tryPlay = useCallback(() => {
    const a = audioRef.current;
    if (!a || mutedRef.current) return;
    a.volume = VOLUME;
    a.play().catch(() => {
      /* 被自動播放政策擋下：等使用者手勢 */
    });
  }, []);

  useImperativeHandle(ref, () => ({ start: tryPlay }), [tryPlay]);

  useEffect(() => {
    const m = readMuted();
    mutedRef.current = m;
    const t = window.setTimeout(() => setMuted(m), 0);
    tryPlay();

    // 第一次互動時再試一次（手機自動播放限制）
    const onGesture = () => {
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
      window.clearTimeout(t);
      remove();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tryPlay]);

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    try {
      window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
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
        aria-label={muted ? "開啟背景音樂" : "關閉背景音樂"}
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
