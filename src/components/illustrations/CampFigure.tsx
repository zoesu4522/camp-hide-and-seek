import { useId } from "react";

/**
 * 圓潤、無臉、白色的極簡小人（SVG 插畫版 placeholder）。
 * 參考實體小人：白色、圓潤、無臉、不同姿勢。正式 3D 素材之後可替換。
 */
export type FigurePose =
  | "stand"
  | "cheer"
  | "kneel"
  | "lie"
  | "star"
  | "flex"
  | "bow"
  | "curl"
  | "wave"
  | "search";

type Pt = [number, number];
interface Seg {
  pts: Pt[];
  w: number;
}
interface PoseDef {
  head: Pt;
  r?: number;
  segs: Seg[];
}

const T = 26; // torso
const L = 12; // limbs

const POSES: Record<FigurePose, PoseDef> = {
  stand: {
    head: [50, 20],
    segs: [
      { pts: [[39, 41], [34, 70]], w: L },
      { pts: [[61, 41], [66, 70]], w: L },
      { pts: [[45, 72], [44, 106]], w: L + 1 },
      { pts: [[55, 72], [56, 106]], w: L + 1 },
      { pts: [[50, 41], [50, 68]], w: T },
    ],
  },
  cheer: {
    head: [50, 26],
    segs: [
      { pts: [[41, 46], [34, 10]], w: L },
      { pts: [[59, 46], [66, 10]], w: L },
      { pts: [[45, 76], [45, 108]], w: L + 1 },
      { pts: [[55, 76], [55, 108]], w: L + 1 },
      { pts: [[50, 47], [50, 72]], w: T },
    ],
  },
  kneel: {
    head: [50, 42],
    segs: [
      { pts: [[40, 98], [60, 98]], w: 18 },
      { pts: [[39, 62], [36, 88]], w: L },
      { pts: [[61, 62], [64, 88]], w: L },
      { pts: [[50, 62], [50, 86]], w: T },
    ],
  },
  lie: {
    head: [15, 88],
    segs: [
      { pts: [[36, 76], [60, 75]], w: 11 },
      { pts: [[36, 100], [60, 101]], w: 11 },
      { pts: [[64, 83], [93, 80]], w: L + 1 },
      { pts: [[64, 94], [93, 97]], w: L + 1 },
      { pts: [[33, 88], [60, 88]], w: 25 },
    ],
  },
  star: {
    head: [50, 24],
    segs: [
      { pts: [[41, 46], [14, 26]], w: L },
      { pts: [[59, 46], [86, 26]], w: L },
      { pts: [[45, 74], [26, 106]], w: L + 1 },
      { pts: [[55, 74], [74, 106]], w: L + 1 },
      { pts: [[50, 45], [50, 70]], w: T },
    ],
  },
  flex: {
    head: [50, 24],
    segs: [
      { pts: [[40, 46], [24, 50], [21, 30]], w: L },
      { pts: [[60, 46], [76, 50], [79, 30]], w: L },
      { pts: [[45, 76], [40, 108]], w: L + 1 },
      { pts: [[55, 76], [60, 108]], w: L + 1 },
      { pts: [[50, 46], [50, 72]], w: T },
    ],
  },
  bow: {
    head: [80, 62],
    segs: [
      { pts: [[38, 72], [38, 108]], w: L + 1 },
      { pts: [[47, 72], [47, 108]], w: L + 1 },
      { pts: [[42, 66], [66, 54]], w: T },
      { pts: [[64, 60], [70, 90]], w: L },
    ],
  },
  curl: {
    head: [80, 92],
    r: 12,
    segs: [
      { pts: [[28, 100], [58, 103]], w: 15 },
      { pts: [[32, 84], [64, 82]], w: 30 },
      { pts: [[66, 98], [90, 106]], w: 10 },
    ],
  },
  wave: {
    head: [50, 20],
    segs: [
      { pts: [[39, 41], [34, 70]], w: L },
      { pts: [[61, 41], [72, 24], [76, 6]], w: L },
      { pts: [[45, 72], [44, 106]], w: L + 1 },
      { pts: [[55, 72], [56, 106]], w: L + 1 },
      { pts: [[50, 41], [50, 68]], w: T },
    ],
  },
  search: {
    head: [30, 62],
    segs: [
      { pts: [[46, 78], [42, 104]], w: L },
      { pts: [[70, 80], [74, 104]], w: L + 1 },
      { pts: [[62, 80], [60, 104]], w: L + 1 },
      { pts: [[46, 72], [70, 72]], w: 24 },
      { pts: [[42, 76], [24, 92]], w: L },
    ],
  },
};

export const SLOT_POSES: FigurePose[] = ["stand", "cheer", "kneel", "lie", "star", "flex", "bow", "curl"];

interface Props {
  pose?: FigurePose;
  variant?: "found" | "hidden";
  className?: string;
  title?: string;
}

export default function CampFigure({ pose = "stand", variant = "found", className, title }: Props) {
  const uid = useId().replace(/:/g, "");
  const def = POSES[pose];
  const r = def.r ?? 13;
  const hidden = variant === "hidden";
  const fill = hidden ? "#59606b" : `url(#body-${uid})`;

  const path = (s: Seg) => s.pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");

  return (
    <svg
      viewBox="0 0 100 120"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {!hidden && (
        <defs>
          <linearGradient id={`body-${uid}`} gradientUnits="userSpaceOnUse" x1="20" y1="10" x2="85" y2="115">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.65" stopColor="#f3efe8" />
            <stop offset="1" stopColor="#d9d2c6" />
          </linearGradient>
          <radialGradient id={`head-${uid}`} cx="0.36" cy="0.32" r="0.75">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.6" stopColor="#f1ece4" />
            <stop offset="1" stopColor="#cfc6b8" />
          </radialGradient>
        </defs>
      )}

      {/* 地面陰影 */}
      <ellipse cx="50" cy="113" rx="30" ry="4" fill="#000" opacity={hidden ? 0.12 : 0.22} />

      {/* 立體感：偏移的暗色層 */}
      {!hidden && (
        <g stroke="#bfb6a8" fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(1.6 2.2)">
          {def.segs.map((s, i) => (
            <path key={i} d={path(s)} strokeWidth={s.w} />
          ))}
          <circle cx={def.head[0]} cy={def.head[1]} r={r} fill="#bfb6a8" stroke="none" />
        </g>
      )}

      <g stroke={fill} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {def.segs.map((s, i) => (
          <path key={i} d={path(s)} strokeWidth={s.w} />
        ))}
      </g>
      <circle cx={def.head[0]} cy={def.head[1]} r={r} fill={hidden ? "#59606b" : `url(#head-${uid})`} />

      {/* 高光 */}
      {!hidden && (
        <ellipse
          cx={def.head[0] - r * 0.35}
          cy={def.head[1] - r * 0.4}
          rx={r * 0.28}
          ry={r * 0.18}
          fill="#fff"
          opacity="0.9"
        />
      )}

      {pose === "search" && (
        <g>
          <path d="M20 96 L8 110" stroke="#5a3a1c" strokeWidth="5" strokeLinecap="round" />
          <circle cx="22" cy="93" r="8" fill="#bfe6f7" fillOpacity="0.6" stroke="#3a2412" strokeWidth="3.5" />
        </g>
      )}
    </svg>
  );
}
