import CampFigure from "./illustrations/CampFigure";

export default function ConnectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto flex min-h-[55dvh] max-w-[360px] flex-col items-center justify-center px-6 text-center" role="alert">
      <CampFigure pose="curl" className="w-24 opacity-90" />
      <p className="mt-4 text-[18px] leading-relaxed text-cream">目前連線有點不穩，稍後再試一次。</p>
      <p className="mt-1 text-[14px] text-cream/65">可以先確認手機網路，再按下面的按鈕。</p>
      <button
        type="button"
        onClick={onRetry}
        className="wood mt-6 min-h-[52px] rounded-2xl px-8 text-[17px] text-cream outline-none focus-visible:ring-4 focus-visible:ring-ember/70"
      >
        重新連線
      </button>
    </div>
  );
}
