"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { NAME_MAX, normalizeName } from "@/lib/playerName";
import CampFigure from "./illustrations/CampFigure";

interface Props {
  open: boolean;
  initialName?: string | null;
  /** 是否為修改名稱（可以取消） */
  editing?: boolean;
  onSubmit: (name: string) => void;
  onCancel?: () => void;
}

/** 進入遊戲前輸入玩家名稱（按下「開始」也作為播放背景音樂的使用者手勢） */
export default function PlayerNameGate({ open, initialName, editing, onSubmit, onCancel }: Props) {
  return (
    <AnimatePresence>
      {open && <GateCard key="gate" initialName={initialName} editing={editing} onSubmit={onSubmit} onCancel={onCancel} />}
    </AnimatePresence>
  );
}

function GateCard({ initialName, editing, onSubmit, onCancel }: Omit<Props, "open">) {
  const [name, setName] = useState(initialName ?? "");
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const clean = normalizeName(name);
  const invalid = clean.length === 0;

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 250);
    return () => window.clearTimeout(t);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    onSubmit(clean);
  };

  return (
    <motion.div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-[#020a14]/80 px-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-title"
    >
      <motion.form
        onSubmit={submit}
        className="paper relative w-full max-w-[360px] rounded-[28px] px-6 pb-6 pt-14 text-center"
        initial={{ y: 40, scale: 0.92, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
        noValidate
      >
        <motion.div
          className="absolute -top-12 left-1/2 w-24 -translate-x-1/2"
          initial={{ y: 20, rotate: -10 }}
          animate={{ y: 0, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 12, delay: 0.15 }}
          aria-hidden
        >
          <CampFigure pose="wave" className="w-full drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)]" />
        </motion.div>

        <h2 id="gate-title" className="text-[24px] leading-snug text-ink">
          {editing ? "修改你的名字" : "歡迎來到營地！"}
        </h2>
        <p className="mt-1 text-[14.5px] text-ink/70">
          {editing ? "大家會看到新的名字" : "先告訴大家你是誰，找到小人時會顯示你的名字"}
        </p>

        <label htmlFor="player-name" className="sr-only">
          你的名字
        </label>
        <input
          ref={inputRef}
          id="player-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
          maxLength={NAME_MAX * 2}
          autoComplete="nickname"
          enterKeyHint="go"
          placeholder="例如：小明"
          aria-invalid={touched && invalid}
          aria-describedby="name-hint"
          className="mt-5 block min-h-[54px] w-full rounded-2xl border-2 border-wood/30 bg-white px-4 text-center text-[20px] text-ink outline-none placeholder:text-ink/30 focus:border-ember focus:ring-4 focus:ring-ember/30"
        />
        <p id="name-hint" className={`mt-2 text-[13px] ${touched && invalid ? "text-[#b4441c]" : "text-ink/50"}`}>
          {touched && invalid ? "請輸入名字才能開始喔" : `最多 ${NAME_MAX} 個字`}
        </p>

        <button
          type="submit"
          className="mt-4 min-h-[54px] w-full rounded-2xl text-[18px] text-ink outline-none focus-visible:ring-4 focus-visible:ring-sky/60"
          style={{
            background: "linear-gradient(180deg, #ffd66b 0%, #fdba2d 60%, #e9a01b 100%)",
            boxShadow: "inset 0 -4px 0 rgba(139,87,42,0.45), 0 6px 14px rgba(253,186,45,0.35)",
          }}
        >
          {editing ? "儲存" : "開始找小人 🔦"}
        </button>
        {editing && onCancel && (
          <button type="button" onClick={onCancel} className="mt-2 min-h-11 w-full text-[15px] text-wood">
            取消
          </button>
        )}
      </motion.form>
    </motion.div>
  );
}
