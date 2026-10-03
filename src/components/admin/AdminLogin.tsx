"use client";

import { useState } from "react";
import { mockCompleteMagicLink } from "@/lib/mock/mockAdminService";
import { IS_MOCK } from "@/lib/services";
import type { AdminService, AdminSession } from "@/types/game";
import { Logo } from "../illustrations/Brand";

interface Props {
  service: AdminService;
  onSignedIn: (session: AdminSession) => void;
}

/** Email magic link 登入（Supabase Auth）。mock 模式提供「模擬點擊信中連結」。 */
export default function AdminLogin({ service, onSignedIn }: Props) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setState("sending");
    const res = await service.signInWithEmail(email);
    if (res.status === "sent") {
      setState("sent");
    } else {
      setState("idle");
      setError(
        res.status === "not_allowed" ? "這個 Email 沒有後台權限。" : (res.message ?? "登入連結寄送失敗，請稍後再試。"),
      );
    }
  };

  const completeMock = () => {
    const session = mockCompleteMagicLink();
    if (session) onSignedIn(session);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-[400px] flex-col justify-center px-5 py-10">
      <Logo className="text-[44px]" />
      <p className="mt-2 text-center text-[15px] tracking-[0.3em] text-cream/70">管理後台</p>

      <div className="mt-8 rounded-[22px] border border-white/10 bg-[#0f2236] p-5">
        {state !== "sent" ? (
          <form onSubmit={submit} noValidate>
            <label htmlFor="admin-email" className="text-[15px] text-cream/90">
              管理員 Email
            </label>
            <input
              id="admin-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-2 block min-h-12 w-full rounded-xl border border-white/15 bg-[#07182b] px-3.5 text-[16px] text-cream placeholder:text-cream/35 outline-none focus:border-ember focus:ring-2 focus:ring-ember/40"
            />
            {error && (
              <p className="mt-2 text-[14px] text-[#ff9b73]" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={state === "sending" || !email}
              className="mt-4 min-h-12 w-full rounded-xl bg-ember text-[16px] text-ink outline-none focus-visible:ring-4 focus-visible:ring-sky/60 disabled:opacity-50"
            >
              {state === "sending" ? "寄送中…" : "寄送登入連結"}
            </button>
            <p className="mt-3 text-[13px] leading-relaxed text-cream/55">
              我們會寄一封含登入連結的信到你的信箱，不需要密碼。只有在管理員名單內的 Email 可以登入。
            </p>
          </form>
        ) : (
          <div role="status">
            <p className="text-[18px]">📬 登入連結已寄出</p>
            <p className="mt-2 text-[14.5px] leading-relaxed text-cream/75">
              請到 <span className="text-ember">{email}</span> 的信箱，點信中的連結完成登入。 建議用這支手機 /
              這台電腦的瀏覽器開啟連結。
            </p>
            <button
              type="button"
              onClick={() => setState("idle")}
              className="mt-4 min-h-11 text-[14px] text-cream/60 underline underline-offset-4"
            >
              換一個 Email
            </button>

            {IS_MOCK && (
              <div className="mt-5 rounded-xl border border-dashed border-sky/50 p-3">
                <p className="text-[13px] text-sky">mock 模式：沒有真的寄信</p>
                <button
                  type="button"
                  onClick={completeMock}
                  className="mt-2 min-h-11 w-full rounded-lg bg-sky/20 text-[15px] text-cream"
                >
                  模擬點擊信中連結
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
