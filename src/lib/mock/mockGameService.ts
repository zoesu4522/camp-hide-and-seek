/**
 * Mock 版 GameService（Phase 3 之前使用）。
 *
 * submitFind 模擬正式流程：
 *   1. 建立 submission（upload_status = uploading）
 *   2. 上傳照片到 Storage（這裡存成壓縮後的 data URL）
 *      失敗 → upload_status = failed（後台看得到失敗紀錄）
 *   3. 上傳成功 → 呼叫 RPC：只有 is_found = false 才點亮（idempotent）
 *      已被別人點亮 → review_status = duplicate，回傳 already_found
 *   4. Realtime 把 figures UPDATE 推給所有分頁（包含自己，用來測試去重）
 *
 * 測試參數：?mockError（載入失敗）、?mockUploadFail（照片上傳失敗）
 */
import { blobToDataUrl } from "@/lib/image/compressImage";
import type { Figure, GameService, MarkFoundResult, Submission } from "@/types/game";
import {
  demoPhoto,
  hasQueryFlag,
  onDbChange,
  readDb,
  recount,
  seedDb,
  uid,
  wait,
  writeDb,
  type MockDb,
} from "./mockDb";

const LATENCY_MS = 350;
const REALTIME_ECHO_MS = 160;

function patchSubmission(id: string, patch: Partial<Submission>) {
  const db = readDb();
  writeDb({ ...db, submissions: db.submissions.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
}

export const mockGameService: GameService = {
  async fetchGame() {
    await wait(LATENCY_MS + 350);
    if (hasQueryFlag("mockError")) throw new Error("mock connection error");
    const db = readDb();
    return { game: db.game, figures: db.figures };
  },

  async submitFind(_slug, { figureNumber, photo, playerId, onProgress }): Promise<MarkFoundResult> {
    const start = readDb();
    const target = start.figures.find((f) => f.number === figureNumber);
    if (!target) return { status: "error", error: "unknown" };

    // 1. 建立投稿紀錄
    const submission: Submission = {
      id: uid("sub"),
      gameId: start.game.id,
      figureNumber,
      playerId,
      photoUrl: null,
      photoBytes: photo.size,
      uploadStatus: "uploading",
      uploadError: null,
      reviewStatus: "none",
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null,
    };
    try {
      writeDb({ ...start, submissions: [submission, ...start.submissions] });
    } catch {
      return { status: "error", error: "upload_failed" };
    }

    // 2. 上傳照片（模擬進度）
    let photoUrl: string;
    try {
      for (const r of [0.15, 0.4, 0.65, 0.85]) {
        onProgress?.(r);
        await wait(LATENCY_MS / 2);
      }
      if (hasQueryFlag("mockUploadFail")) throw new Error("模擬：網路中斷，照片沒有傳完");
      photoUrl = await blobToDataUrl(photo);
      patchSubmission(submission.id, { photoUrl, uploadStatus: "uploaded" });
      onProgress?.(1);
    } catch (e) {
      const message =
        e instanceof DOMException && e.name === "QuotaExceededError"
          ? "儲存空間已滿（mock localStorage）"
          : e instanceof Error
            ? e.message
            : "上傳失敗";
      try {
        patchSubmission(submission.id, { uploadStatus: "failed", uploadError: message });
      } catch {
        /* ignore */
      }
      return { status: "error", error: "upload_failed" };
    }

    // 3. RPC：只有 is_found = false 才點亮
    await wait(120);
    const db = readDb();
    const current = db.figures.find((f) => f.number === figureNumber)!;
    if (current.isFound) {
      writeDb({
        ...db,
        submissions: db.submissions.map((s) => (s.id === submission.id ? { ...s, reviewStatus: "duplicate" } : s)),
      });
      return {
        status: "already_found",
        figure: current,
        foundCount: db.figures.filter((f) => f.isFound).length,
      };
    }

    const updated: Figure = {
      ...current,
      isFound: true,
      foundAt: new Date().toISOString(),
      photoUrl,
      submissionId: submission.id,
      isVerified: false,
    };
    const next: MockDb = recount({
      ...db,
      figures: db.figures.map((f) => (f.number === figureNumber ? updated : f)),
      submissions: db.submissions.map((s) => (s.id === submission.id ? { ...s, reviewStatus: "active" } : s)),
    });
    // 4. Realtime 回音給自己（延遲一點，模擬網路）
    writeDb(next, { echoDelay: REALTIME_ECHO_MS });
    return { status: "success", figure: updated, foundCount: next.figures.filter((f) => f.isFound).length };
  },

  subscribe(_gameId, onFigureUpdate) {
    return onDbChange((prev, next) => {
      next.figures.forEach((f) => {
        const before = prev?.figures.find((p) => p.number === f.number);
        if (!before || before.isFound !== f.isFound || before.isVerified !== f.isVerified || before.photoUrl !== f.photoUrl) {
          onFigureUpdate(f);
        }
      });
    });
  },
};

/* ---------- 只給 ?demo 測試面板使用 ---------- */

/** 模擬「另一位玩家」上傳照片並找到一個隨機小人 */
export function mockSimulateRemoteFind(): number | null {
  const db = readDb();
  const remaining = db.figures.filter((f) => !f.isFound);
  if (remaining.length === 0) return null;
  const pick = remaining[Math.floor(Math.random() * remaining.length)];
  const photoUrl = demoPhoto(pick.number);
  const sub: Submission = {
    id: uid("sub"),
    gameId: db.game.id,
    figureNumber: pick.number,
    playerId: "SIM" + Math.floor(Math.random() * 9),
    photoUrl,
    photoBytes: null,
    uploadStatus: "uploaded",
    uploadError: null,
    reviewStatus: "active",
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
  };
  writeDb(
    recount({
      ...db,
      figures: db.figures.map((f) =>
        f.number === pick.number
          ? { ...f, isFound: true, foundAt: sub.createdAt, photoUrl, submissionId: sub.id, isVerified: false }
          : f,
      ),
      submissions: [sub, ...db.submissions],
    }),
  );
  return pick.number;
}

/** 重置 mock 資料（正式版沒有給玩家的 reset） */
export function mockReset(foundNumbers?: number[]) {
  writeDb(seedDb(foundNumbers));
}
