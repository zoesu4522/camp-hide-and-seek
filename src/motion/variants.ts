import type { Transition, Variants } from "framer-motion";

export const easeOutSoft: Transition["ease"] = [0.22, 1, 0.36, 1];

export const springPop: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 18,
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easeOutSoft },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4 } },
};

export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  show: { opacity: 1, scale: 1, transition: springPop },
};

export const staggerContainer = (stagger = 0.1, delayChildren = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren } },
});

export const cardReveal: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: easeOutSoft },
  },
};

/** 數字更新時的彈跳：1 → 1.2 → 1，0.3s */
export const numberBump = {
  scale: [1, 1.2, 1],
  transition: { duration: 0.3 },
};
