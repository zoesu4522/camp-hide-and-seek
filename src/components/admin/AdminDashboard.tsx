"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GAME_SLUG,
  TOTAL_FIGURES,
  type AdminService,
  type AdminSession,
  type Figure,
  type Game,
  type ReviewStatus,
  type Submission,
} from "@/types/game";
import PhotoViewer, { type PhotoViewerItem } from "../PhotoViewer";
import AdminTimerPanel from "./AdminTimerPanel";

interface Props {
  service: AdminService;
  session: AdminSession;
  onSignOut: () => void;
}

type Filter = "all" | "active" | "failed" | "rejected" | "duplicate";

const FILTERS: { key: Filter; label: string; match: (s: Submission) => boolean }[] = [
  { key: "all", label: "全部", match: () => true },
  { key: "active", label: "待確認", match: (s) => s.reviewStatus === "active" },
  { key: "failed", label: "上傳失敗", match: (s) => s.uploadStatus === "failed" },
  { key: "rejected", label: "已退回", match: (s) => s.reviewStatus === "rejected" },
  { key: "duplicate", label: "重複", match: (s) => s.reviewStatus === "duplicate" },
];

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "—";

const kb = (bytes: number | null) => (bytes ? `${Math.max(1, Math.round(bytes / 1024))} KB` : null);

function UploadBadge({ s }: { s: Submission }) {
  if (s.uploadStatus === "uploaded")
    return <span className="rounded-full bg-forest/25 px-2.5 py-0.5 text-[12.5px] text-[#9fe0aa]">● 上傳成功</span>;
  if (s.uploadStatus === "failed")
    return <span className="rounded-full bg-[#e8794a]/20 px-2.5 py-0.5 text-[12.5px] text-[#ffab88]">✕ 上傳失敗</span>;
  return <span className="rounded-full bg-ember/20 px-2.5 py-0.5 text-[12.5px] text-ember">… 上傳中</span>;
}

const REVIEW_LABEL: Record<ReviewStatus, { text: string; cls: string } | null> = {
  none: null,
  active: { text: "已點亮・待確認", cls: "bg-ember/15 text-ember" },
  approved: { text: "✓ 已確認正確", cls: "bg-sky/20 text-[#9bd8f7]" },
  rejected: { text: "已退回", cls: "bg-white/10 text-cream/60" },
  duplicate: { text: "重複（已被別人點亮）", cls: "bg-white/10 text-cream/60" },
};

export default function AdminDashboard({ service, session, onSignOut }: Props) {
  const [game, setGame] = useState<Game | null>(null);
  const [figures, setFigures] = useState<Figure[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<PhotoViewerItem | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      service
        .listSubmissions(GAME_SLUG)
        .then((res) => {
          setGame((g) => (!g || res.game.timer.version >= g.timer.version ? res.game : g));
          setFigures([...res.figures].sort((a, b) => a.number - b.number));
          setSubmissions([...res.submissions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
          setUpdatedAt(new Date().toISOString());
          setLoadState("ready");
        })
        .catch(() => setLoadState("error")),
    [service],
  );

  // 初始載入 + 即時更新
  useEffect(() => {
    load();
    return service.subscribe(() => {
      load();
    });
  }, [service, load, reloadToken]);

  const stats = useMemo(
    () => ({
      found: figures.filter((f) => f.isFound).length,
      uploaded: submissions.filter((s) => s.uploadStatus === "uploaded").length,
      failed: submissions.filter((s) => s.uploadStatus === "failed").length,
      pending: submissions.filter((s) => s.reviewStatus === "active").length,
    }),
    [figures, submissions],
  );

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!;
    return submissions.filter(f.match);
  }, [submissions, filter]);

  const review = async (s: Submission, action: "approve" | "reject") => {
    setBusyId(s.id);
    setActionError(null);
    const res = await service.reviewSubmission(s.id, action, session.email).catch(() => ({ ok: false }));
    if (!res.ok) setActionError(`#${s.figureNumber} 審核沒有成功（可能已被其他管理員處理），已重新整理。`);
    setBusyId(null);
    setConfirmRejectId(null);
    load();
  };

  const view = (url: string, number: number, subtitle: string) =>
    setViewing({ key: url.slice(-32) + number, url, title: `#${number} 小人照片`, subtitle });

  const closeViewer = useCallback(() => setViewing(null), []);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-[calc(env(safe-area-inset-top)+16px)]">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px]">躲貓貓小人・後台</h1>
          <p className="mt-0.5 flex items-center gap-2 text-[13px] text-cream/60">
            <span className="relative flex h-2 w-2">
              <span className="motion-loop absolute inline-flex h-full w-full animate-ping rounded-full bg-forest opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-forest" />
            </span>
            即時同步中・更新於 {time(updatedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          <span className="max-w-[180px] truncate text-cream/70">{session.email}</span>
          <button
            type="button"
            onClick={onSignOut}
            className="min-h-10 rounded-lg border border-white/15 px-3 text-cream/85 hover:bg-white/5"
          >
            登出
          </button>
        </div>
      </header>

      {loadState === "error" && (
        <div className="mt-6 rounded-2xl border border-[#e8794a]/50 bg-[#2a1610] p-4" role="alert">
          讀取資料失敗。
          <button type="button" onClick={() => setReloadToken((t) => t + 1)} className="ml-2 text-ember underline">
            重新載入
          </button>
        </div>
      )}

      {loadState !== "error" && <AdminTimerPanel service={service} timer={game?.timer} onChanged={load} />}

      {/* Stats */}
      <section className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4" aria-label="統計">
        {[
          { label: "進度", value: `${stats.found} / ${TOTAL_FIGURES}`, cls: "text-ember" },
          { label: "待確認", value: stats.pending, cls: "text-ember" },
          { label: "上傳成功", value: stats.uploaded, cls: "text-[#9fe0aa]" },
          { label: "上傳失敗", value: stats.failed, cls: stats.failed ? "text-[#ffab88]" : "text-cream/60" },
        ].map((x) => (
          <div key={x.label} className="rounded-2xl border border-white/10 bg-[#0f2236] px-4 py-3">
            <p className="text-[13px] text-cream/60">{x.label}</p>
            <p className={`mt-0.5 text-[26px] leading-tight ${x.cls}`}>{loadState === "loading" ? "—" : x.value}</p>
          </div>
        ))}
      </section>

      {/* 8 個小人狀態 */}
      <section className="mt-6" aria-labelledby="fig-status">
        <h2 id="fig-status" className="text-[17px]">
          小人狀態
        </h2>
        <ul className="mt-2.5 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {figures.map((f) => {
            const label = !f.isFound ? "未找到" : f.isVerified ? "已確認" : "待確認";
            return (
              <li key={f.id}>
                <button
                  type="button"
                  disabled={!f.photoUrl}
                  onClick={() => f.photoUrl && view(f.photoUrl, f.number, `${f.foundByName ? `${f.foundByName}・` : ""}${time(f.foundAt)} 點亮`)}
                  aria-label={`#${f.number} ${label}${f.photoUrl ? "，看照片" : ""}`}
                  className={`relative block aspect-[3/4] w-full overflow-hidden rounded-xl border-2 outline-none focus-visible:ring-2 focus-visible:ring-ember ${
                    !f.isFound ? "border-white/10 bg-[#0f2236]" : f.isVerified ? "border-sky" : "border-ember"
                  }`}
                >
                  {f.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 使用者上傳照片
                    <img src={f.photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-[22px] text-cream/25">?</span>
                  )}
                  <span className="absolute left-1 top-1 rounded bg-black/55 px-1.5 text-[12px]">#{f.number}</span>
                  <span
                    className={`absolute inset-x-0 bottom-0 py-0.5 text-center text-[11.5px] ${
                      !f.isFound ? "text-cream/45" : f.isVerified ? "bg-sky/85 text-ink" : "bg-ember/90 text-ink"
                    }`}
                  >
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 上傳紀錄 */}
      <section className="mt-7" aria-labelledby="sub-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="sub-title" className="text-[17px]">
            上傳紀錄 <span className="text-[14px] text-cream/50">（{submissions.length}）</span>
          </h2>
        </div>
        <div className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="篩選">
          {FILTERS.map((f) => {
            const n = submissions.filter(f.match).length;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.key)}
                className={`min-h-10 shrink-0 rounded-full px-3.5 text-[14px] ${
                  active ? "bg-ember text-ink" : "border border-white/15 text-cream/80"
                }`}
              >
                {f.label} {n}
              </button>
            );
          })}
        </div>

        {actionError && (
          <p className="mt-3 rounded-xl bg-[#2a1610] px-3 py-2 text-[14px] text-[#ffcbb5]" role="alert">
            {actionError}
          </p>
        )}

        {loadState === "ready" && visible.length === 0 && (
          <p className="mt-6 rounded-2xl border border-dashed border-white/15 p-6 text-center text-[14px] text-cream/55">
            目前沒有紀錄
          </p>
        )}

        <ul className="mt-3 grid gap-2.5 md:grid-cols-2">
          {visible.map((s) => {
            const reviewLabel = REVIEW_LABEL[s.reviewStatus];
            const canReview = s.uploadStatus === "uploaded" && s.reviewStatus === "active";
            const busy = busyId === s.id;
            const confirming = confirmRejectId === s.id;
            return (
              <li key={s.id} className="flex gap-3 rounded-2xl border border-white/10 bg-[#0f2236] p-3">
                <button
                  type="button"
                  disabled={!s.photoUrl}
                  onClick={() => s.photoUrl && view(s.photoUrl, s.figureNumber, `${s.playerName ?? `玩家 ${s.playerId}`}・${time(s.createdAt)}`)}
                  aria-label={s.photoUrl ? `看 #${s.figureNumber} 的照片` : "沒有照片"}
                  className="relative h-[104px] w-[78px] shrink-0 overflow-hidden rounded-xl bg-[#07182b] outline-none focus-visible:ring-2 focus-visible:ring-ember"
                >
                  {s.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 使用者上傳照片
                    <img src={s.photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full place-items-center px-1 text-center text-[12px] text-cream/40">
                      {s.uploadStatus === "failed" ? "無照片" : "上傳中"}
                    </span>
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[18px] leading-none">#{s.figureNumber}</span>
                    <UploadBadge s={s} />
                    {reviewLabel && (
                      <span className={`rounded-full px-2.5 py-0.5 text-[12.5px] ${reviewLabel.cls}`}>{reviewLabel.text}</span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[13px] text-cream/60">
                    {s.playerName ? <span className="text-cream">{s.playerName}</span> : "（未填名字）"}
                    <span className="text-cream/40">（{s.playerId}）</span>・{time(s.createdAt)}
                    {kb(s.photoBytes) && `・${kb(s.photoBytes)}`}
                  </p>
                  {s.uploadError && <p className="mt-1 text-[13px] text-[#ffab88]">原因：{s.uploadError}</p>}
                  {s.reviewedBy && (
                    <p className="mt-1 text-[12.5px] text-cream/45">
                      {time(s.reviewedAt)} 由 {s.reviewedBy} 審核
                    </p>
                  )}

                  {canReview && !confirming && (
                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => review(s, "approve")}
                        className="min-h-10 rounded-lg bg-forest px-3.5 text-[14px] text-white disabled:opacity-50"
                      >
                        ✓ 確認正確
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmRejectId(s.id)}
                        className="min-h-10 rounded-lg border border-[#e8794a]/60 px-3.5 text-[14px] text-[#ffab88] disabled:opacity-50"
                      >
                        退回
                      </button>
                    </div>
                  )}
                  {canReview && confirming && (
                    <div className="mt-2.5 rounded-xl bg-[#2a1610] p-2.5" role="alertdialog" aria-label="確認退回">
                      <p className="text-[13.5px] text-[#ffcbb5]">
                        退回後 #{s.figureNumber} 會變回「未找到」，所有玩家同步。
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => review(s, "reject")}
                          className="min-h-10 rounded-lg bg-[#d9633a] px-3.5 text-[14px] text-white disabled:opacity-50"
                        >
                          {busy ? "處理中…" : "確定退回"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirmRejectId(null)}
                          className="min-h-10 rounded-lg border border-white/15 px-3.5 text-[14px] text-cream/80"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <PhotoViewer item={viewing} onClose={closeViewer} />
    </div>
  );
}
