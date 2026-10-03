"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState, type ReactNode } from "react";
import CampFigure from "./illustrations/CampFigure";
import { cardReveal, staggerContainer } from "@/motion/variants";

function PhoneArt() {
  return (
    <div className="flex items-end justify-center gap-1">
      <div className="relative h-[68px] w-10 rounded-[9px] border-[3px] border-[#2b2b33] bg-[#f6f6f6] p-1 shadow">
        <div className="grid h-full grid-cols-4 grid-rows-6 gap-[1.5px] rounded-sm p-0.5">
          {[1,1,0,1, 1,0,1,1, 0,1,0,0, 1,1,0,1, 0,0,1,1, 1,0,1,0].map((v, i) => (
            <span key={i} className={v ? "rounded-[1px] bg-[#2b2b33]" : ""} />
          ))}
        </div>
      </div>
      <CampFigure pose="wave" className="w-11" />
    </div>
  );
}

function GroupArt() {
  return (
    <div className="flex items-end justify-center -space-x-4">
      <CampFigure pose="cheer" className="w-11" />
      <CampFigure pose="flex" className="relative z-10 w-12" />
      <CampFigure pose="cheer" className="w-11" />
    </div>
  );
}

const STEPS: { art: ReactNode; text: ReactNode }[] = [
  {
    art: <CampFigure pose="search" className="mx-auto w-[72px]" />,
    text: (
      <>
        26 位玩家，一起在營區裡尋找藏起來的 <b className="text-wood">8 個小人</b>。
      </>
    ),
  },
  { art: <PhoneArt />, text: <>找到小人後，回到這個網站。</> },
  {
    art: <CampFigure pose="cheer" className="mx-auto w-16" />,
    text: <>拍下小人的照片，點亮一個「躲貓貓小人」。</>,
  },
  {
    art: <GroupArt />,
    text: (
      <>
        8 個小人全部找到，就完成任務啦！<span aria-hidden>🎉</span>
      </>
    ),
  },
];

export default function HowToPlay() {
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState(0);
  const scrollerRef = useRef<HTMLOListElement>(null);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    if (!card) return;
    const step = card.offsetWidth + 12;
    setActive(Math.min(STEPS.length - 1, Math.round(el.scrollLeft / step)));
  };

  const goTo = (i: number) => {
    const el = scrollerRef.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft - 16, behavior: "smooth" });
  };

  return (
    <section aria-labelledby="howto-title" className="mx-auto mt-7 w-full max-w-[430px]">
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
            <motion.ol
              ref={scrollerRef}
              onScroll={onScroll}
              className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 pt-1"
              variants={staggerContainer(0.1)}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.3 }}
              aria-label="玩法步驟，可左右滑動"
            >
              {STEPS.map((s, i) => (
                <motion.li
                  key={i}
                  variants={cardReveal}
                  className="paper relative flex w-[44%] min-w-[150px] shrink-0 snap-start flex-col items-center rounded-[22px] px-3 pb-4 pt-3"
                >
                  <span className="absolute left-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-wood-dark text-[15px] text-cream">
                    {i + 1}
                  </span>
                  <div className="flex h-[84px] w-full items-end justify-center">{s.art}</div>
                  <p className="mt-2 text-center text-[14px] leading-snug text-ink">{s.text}</p>
                </motion.li>
              ))}
            </motion.ol>

            <div className="mt-1 flex justify-center gap-1.5" role="tablist" aria-label="玩法頁">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={active === i}
                  aria-label={`第 ${i + 1} 步`}
                  onClick={() => goTo(i)}
                  className="grid h-6 w-6 place-items-center"
                >
                  <span
                    className={`block h-2 rounded-full transition-all duration-300 ${
                      active === i ? "w-5 bg-ember" : "w-2 bg-cream/40"
                    }`}
                  />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
