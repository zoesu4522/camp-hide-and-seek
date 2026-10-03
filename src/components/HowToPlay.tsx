"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import CampFigure from "./illustrations/CampFigure";

function PhoneArt() {
  return (
    <div className="flex items-end justify-center gap-2">
      <div className="relative h-[84px] w-12 rounded-[10px] border-[3px] border-[#2b2b33] bg-[#f6f6f6] p-1 shadow">
        <div className="grid h-full grid-cols-4 grid-rows-6 gap-[1.5px] rounded-sm p-0.5">
          {[1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0].map((v, i) => (
            <span key={i} className={v ? "rounded-[1px] bg-[#2b2b33]" : ""} />
          ))}
        </div>
      </div>
      <CampFigure pose="wave" className="w-14" />
    </div>
  );
}

function CameraArt() {
  return (
    <div className="relative flex items-end justify-center">
      <CampFigure pose="cheer" className="w-16" />
      <span className="absolute -right-6 top-1 text-[30px]" aria-hidden>
        📷
      </span>
    </div>
  );
}

function GroupArt() {
  return (
    <div className="flex items-end justify-center -space-x-4">
      <CampFigure pose="cheer" className="w-14" />
      <CampFigure pose="flex" className="relative z-10 w-16" />
      <CampFigure pose="cheer" className="w-14" />
    </div>
  );
}

const STEPS: { title: string; art: ReactNode; text: ReactNode }[] = [
  {
    title: "一起找",
    art: <CampFigure pose="search" className="mx-auto w-[92px]" />,
    text: (
      <>
        26 位玩家，一起在營區裡尋找藏起來的 <b className="text-wood">8 個小人</b>。
      </>
    ),
  },
  { title: "回到網站", art: <PhoneArt />, text: <>找到小人後，回到這個網站，點那一號的小人。</> },
  { title: "拍照點亮", art: <CameraArt />, text: <>拍下小人的照片上傳，點亮一個「躲貓貓小人」。</> },
  {
    title: "完成任務",
    art: <GroupArt />,
    text: (
      <>
        8 個小人全部找到，就完成任務啦！<span aria-hidden>🎉</span>
      </>
    ),
  },
];

/**
 * 玩法說明：手機左右滑動的卡片輪播（一次一張，原生 scroll-snap，iOS / Android 手感最自然），
 * 也可以點左右箭頭或圓點切換。
 */
export default function HowToPlay() {
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState(0);
  const [hinted, setHinted] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const cards = Array.from(el.children) as HTMLElement[];
    const center = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    cards.forEach((c, i) => {
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - center);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setActive(best);
    if (el.scrollLeft > 8) setHinted(true);
  };

  const goTo = useCallback(
    (i: number) => {
      const el = scrollerRef.current;
      const card = el?.children[i] as HTMLElement | undefined;
      if (!el || !card) return;
      el.scrollTo({
        left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2,
        behavior: reduce ? "auto" : "smooth",
      });
    },
    [reduce],
  );

  // 第一次出現時輕推一下，提示可以滑動
  useEffect(() => {
    if (!open || hinted || reduce) return;
    const el = scrollerRef.current;
    if (!el) return;
    const t1 = window.setTimeout(() => el.scrollTo({ left: 56, behavior: "smooth" }), 900);
    const t2 = window.setTimeout(() => el.scrollTo({ left: 0, behavior: "smooth" }), 1500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, hinted, reduce]);

  return (
    <section aria-labelledby="howto-title" className="mx-auto mt-7 w-full max-w-[430px]" aria-roledescription="carousel">
      <div className="flex items-center justify-between px-4">
        <h2 id="howto-title" className="text-outline-sm text-[18px] text-cream">
          遊戲玩法
        </h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="howto-panel"
          className="min-h-11 rounded-full px-3 text-[14px] text-cream/80"
        >
          {open ? "收合 ▲" : "查看玩法 ▼"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="howto-panel"
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="relative">
              <div
                ref={scrollerRef}
                onScroll={onScroll}
                className="no-scrollbar flex touch-pan-x snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-[8%] pb-3 pt-1"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {STEPS.map((s, i) => (
                  <article
                    key={i}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`第 ${i + 1} 步，共 ${STEPS.length} 步：${s.title}`}
                    className="paper relative flex w-[84%] shrink-0 snap-center flex-col items-center rounded-[24px] px-5 pb-5 pt-4"
                  >
                    <span className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-wood-dark text-[16px] text-cream">
                      {i + 1}
                    </span>
                    <span className="mt-0.5 text-[17px] text-wood">{s.title}</span>
                    <div className="mt-2 flex h-[108px] w-full items-end justify-center">{s.art}</div>
                    <p className="mt-3 text-center text-[16px] leading-relaxed text-ink">{s.text}</p>
                  </article>
                ))}
              </div>

              {/* 左右箭頭（桌機 / 不想滑的人） */}
              <button
                type="button"
                onClick={() => goTo(Math.max(0, active - 1))}
                disabled={active === 0}
                aria-label="上一步"
                className="absolute left-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-[#1d1309]/60 text-[18px] text-cream transition-opacity disabled:opacity-0"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => goTo(Math.min(STEPS.length - 1, active + 1))}
                disabled={active === STEPS.length - 1}
                aria-label="下一步"
                className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-[#1d1309]/60 text-[18px] text-cream transition-opacity disabled:opacity-0"
              >
                ›
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5">
              {STEPS.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`看第 ${i + 1} 步：${s.title}`}
                  aria-current={active === i ? "step" : undefined}
                  onClick={() => goTo(i)}
                  className="grid h-7 w-7 place-items-center"
                >
                  <span className={`block h-2 rounded-full transition-all duration-300 ${active === i ? "w-5 bg-ember" : "w-2 bg-cream/40"}`} />
                </button>
              ))}
            </div>
            <p className="mt-0.5 text-center text-[12.5px] text-cream/55">← 左右滑動看玩法 →</p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
