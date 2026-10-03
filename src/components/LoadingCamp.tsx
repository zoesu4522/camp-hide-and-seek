import CampFigure from "./illustrations/CampFigure";

/** Loading：小人躲在帳篷後左右探頭 */
export default function LoadingCamp() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6" role="status" aria-live="polite">
      <div className="relative h-36 w-48">
        <div className="absolute bottom-2 left-1/2 w-14 -translate-x-1/2">
          <div className="motion-loop animate-bob" style={{ animationDuration: "3.2s" }}>
            <CampFigure pose="wave" className="w-full" />
          </div>
        </div>
        <svg viewBox="0 0 120 80" className="absolute bottom-0 left-1/2 w-40 -translate-x-1/2" aria-hidden>
          <ellipse cx="60" cy="76" rx="56" ry="5" fill="#000" opacity="0.35" />
          <path d="M8 76 L60 8 L112 76 Z" fill="#d9b27a" />
          <path d="M8 76 L60 8 L60 76 Z" fill="#c69a5d" />
          <path d="M46 76 L60 34 L74 76 Z" fill="#7a4e26" />
        </svg>
      </div>
      <p className="mt-5 text-[17px] tracking-wider text-cream/90">正在準備營地...</p>
    </div>
  );
}
