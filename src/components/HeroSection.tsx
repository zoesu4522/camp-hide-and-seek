"use client";

import { motion } from "framer-motion";
import CampFigure from "./illustrations/CampFigure";
import { Logo, PineIcon, WoodSign } from "./illustrations/Brand";
import { fadeUp, staggerContainer } from "@/motion/variants";

/** 從樹幹後偷偷探頭的小人（CSS loop，5～8 秒週期） */
export function PeekingFigure({ side = "left" }: { side?: "left" | "right" }) {
  const isLeft = side === "left";
  return (
    <div
      className={`pointer-events-none absolute top-[118px] h-36 w-20 overflow-hidden ${isLeft ? "left-0" : "right-0"}`}
      aria-hidden
    >
      <div
        className={`motion-loop absolute bottom-3 w-14 ${isLeft ? "left-3 animate-peek" : "right-3 animate-peek-right"}`}
        style={{ transformOrigin: "bottom center" }}
      >
        <CampFigure pose="wave" className={`w-full ${isLeft ? "" : "-scale-x-100"}`} />
      </div>
      {/* 樹幹 */}
      <div
        className={`absolute bottom-0 top-0 w-7 rounded-md ${isLeft ? "left-0" : "right-0"}`}
        style={{ background: "linear-gradient(90deg, #2a1a0e, #4a2e17 45%, #2a1a0e)" }}
      />
    </div>
  );
}

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 pb-4 pt-[calc(env(safe-area-inset-top)+28px)]">
      <PeekingFigure side="left" />

      <motion.div
        variants={staggerContainer(0.12)}
        initial="hidden"
        animate="show"
        className="relative flex flex-col items-center"
      >
        <motion.div variants={fadeUp}>
          <Logo className="text-[clamp(50px,14.5vw,64px)]" />
        </motion.div>

        <motion.div variants={fadeUp} className="mt-4 w-full max-w-[340px]">
          <WoodSign>
            一起找出 8 個躲起來的小人吧！
            <PineIcon className="ml-1 inline-block h-4 w-4 -translate-y-0.5 text-forest" />
          </WoodSign>
        </motion.div>

        <motion.p
          variants={fadeUp}
          className="mt-4 max-w-[300px] text-center text-[15px] leading-relaxed text-cream/85"
        >
          26 位玩家，一起在營區裡
          <br />
          尋找藏起來的 8 個小人！
        </motion.p>
      </motion.div>
    </section>
  );
}
