"use client";

import { motion } from "framer-motion";
import type { Figure } from "@/types/game";
import FigureCard from "./FigureCard";
import { cardReveal, staggerContainer } from "@/motion/variants";

interface Props {
  figures: Figure[];
  celebrateNumber: number | null;
  onSelect: (figure: Figure) => void;
  onView: (figure: Figure) => void;
}

export default function FigureGrid({ figures, celebrateNumber, onSelect, onView }: Props) {
  return (
    <section id="figures" aria-labelledby="figures-title" className="mx-auto mt-5 w-full max-w-[420px] scroll-mt-6 px-3">
      <div className="mb-2.5 flex items-end justify-between px-1">
        <h2 id="figures-title" className="text-outline-sm text-[18px] text-cream">
          躲貓貓小人
        </h2>
        <p className="text-[13px] text-cream/75">找到了？點小人拍照回報</p>
      </div>

      {/* 原木平台 */}
      <div className="wood-dark rounded-[22px] p-2.5 pb-3">
        <motion.ul
          className="grid grid-cols-4 gap-2"
          variants={staggerContainer(0.05, 0.1)}
          initial="hidden"
          animate="show"
        >
          {figures.map((f) => (
            <motion.li key={f.id} variants={cardReveal}>
              <FigureCard figure={f} celebrate={celebrateNumber === f.number} onSelect={onSelect} onView={onView} />
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
