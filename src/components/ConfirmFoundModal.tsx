"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Figure } from "@/types/game";
import { compressImage } from "@/lib/image/compressImage";
import CampFigure, { SLOT_POSES } from "./illustrations/CampFigure";

export type SubmitOutcome = "success" | "already_found" | "error";

interface Props {
  figure: Figure | null;
  onCancel: () => void;
  /** 上傳照片並點亮；回傳結果，成功或已被找到時父層會關閉 modal */
  onSubmit: (photo: Blob, onProgress: (ratio: number) => void) => Promise<SubmitOutcome>;
  onBusyChange?: (busy: boolean) => void;
}

const FOCUSABLE = 'button:not([disabled]), [href], select, textarea, [tabindex]:not([tabindex="-1"])';

export default function ConfirmFoundModal({ figure, onCancel, onSubmit }: Props) {
  const open = figure !== null;
  const sheetRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const busyRef = useRef(false);
  const setBusy = useCallback((b: boolean) => {
    busyRef.current = b;
  }, []);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => {
      sheetRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }, 30);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && !busyRef.current) {
      e.stopPropagation();
      onCancel();
      return;
    }
    if (e.key !== "Tab" || !sheetRef.current) return;
    const nodes = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <AnimatePresence>
      {open && figure && (
        <motion.div
          key="confirm"
          className="fixed inset-0 z-40 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onKeyDown={onKeyDown}
        >
          <button
            type="button"
            aria-label="關閉"
            tabIndex={-1}
            className="absolute inset-0 bg-[#020a14]/70"
            onClick={() => !busyRef.current && onCancel()}
          />
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-desc"
            className="paper relative max-h-[94dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] px-5 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-3"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            <SheetContent
              key={figure.number}
              figure={figure}
              onCancel={onCancel}
              onSubmit={onSubmit}
              onBusyChange={setBusy}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SheetContent({ figure, onCancel, onSubmit, onBusyChange }: Required<Props> & { figure: Figure }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const pose = SLOT_POSES[(figure.number - 1) % SLOT_POSES.length];

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const busy = processing || submitting;
  useEffect(() => {
    onBusyChange(submitting);
  }, [submitting, onBusyChange]);

  const pickPhoto = () => inputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError(null);
    setProcessing(true);
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
      setPreviewUrl(URL.createObjectURL(compressed));
    } catch {
      setPhotoError("這張照片讀不到，換一張試試看。");
    } finally {
      setProcessing(false);
    }
  };

  const submit = async () => {
    if (!photo || submitting) return;
    setSubmitting(true);
    setProgress(0.05);
    const outcome = await onSubmit(photo, setProgress);
    if (outcome === "error") {
      setSubmitting(false);
      setProgress(0);
    }
    // success / already_found：父層關閉 modal，元件卸載
  };

  return (
    <>
      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-wood/30" aria-hidden />

      <div className="flex items-center gap-3">
        <div className="relative grid h-16 w-14 shrink-0 place-items-center rounded-xl bg-[#efe1ca]">
          <CampFigure pose={pose} variant="hidden" className="w-[80%] opacity-60" />
          <span className="absolute -bottom-2 rounded-md bg-wood px-1.5 text-[12px] leading-5 text-cream">#{figure.number}</span>
        </div>
        <div className="min-w-0">
          <h2 id="confirm-title" className="text-[21px] leading-snug text-ink">
            你找到 <span className="text-wood">{figure.number} 號</span>小人了嗎？
          </h2>
          <p id="confirm-desc" className="mt-0.5 text-[13.5px] leading-snug text-ink/70">
            拍一張小人的照片，大家都看得到。上傳後會同步點亮給所有玩家。
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onFileChange}
      />

      {/* 照片區 */}
      <div className="mt-4">
        {previewUrl ? (
          <div className="relative overflow-hidden rounded-2xl border-2 border-wood/25 bg-black/5">
            {/* eslint-disable-next-line @next/next/no-img-element -- 本地 blob 預覽 */}
            <img src={previewUrl} alt={`${figure.number} 號小人照片預覽`} className="block max-h-[34dvh] w-full object-contain" />
            {!submitting && (
              <button
                type="button"
                onClick={pickPhoto}
                className="absolute bottom-2 right-2 min-h-10 rounded-full bg-[#1d1309]/75 px-3.5 text-[14px] text-cream outline-none focus-visible:ring-2 focus-visible:ring-ember"
              >
                📷 重拍
              </button>
            )}
            {submitting && (
              <div className="absolute inset-x-0 bottom-0 bg-[#1d1309]/75 px-3 py-2" role="status" aria-live="polite">
                <div className="flex justify-between text-[13px] text-cream">
                  <span>{progress >= 1 ? "上傳完成，點亮中…" : "照片上傳中…"}</span>
                  <span>{Math.round(progress * 100)}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/20">
                  <motion.div
                    className="h-full origin-left rounded-full bg-ember"
                    initial={false}
                    animate={{ scaleX: progress }}
                    transition={{ duration: 0.25 }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            data-autofocus
            onClick={pickPhoto}
            disabled={processing}
            className="flex min-h-[148px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-wood/45 bg-[#f6e8d2] text-wood outline-none focus-visible:ring-4 focus-visible:ring-sky/60 disabled:opacity-70"
          >
            {processing ? (
              <>
                <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-wood/30 border-t-wood motion-reduce:animate-none" />
                <span className="text-[15px]">處理照片中…</span>
              </>
            ) : (
              <>
                <span className="text-[34px] leading-none" aria-hidden>
                  📷
                </span>
                <span className="text-[17px]">拍照 / 選擇照片</span>
                <span className="text-[12.5px] text-wood/70">必填・請拍到小人本體</span>
              </>
            )}
          </button>
        )}
        {photoError && (
          <p className="mt-2 text-[14px] text-[#b4441c]" role="alert">
            {photoError}
          </p>
        )}
      </div>

      <div className="mt-5 grid grid-cols-[1fr_1.5fr] gap-3">
        <button
          type="button"
          data-autofocus={previewUrl ? "" : undefined}
          onClick={onCancel}
          disabled={submitting}
          className="min-h-[52px] rounded-2xl border-2 border-wood/40 bg-transparent text-[17px] text-wood outline-none focus-visible:ring-4 focus-visible:ring-sky/60 disabled:opacity-50"
        >
          還沒有
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!photo || busy}
          className="relative min-h-[52px] rounded-2xl text-[17px] text-ink outline-none transition-opacity focus-visible:ring-4 focus-visible:ring-sky/60 disabled:opacity-45"
          style={{
            background: "linear-gradient(180deg, #ffd66b 0%, #fdba2d 60%, #e9a01b 100%)",
            boxShadow: "inset 0 -4px 0 rgba(139,87,42,0.45), 0 6px 14px rgba(253,186,45,0.35)",
          }}
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink motion-reduce:animate-none" />
              上傳中…
            </span>
          ) : (
            "上傳並點亮！"
          )}
        </button>
      </div>
      {!photo && <p className="mt-2 text-center text-[12.5px] text-ink/55">先拍照才能點亮喔</p>}
    </>
  );
}
