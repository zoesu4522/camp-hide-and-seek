import Image from "next/image";
import type { ReactNode } from "react";
import { CAMP_ASSETS } from "@/lib/assets";

const LOGO_CHARS: { ch: string; color: string; rot: number; dy: number }[] = [
  { ch: "躲", color: "#FDBA2D", rot: -6, dy: 0 },
  { ch: "貓", color: "#FFF5E7", rot: 3, dy: 4 },
  { ch: "貓", color: "#FFF5E7", rot: -3, dy: 0 },
  { ch: "小", color: "#8FD49B", rot: 5, dy: 3 },
  { ch: "人", color: "#7FCFF5", rot: -4, dy: -1 },
];

/** 主標題「躲貓貓小人」：圓體、多色、粗描邊（之後可換成 /camp/logo.webp） */
export function Logo({ className = "" }: { className?: string }) {
  if (CAMP_ASSETS.logo.ready) {
    return (
      <Image
        src={CAMP_ASSETS.logo.src}
        width={CAMP_ASSETS.logo.width}
        height={CAMP_ASSETS.logo.height}
        alt="躲貓貓小人"
        priority
        className={className}
      />
    );
  }
  return (
    <h1 className={`flex select-none items-end justify-center ${className}`} aria-label="躲貓貓小人">
      {LOGO_CHARS.map((c, i) => (
        <span
          key={i}
          aria-hidden
          className="text-outline inline-block leading-none"
          style={{
            color: c.color,
            transform: `rotate(${c.rot}deg) translateY(${c.dy}px)`,
            fontSize: i === 0 ? "1.18em" : "1em",
          }}
        >
          {c.ch}
        </span>
      ))}
    </h1>
  );
}

/** 木牌（副標題） */
export function WoodSign({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`wood relative rounded-[14px] px-5 py-2.5 ${className}`}>
      <span className="nail absolute left-2 top-1/2 -translate-y-1/2" />
      <span className="nail absolute right-2 top-1/2 -translate-y-1/2" />
      <p className="text-outline-sm text-center text-[17px] leading-snug tracking-wide text-cream">{children}</p>
    </div>
  );
}

/** 小松樹 icon */
export function PineIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 24" className={className} aria-hidden>
      <path d="M10 1 L4 9 H7 L2 16 H8 V22 H12 V16 H18 L13 9 H16 Z" fill="currentColor" />
    </svg>
  );
}
