"use client";

import { MotionConfig } from "framer-motion";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useCampGame } from "@/hooks/useCampGame";
import type { Figure, FoundEvent } from "@/types/game";
import HeroSection from "./HeroSection";
import ProgressBoard from "./ProgressBoard";
import FigureGrid from "./FigureGrid";
import HowToPlay from "./HowToPlay";
import SafetyNotice from "./SafetyNotice";
import ConfirmFoundModal, { type SubmitOutcome } from "./ConfirmFoundModal";
import PhotoViewer, { type PhotoViewerItem } from "./PhotoViewer";
import { getPlayerId } from "@/lib/playerId";
import { IS_MOCK } from "@/lib/services";
import { readPlayerName, savePlayerName, subscribePlayerName } from "@/lib/playerName";
import PlayerNameGate from "./PlayerNameGate";
import BackgroundMusic, { type BackgroundMusicHandle } from "./BackgroundMusic";
import FoundToast from "./FoundToast";
import MessageToast, { type ToastMessage } from "./MessageToast";
import CompletionOverlay from "./CompletionOverlay";
import OpeningAnimation from "./OpeningAnimation";
import LoadingCamp from "./LoadingCamp";
import ConnectionError from "./ConnectionError";
import MockDemoPanel from "./dev/MockDemoPanel";
import TimerBar from "./timer/TimerBar";
import TimerOverlays from "./timer/TimerOverlays";
import { useGameTimer } from "@/hooks/useGameTimer";
import { useTimerEvents } from "@/hooks/useTimerEvents";
import { isLocked } from "@/lib/timer";
import { unlockSound } from "@/lib/sound";

const INTRO_KEY = "camp-hide-and-seek:intro-seen";

/** 時間軸（ms） */
const TOAST_DELAY = 500; // 先讓卡片翻牌被看到
const TOAST_DURATION = 1400;
const CELEBRATE_DURATION = 1800;
const COMPLETION_DELAY = TOAST_DELAY + TOAST_DURATION + 150;

const noopSubscribe = () => () => {};

function readIntroSeen(): "seen" | "unseen" {
  try {
    return window.sessionStorage.getItem(INTRO_KEY) ? "seen" : "unseen";
  } catch {
    return "unseen";
  }
}

function readDemoFlag(): boolean {
  return new URLSearchParams(window.location.search).has("demo");
}

export default function CampGameApp() {
  const game = useCampGame();

  // ---- Opening（sessionStorage：同一個分頁 session 只播一次）----
  const introSnapshot = useSyncExternalStore(noopSubscribe, readIntroSeen, () => "pending" as const);
  const [introFinished, setIntroFinished] = useState(false);
  const introPlaying = introSnapshot === "unseen" && !introFinished;
  const introPending = introSnapshot === "pending";

  const finishIntro = useCallback(() => {
    try {
      window.sessionStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* ignore */
    }
    setIntroFinished(true);
  }, []);

  const showDemo = useSyncExternalStore(noopSubscribe, readDemoFlag, () => false);

  // ---- 玩家名稱 ----
  const playerName = useSyncExternalStore(subscribePlayerName, readPlayerName, () => null);
  const [editingName, setEditingName] = useState(false);
  const musicRef = useRef<BackgroundMusicHandle>(null);
  const needName = !introPending && !introPlaying && !playerName;

  const submitName = useCallback((name: string) => {
    musicRef.current?.start(); // 使用者手勢：手機也能開始播放音樂
    unlockSound(); // 同時解鎖倒數音效
    savePlayerName(name);
    setEditingName(false);
  }, []);

  // ---- UI state ----
  const [selectedFigure, setSelectedFigure] = useState<Figure | null>(null);
  const [viewing, setViewing] = useState<PhotoViewerItem | null>(null);
  const [toastEvent, setToastEvent] = useState<FoundEvent | null>(null);
  const [celebrateNumber, setCelebrateNumber] = useState<number | null>(null);
  const [showCompletion, setShowCompletion] = useState(false);
  const [message, setMessage] = useState<ToastMessage | null>(null);

  const notify = useCallback((text: string, tone: ToastMessage["tone"] = "info") => {
    setMessage({ id: Date.now(), text, tone });
  }, []);

  // ---- 倒數計時（管理員設定，所有人同步）----
  const timerView = useGameTimer(game.game?.timer, game.clockOffset);
  const timerFx = useTimerEvents({ timer: game.game?.timer, view: timerView, ready: game.status === "ready", notify });
  const locked = isLocked(timerView.phase);

  // 訊息自動消失
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 2600);
    return () => window.clearTimeout(t);
  }, [message]);

  // 找到事件（已在 hook 內去重）→ 翻牌 sparkles → 通知 → 若 8/8 播完成動畫
  const { foundEvent, total } = game;
  useEffect(() => {
    if (!foundEvent) return;
    const timers = [
      window.setTimeout(() => setCelebrateNumber(foundEvent.number), 0),
      window.setTimeout(() => setCelebrateNumber(null), CELEBRATE_DURATION),
      window.setTimeout(() => setToastEvent(foundEvent), TOAST_DELAY),
      window.setTimeout(() => setToastEvent(null), TOAST_DELAY + TOAST_DURATION),
    ];
    if (foundEvent.foundCount >= total) {
      timers.push(window.setTimeout(() => setShowCompletion(true), COMPLETION_DELAY));
    }
    return () => timers.forEach(clearTimeout);
  }, [foundEvent, total]);

  // 管理員退回照片 → 小人重新躲起來
  const { rejectEvent } = game;
  useEffect(() => {
    if (!rejectEvent) return;
    const t = window.setTimeout(() => {
      notify(`#${rejectEvent.number} 的照片被退回，小人又躲起來了！`, "error");
      setShowCompletion(false);
    }, 0);
    return () => window.clearTimeout(t);
  }, [rejectEvent, notify]);

  const handleSubmit = async (photo: Blob, onProgress: (r: number) => void): Promise<SubmitOutcome> => {
    if (!selectedFigure) return "error";
    const result = await game.submitFind({
      figureNumber: selectedFigure.number,
      photo,
      playerId: getPlayerId(),
      playerName: playerName ?? "",
      onProgress,
    });
    if (result.status === "success") {
      setSelectedFigure(null);
    } else if (result.status === "already_found") {
      setSelectedFigure(null);
      notify("這個小人剛剛已經被找到囉！");
    } else {
      if (result.error === "time_up") setSelectedFigure(null);
      notify(
        result.error === "time_up"
          ? "⌛ 時間到了，這次來不及回報囉！"
          : result.error === "upload_failed"
            ? "照片沒有上傳成功，再試一次！"
            : "沒有成功點亮，再試一次！",
        "error",
      );
    }
    return result.status;
  };

  const closeViewer = useCallback(() => setViewing(null), []);

  const openPhoto = useCallback((f: Figure) => {
    if (!f.photoUrl) return;
    const time = f.foundAt
      ? new Date(f.foundAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false })
      : null;
    setViewing({
      key: `${f.number}-${f.submissionId}`,
      url: f.photoUrl,
      title: `#${f.number} 躲貓貓小人`,
      subtitle: [f.foundByName, time ? `${time} 找到` : null].filter(Boolean).join("・") || undefined,
      badge: f.isVerified ? (
        <span className="shrink-0 rounded-full bg-forest px-3 py-1 text-[13px] text-white">✓ 管理員已確認</span>
      ) : (
        <span className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-[13px] text-cream/85">待確認</span>
      ),
    });
  }, []);

  const closeCompletion = useCallback(() => {
    setShowCompletion(false);
    window.setTimeout(() => {
      document.getElementById("figures")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 350);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative z-20 mx-auto w-full max-w-[430px] overflow-x-clip pb-[calc(env(safe-area-inset-bottom)+40px)]">
        <HeroSection playerName={playerName} onEditName={() => setEditingName(true)} />

        {game.status === "loading" && !introPlaying && !introPending && <LoadingCamp />}

        {game.status === "error" && <ConnectionError onRetry={game.retry} />}

        {game.status === "ready" && (
          <>
            <TimerBar view={timerView} bonus={timerFx.bonus} found={game.foundCount} total={game.total} />
            <ProgressBoard
              found={game.foundCount}
              total={game.total}
              onReplayCelebration={() => setShowCompletion(true)}
            />
            <FigureGrid
              figures={game.figures}
              celebrateNumber={celebrateNumber}
              onSelect={(f) => {
                if (locked) return notify("⌛ 時間到了，不能再回報囉！", "error");
                if (!playerName) return setEditingName(true);
                setSelectedFigure(f);
              }}
              onView={openPhoto}
            />
            <HowToPlay />
            <SafetyNotice />
            {IS_MOCK && showDemo && <MockDemoPanel />}
          </>
        )}

        <footer className="mt-8 text-center text-[12px] text-cream/40">Camp Hide &amp; Seek · 露營躲貓貓</footer>
      </main>

      <ConfirmFoundModal figure={selectedFigure} onCancel={() => setSelectedFigure(null)} onSubmit={handleSubmit} />
      <PhotoViewer item={viewing} onClose={closeViewer} />
      <FoundToast event={toastEvent} total={game.total} />
      <MessageToast message={message} />
      <CompletionOverlay open={showCompletion} total={game.total} onClose={closeCompletion} />
      <TimerOverlays
        view={timerView}
        timer={game.game?.timer}
        endOpen={timerFx.endOpen}
        onCloseEnd={timerFx.closeEnd}
        found={game.foundCount}
        total={game.total}
      />

      <PlayerNameGate
        open={needName || editingName}
        initialName={playerName}
        editing={!!playerName}
        onSubmit={submitName}
        onCancel={() => setEditingName(false)}
      />
      <BackgroundMusic ref={musicRef} duck={timerFx.duck} />

      {/* SSR / hydration 期間先蓋深色，避免 opening 前閃一下內容 */}
      {introPending && <div className="fixed inset-0 z-[70] bg-night" aria-hidden />}
      {introPlaying && <OpeningAnimation onDone={finishIntro} />}
    </MotionConfig>
  );
}
