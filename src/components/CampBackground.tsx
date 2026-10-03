import Image from "next/image";
import { CAMP_ASSETS } from "@/lib/assets";

/**
 * 夜晚營地背景（分層）。所有裝飾 pointer-events-none，不會擋住按鈕。
 * 背景微動畫全部用 CSS keyframes（transform / opacity），並在 reduced motion 時停止。
 *
 * z-0  天空、星星、山、樹林、帳篷、串燈
 * z-10 左右大樹（環境前景）
 * z-30 前景樹葉（ForegroundLeaves，由頁面另外放）
 */

// 固定的偽隨機星星位置（避免 hydration 不一致）
const STARS = Array.from({ length: 30 }, (_, i) => {
  const x = (i * 37.7 + 11) % 100;
  const y = (i * 23.3 + 7) % 42;
  const s = i % 5 === 0 ? 2.5 : i % 3 === 0 ? 1.8 : 1.2;
  return { x, y, s, d: (i % 7) * 0.45, dur: 2.6 + (i % 4) * 0.7 };
});

const BULBS = Array.from({ length: 11 }, (_, i) => {
  const t = i / 10;
  const x = 4 + t * 92;
  // 串燈下垂曲線
  const u = x / 100;
  const y = 6 + 36 * u * (1 - u) + 0.8; // 對齊 SVG 二次曲線（單位 = 1vh）
  return { x, y, d: (i * 0.37) % 2.2, dur: 1.8 + (i % 3) * 0.6 };
});

export function CampScenery() {
  if (CAMP_ASSETS.background.ready) {
    return (
      <div className="absolute inset-0">
        <Image
          src={CAMP_ASSETS.background.src}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {/* 天空 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 60% at 80% 8%, rgba(85,183,233,0.16) 0%, transparent 55%), linear-gradient(180deg, #050f1d 0%, #07182b 35%, #0d2a3f 62%, #12301f 82%, #0b1c12 100%)",
        }}
      />

      {/* 星星 */}
      {STARS.map((s, i) => (
        <span
          key={i}
          className="motion-loop absolute rounded-full bg-cream animate-twinkle"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.s,
            height: s.s,
            animationDelay: `${s.d}s`,
            animationDuration: `${s.dur}s`,
          }}
        />
      ))}

      {/* 月光 */}
      <div
        className="absolute right-[8%] top-[6%] h-16 w-16 rounded-full"
        style={{
          background: "radial-gradient(circle, #fff6dc 0%, #ffe9b0 38%, rgba(253,186,45,0) 72%)",
          opacity: 0.55,
        }}
      />

      {/* 遠山 */}
      <svg
        className="absolute inset-x-0 top-[34%] h-[22%] w-full"
        viewBox="0 0 400 100"
        preserveAspectRatio="none"
      >
        <path d="M0 70 L50 30 L95 60 L150 18 L210 64 L260 28 L320 58 L360 34 L400 52 L400 100 L0 100 Z" fill="#0e2740" />
        <path d="M0 82 L60 52 L120 78 L180 46 L240 80 L300 50 L360 76 L400 60 L400 100 L0 100 Z" fill="#0b2234" />
      </svg>

      {/* 樹林剪影 */}
      <svg
        className="absolute inset-x-0 top-[44%] h-[22%] w-full"
        viewBox="0 0 400 100"
        preserveAspectRatio="none"
      >
        <path
          d="M0 100 L0 60 L10 30 L20 60 L28 40 L36 62 L46 20 L58 64 L68 38 L78 66 L90 28 L102 66 L112 44 L122 68 L134 24 L146 66 L156 46 L166 70 L178 34 L190 68 L200 48 L210 70 L222 30 L234 66 L244 44 L254 68 L266 22 L278 64 L288 40 L298 66 L310 30 L322 66 L332 46 L342 68 L354 26 L366 64 L376 42 L386 64 L396 34 L400 50 L400 100 Z"
          fill="#0a1f1a"
        />
      </svg>

      {/* 遠處帳篷（暖光） */}
      <div className="absolute right-[6%] top-[55%] w-[34%] max-w-[180px]">
        <svg viewBox="0 0 120 80" className="w-full">
          <ellipse cx="60" cy="74" rx="56" ry="6" fill="#000" opacity="0.35" />
          <path d="M8 74 L60 8 L112 74 Z" fill="#d9b27a" />
          <path d="M8 74 L60 8 L60 74 Z" fill="#c69a5d" />
          <path d="M44 74 L60 30 L76 74 Z" fill="#ffd27a" />
          <path d="M48 74 L60 40 L72 74 Z" fill="#fff0c2" opacity="0.8" />
          <path d="M60 8 L60 2" stroke="#6b4421" strokeWidth="2" />
        </svg>
        <div
          className="motion-loop absolute inset-x-[10%] bottom-[-10%] top-[30%] animate-flicker rounded-full"
          style={{
            background: "radial-gradient(closest-side, rgba(253,186,45,0.35), rgba(253,186,45,0))",
            animationDuration: "3.6s",
          }}
        />
      </div>

      {/* 營火光暈（左下） */}
      <div className="absolute bottom-[4%] left-[-12%] h-[38%] w-[80%]">
        <div
          className="motion-loop absolute inset-0 animate-flicker rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(253,150,45,0.32), rgba(253,120,45,0))" }}
        />
      </div>

      {/* 地面 */}
      <div
        className="absolute inset-x-0 bottom-0 h-[30%]"
        style={{ background: "linear-gradient(180deg, rgba(11,28,18,0) 0%, #0b1c12 55%, #08140d 100%)" }}
      />

      {/* 串燈 */}
      <svg className="absolute inset-x-0 top-0 h-[22vh] w-full" viewBox="0 0 100 22" preserveAspectRatio="none">
        <path d="M0 6 Q 50 24 100 6" stroke="#2b1b0e" strokeWidth="0.35" fill="none" />
      </svg>
      {BULBS.map((b, i) => (
        <span
          key={i}
          className="motion-loop absolute -translate-x-1/2 animate-twinkle rounded-full"
          style={{
            left: `${b.x}%`,
            top: `calc(${b.y} * 1vh)`,
            width: 9,
            height: 9,
            background: "radial-gradient(circle at 40% 35%, #fff7d6, #fdba2d 60%, #e08a14)",
            boxShadow: "0 0 10px 3px rgba(253,186,45,0.55)",
            animationDelay: `${b.d}s`,
            animationDuration: `${b.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

/** 左右框景大樹（z-10） */
export function SideTrees() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <svg className="absolute -left-10 top-[18%] h-[85%] w-28 opacity-95" viewBox="0 0 60 300" preserveAspectRatio="xMinYMin slice">
        <rect x="18" y="0" width="16" height="300" rx="6" fill="#2a1a0e" />
        <rect x="22" y="0" width="5" height="300" fill="#3a2414" />
        <path d="M0 60 L44 40 L8 90 L52 74 L0 130 L48 118 L0 170 Z" fill="#0f2a1d" />
      </svg>
      <svg className="absolute -right-12 top-[8%] h-[70%] w-28 opacity-90" viewBox="0 0 60 300" preserveAspectRatio="xMaxYMin slice">
        <rect x="28" y="0" width="14" height="300" rx="6" fill="#26170c" />
        <path d="M60 50 L14 34 L52 82 L8 70 L60 124 L12 112 L60 160 Z" fill="#0e2619" />
      </svg>
    </div>
  );
}

function LeafCluster({ flip = false, className }: { flip?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <g>
        <path d="M0 0 C40 10 70 30 92 64" stroke="#1f3b22" strokeWidth="3" fill="none" />
        {[
          [24, 10, 30, "#3f7a4a"],
          [44, 22, 50, "#5d9a68"],
          [62, 38, 62, "#356b40"],
          [78, 56, 80, "#4f8c5a"],
          [30, 28, 70, "#2f5f39"],
          [56, 8, 20, "#4a8656"],
          [12, 30, 95, "#2a5233"],
        ].map(([x, y, r, c], i) => (
          <ellipse key={i} cx={x as number} cy={y as number} rx="16" ry="7" fill={c as string} transform={`rotate(${r} ${x} ${y})`} />
        ))}
      </g>
    </svg>
  );
}

/** 前景樹葉（z-30，緩慢搖擺） */
export function ForegroundLeaves() {
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden>
      <div className="motion-loop absolute -left-8 -top-6 w-32 origin-top-left animate-sway" style={{ animationDuration: "6.5s" }}>
        <LeafCluster className="w-full" />
      </div>
      <div
        className="motion-loop absolute -right-10 top-[38%] w-24 origin-right animate-sway opacity-80"
        style={{ animationDuration: "5.2s", animationDelay: "-1.4s" }}
      >
        <LeafCluster flip className="w-full" />
      </div>
    </div>
  );
}

export default function CampBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <CampScenery />
      <div className="absolute inset-0 z-10">
        <SideTrees />
      </div>
    </div>
  );
}
