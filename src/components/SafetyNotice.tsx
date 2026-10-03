import { PineIcon } from "./illustrations/Brand";

export default function SafetyNotice() {
  return (
    <section aria-labelledby="safety-title" className="mx-auto mt-8 w-full max-w-[400px] px-4">
      <div className="wood-dark relative flex items-center gap-3.5 rounded-[20px] border border-ember/35 px-4 py-4">
        <svg viewBox="0 0 48 44" className="h-11 w-12 shrink-0" aria-hidden>
          <path d="M24 3 L46 41 H2 Z" fill="#FDBA2D" stroke="#FDBA2D" strokeWidth="4" strokeLinejoin="round" />
          <rect x="21.5" y="15" width="5" height="14" rx="2.5" fill="#3a2412" />
          <circle cx="24" cy="34.5" r="2.8" fill="#3a2412" />
        </svg>
        <div className="min-w-0">
          <h2 id="safety-title" className="text-[17px] text-ember">
            安全提醒
          </h2>
          <p className="mt-0.5 text-[14.5px] leading-relaxed text-cream/90">
            找的時候請注意安全，
            <br />
            不要翻找危險或禁止進入的地方喔！
          </p>
        </div>
        <PineIcon className="absolute bottom-2 right-3 h-5 w-5 text-forest/50" />
      </div>
    </section>
  );
}
