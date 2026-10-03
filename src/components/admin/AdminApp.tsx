"use client";

import { useCallback, useEffect, useState } from "react";
import { adminService } from "@/lib/services";
import type { AdminService, AdminSession } from "@/types/game";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";

type Phase = { kind: "checking" } | { kind: "signed_out" } | { kind: "signed_in"; session: AdminSession };

export default function AdminApp({ service = adminService }: { service?: AdminService }) {
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;
    service
      .getSession()
      .then((session) => {
        if (cancelled) return;
        setPhase(session ? { kind: "signed_in", session } : { kind: "signed_out" });
      })
      .catch(() => !cancelled && setPhase({ kind: "signed_out" }));
    return () => {
      cancelled = true;
    };
  }, [service]);

  const signOut = useCallback(async () => {
    await service.signOut();
    setPhase({ kind: "signed_out" });
  }, [service]);

  return (
    <div className="min-h-dvh bg-[#07182b] text-cream">
      {phase.kind === "checking" && (
        <div className="grid min-h-dvh place-items-center text-cream/70" role="status">
          檢查登入狀態…
        </div>
      )}
      {phase.kind === "signed_out" && (
        <AdminLogin service={service} onSignedIn={(session) => setPhase({ kind: "signed_in", session })} />
      )}
      {phase.kind === "signed_in" && <AdminDashboard service={service} session={phase.session} onSignOut={signOut} />}
    </div>
  );
}
