"use client";

import { AnimatePresence, motion, useAnimate, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useGameTimer } from "@/hooks/useGameTimer";
import { formatClock } from "@/lib/timer";
import type { AdminService, GameTimer, TimerAction } from "@/types/game";

interface Props {
  service: AdminService;
  timer: GameTimer | undefined;
  onChanged: () => void;
}

const PRESETS = [5, 10, 15, 20, 30, 45, 60];

const PHASE_LABEL = {
  idle: { text: "尚未開始", cls: "bg-white/10 text-cream/70" },
  lead: { text: "3-2-1 準備中", cls: "bg-ember/20 text-ember" },
  running: { text: "● 倒數中", cls: "bg-forest/25 text-[#9fe0aa]" },
  paused: { text: "⏸ 暫停中", cls: "bg-white/10 text-cream" },
  timeup: { text: "⌛ 時間到", cls: "bg-[#e8794a]/20 text-[#ffab88]" },
  stopped: { text: "已手動結束", cls: "bg-[#e8794a]/20 text-[#ffab88]" },
  completed: { text: "🎉 提前完成", cls: "bg-sky/20 text-[#9bd8f7]" },
} as const;

const SPRING = { type: "spring", stiffness: 500, damping: 26 } as const;

/* ---------------- 有動態回饋的按鈕 ---------------- */

interface ActionButtonProps {
  children: ReactNode;
  className: string;
  /** 回傳是否成功；成功時飄出 floatText，失敗時晃一下 */
  onPress: () => Promise<boolean | null>;
  floatText?: string;
  /** 邏輯上不能按（例如剩不到 1 分鐘不能 −1） */
  disabled?: boolean;
  /** 其他按鈕正在送出：不能按，但外觀不變（不閃） */
  locked?: boolean;
  label?: string;
}

function ActionButton({ children, className, onPress, floatText, disabled, locked, label }: ActionButtonProps) {
  const [pending, setPending] = useState(false);
  const [floats, setFloats] = useState<{ id: number; text: string }[]>([]);
  const [scope, animate] = useAnimate<HTMLButtonElement>();
  const reduce = useReducedMotion();

  const press = async () => {
    if (pending || locked || disabled) return;
    setPending(true);
    const ok = await onPress();
    setPending(false);
    if (ok === null) return; // 只是進入「再按一次確認」
    if (ok && floatText) {
      const id = Date.now();
      setFloats((f) => [...f, { id, text: floatText }]);
      window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1100);
    } else if (!ok && !reduce && scope.current) {
      animate(scope.current, { x: [0, -8, 8, -5, 5, 0] }, { duration: 0.4 });
    }
  };

  return (
    <span className="relative inline-flex">
      <motion.button
        ref={scope}
        type="button"
        aria-label={label}
        aria-disabled={disabled || locked || pending}
        aria-busy={pending}
        onClick={press}
        className={`relative inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-[15px] shadow-[0_2px_0_rgba(0,0,0,0.25)] transition-[opacity,box-shadow] duration-300 ${
          disabled ? "cursor-not-allowed opacity-35" : "cursor-pointer"
        } ${className}`}
        whileHover={disabled || locked ? undefined : { y: -3, boxShadow: "0 8px 18px rgba(0,0,0,0.35)" }}
        whileTap={disabled || locked ? undefined : { scale: 0.92, y: 0 }}
        transition={SPRING}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {pending && (
            <motion.span
              key="spin"
              className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent"
              initial={{ opacity: 0, scale: 0.4, width: 0 }}
              animate={{ opacity: 1, scale: 1, width: 16, rotate: 360 }}
              exit={{ opacity: 0, scale: 0.4, width: 0 }}
              transition={{ rotate: { duration: 0.7, repeat: Infinity, ease: "linear" }, default: { duration: 0.15 } }}
              aria-hidden
            />
          )}
        </AnimatePresence>
        {children}
      </motion.button>

      {/* 成功時飄出的回饋 */}
      <AnimatePresence>
        {floats.map((f) => (
          <motion.span
            key={f.id}
            className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-forest px-2.5 py-0.5 text-[13px] text-white shadow-lg"
            initial={{ y: 0, opacity: 0, scale: 0.6 }}
            animate={{ y: -34, opacity: 1, scale: 1 }}
            exit={{ y: -52, opacity: 0, transition: { duration: 0.25 } }}
            transition={{ type: "spring", stiffness: 380, damping: 18 }}
            aria-hidden
          >
            {f.text}
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}

/* ---------------- 面板 ---------------- */

/** 後台：倒數計時控制（所有玩家即時同步） */
export default function AdminTimerPanel({ service, timer, onChanged }: Props) {
  const [offset, setOffset] = useState(0);
  const [minutes, setMinutes] = useState(15);
  const [custom, setCustom] = useState("");
  const [confirm, setConfirm] = useState<TimerAction | null>(null);
  const [inflight, setInflight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const view = useGameTimer(timer, offset);
  const reduce = useReducedMotion();

  // 時鐘：版本變化（加時 / 暫停 / 開始…）時彈一下
  const [clockScope, animateClock] = useAnimate<HTMLParagraphElement>();
  const lastVersion = useRef(timer?.version);
  useEffect(() => {
    if (timer?.version === undefined) return;
    if (lastVersion.current !== undefined && lastVersion.current !== timer.version && !reduce && clockScope.current) {
      animateClock(clockScope.current, { scale: [1, 1.1, 1] }, { duration: 0.35, ease: "easeOut" });
    }
    lastVersion.current = timer.version;
  }, [timer?.version, animateClock, clockScope, reduce]);

  useEffect(() => {
    let cancelled = false;
    service
      .getClockOffset()
      .then((o) => !cancelled && setOffset(o))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [service]);

  // 確認提示 5 秒後自動取消
  useEffect(() => {
    if (!confirm) return;
    const t = window.setTimeout(() => setConfirm(null), 5000);
    return () => window.clearTimeout(t);
  }, [confirm]);

  const customMin = Number(custom);
  const chosen = custom ? customMin : minutes;
  const validChosen = Number.isFinite(chosen) && chosen >= 1 && chosen <= 180;

  /** 回傳 null = 進入確認狀態；true/false = 成功與否 */
  const run = async (action: TimerAction, seconds?: number, needConfirm = false): Promise<boolean | null> => {
    if (needConfirm && confirm !== action) {
      setConfirm(action);
      return null;
    }
    setConfirm(null);
    setInflight(true);
    setError(null);
    const res = await service.controlTimer(action, seconds).catch(() => ({ ok: false }));
    if (!res.ok) setError("操作沒有成功（可能狀態已被其他管理員改變），已重新整理。");
    setInflight(false);
    onChanged();
    return res.ok;
  };

  const phase = view.phase;
  const active = phase === "lead" || phase === "running" || phase === "paused";
  const badge = PHASE_LABEL[phase];

  return (
    <section className="mt-5 rounded-2xl border border-ember/30 bg-[#132a40] p-4" aria-labelledby="timer-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="timer-title" className="text-[17px]">
          ⏱ 倒數計時
        </h2>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={phase}
            className={`rounded-full px-3 py-0.5 text-[13px] ${badge.cls}`}
            initial={{ opacity: 0, y: -8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            transition={SPRING}
          >
            {badge.text}
          </motion.span>
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {phase !== "idle" && (
          <motion.div
            key="clock"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p
              ref={clockScope}
              className={`mt-2 text-center text-[52px] leading-none tabular-nums transition-colors duration-300 ${
                phase === "running" && view.remainingMs <= 60_000 ? "text-[#ff8f6e]" : phase === "paused" ? "text-cream/60" : "text-cream"
              }`}
              aria-live="off"
            >
              {phase === "timeup" ? "0:00" : formatClock(view.remainingMs)}
            </p>
            {phase === "lead" && (
              <p className="mt-1 text-center text-[13px] text-ember">玩家畫面正在播 3-2-1（{Math.ceil(view.leadMs / 1000)}）</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        {!active ? (
          <motion.div
            key="setup"
            className="mt-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <p className="text-[13px] text-cream/60">選擇時間（分鐘）</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {PRESETS.map((m) => {
                const selected = !custom && minutes === m;
                return (
                  <motion.button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMinutes(m);
                      setCustom("");
                    }}
                    aria-pressed={selected}
                    className={`relative min-h-10 min-w-12 rounded-full px-3 text-[15px] ${
                      selected ? "text-ink" : "border border-white/15 text-cream/85"
                    }`}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.9 }}
                    transition={SPRING}
                  >
                    {selected && (
                      <motion.span layoutId="preset-pill" className="absolute inset-0 rounded-full bg-ember" transition={SPRING} />
                    )}
                    <span className="relative">{m}</span>
                  </motion.button>
                );
              })}
              <label className="flex items-center gap-1.5 rounded-full border border-white/15 pl-3 pr-1 text-[14px] text-cream/70 focus-within:border-ember">
                自訂
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={180}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder="—"
                  aria-label="自訂分鐘數"
                  className="h-9 w-16 rounded-full bg-[#07182b] px-2 text-center text-cream outline-none focus:ring-2 focus:ring-ember"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton
                className="bg-forest text-white"
                disabled={!validChosen}
                locked={inflight}
                floatText="▶ 開始！"
                onPress={() => run("start", Math.round(chosen * 60), true)}
              >
                {confirm === "start" ? `確定開始 ${chosen} 分鐘？再按一次` : `▶ 開始倒數 ${validChosen ? `${chosen} 分鐘` : ""}`}
              </ActionButton>
              {phase !== "idle" && (
                <ActionButton
                  className="border border-white/15 text-cream/80"
                  locked={inflight}
                  floatText="已重置"
                  onPress={() => run("reset", undefined, true)}
                >
                  {confirm === "reset" ? "確定重置？" : "重置"}
                </ActionButton>
              )}
            </div>
            <p className="mt-2 text-[12.5px] text-cream/50">按下開始後，所有玩家會同時看到 3-2-1 和開始音效。</p>
          </motion.div>
        ) : (
          <motion.div
            key="controls"
            className="mt-3 flex flex-wrap justify-center gap-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {phase === "paused" ? (
              <ActionButton className="bg-forest text-white" locked={inflight} floatText="▶ 繼續" onPress={() => run("resume")}>
                ▶ 繼續
              </ActionButton>
            ) : (
              <ActionButton
                className="bg-white/10 text-cream"
                disabled={phase === "lead"}
                locked={inflight}
                floatText="已暫停"
                onPress={() => run("pause")}
              >
                ⏸ 暫停
              </ActionButton>
            )}
            <ActionButton
              className="border border-forest/60 text-[#9fe0aa]"
              locked={inflight}
              floatText="+1 分"
              onPress={() => run("add", 60)}
            >
              +1 分
            </ActionButton>
            <ActionButton
              className="border border-forest/60 text-[#9fe0aa]"
              locked={inflight}
              floatText="+5 分"
              onPress={() => run("add", 300)}
            >
              +5 分
            </ActionButton>
            <ActionButton
              className="border border-white/15 text-cream/80"
              disabled={view.remainingMs <= 61_000}
              locked={inflight}
              floatText="−1 分"
              onPress={() => run("add", -60)}
            >
              −1 分
            </ActionButton>
            <ActionButton
              className="bg-[#d9633a] text-white"
              locked={inflight}
              floatText="已結束"
              onPress={() => run("end", undefined, true)}
            >
              {confirm === "end" ? "確定結束？再按一次" : "⏹ 結束"}
            </ActionButton>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.p
            className="mt-3 rounded-xl bg-[#2a1610] px-3 py-2 text-[14px] text-[#ffcbb5]"
            role="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}
