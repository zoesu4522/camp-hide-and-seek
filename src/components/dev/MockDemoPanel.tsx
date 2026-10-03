"use client";

import { mockReset, mockSimulateRemoteFind } from "@/lib/mock/mockGameService";

/**
 * 開發測試面板：只有網址帶 ?demo 時才出現（mock 模式專用）。
 * 用來模擬「其他玩家找到小人」以及重置 mock 資料。
 * 正式版的 Reset 只能在 Supabase 後台操作。
 */
export default function MockDemoPanel() {
  return (
    <div className="mx-auto mt-6 w-full max-w-[400px] px-4">
      <div className="rounded-2xl border border-dashed border-sky/50 bg-[#06111f]/80 p-3 text-[13px] text-cream/80">
        <p className="mb-2 text-sky">開發測試（mock 模式，?demo）</p>
        <div className="flex flex-wrap gap-2">
          <a href="/admin" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-ember/20 px-3 text-cream">
            開啟後台 ↗
          </a>
          <button
            type="button"
            className="min-h-11 rounded-xl bg-sky/20 px-3 text-cream"
            onClick={() => mockSimulateRemoteFind()}
          >
            模擬其他玩家找到一個
          </button>
          <button
            type="button"
            className="min-h-11 rounded-xl bg-white/10 px-3 text-cream"
            onClick={() => {
              mockReset([1, 2, 3, 4, 5, 6, 7]);
              window.location.reload();
            }}
          >
            設成 7 / 8
          </button>
          <button
            type="button"
            className="min-h-11 rounded-xl bg-white/10 px-3 text-cream"
            onClick={() => {
              mockReset();
              window.location.reload();
            }}
          >
            重置成 3 / 8
          </button>
        </div>
      </div>
    </div>
  );
}
