/**
 * Mock「資料庫」：以 localStorage 模擬 Supabase（games / figures / submissions + Storage）。
 * 同一個瀏覽器的多個分頁透過 storage event 互相同步，模擬 Realtime。
 * 只用於 Phase 3 之前的本機開發 / demo。
 */
import { IDLE_TIMER, TOTAL_FIGURES, type Figure, type Game, type Submission } from "@/types/game";

export const DB_KEY = "camp-hide-and-seek:mock-db:v4";
const DEMO_FOUND = [1, 3, 6];

export interface MockDb {
  game: Game;
  figures: Figure[];
  submissions: Submission[];
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** demo 用的示意照片（SVG），讓預設已找到的小人也有照片可看 */
export function demoPhoto(n: number): string {
  const hue = [120, 95, 140, 80, 150, 110, 130, 100][(n - 1) % 8];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='640' viewBox='0 0 480 640'>
<defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='hsl(${hue},30%,32%)'/><stop offset='1' stop-color='hsl(${hue},35%,18%)'/></linearGradient></defs>
<rect width='480' height='640' fill='url(#g)'/>
<ellipse cx='120' cy='520' rx='160' ry='60' fill='hsl(${hue},40%,24%)'/><ellipse cx='380' cy='560' rx='180' ry='70' fill='hsl(${hue},40%,22%)'/>
<ellipse cx='240' cy='470' rx='70' ry='12' fill='#000' opacity='.3'/>
<g stroke='#f6f2ea' stroke-linecap='round' fill='none'><path d='M240 330 L240 400' stroke-width='64'/><path d='M212 330 L196 410' stroke-width='28'/><path d='M268 330 L284 410' stroke-width='28'/><path d='M226 410 L224 466' stroke-width='30'/><path d='M254 410 L256 466' stroke-width='30'/></g>
<circle cx='240' cy='280' r='34' fill='#fbf8f2'/>
<text x='24' y='48' font-size='26' fill='#fff' opacity='.75' font-family='sans-serif'>示意照片 #${n}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function seedDb(foundNumbers: number[] = DEMO_FOUND): MockDb {
  const gameId = "mock-game-0001";
  const now = new Date().toISOString();
  const submissions: Submission[] = [];
  const figures: Figure[] = Array.from({ length: TOTAL_FIGURES }, (_, i) => {
    const number = i + 1;
    const isFound = foundNumbers.includes(number);
    let submissionId: string | null = null;
    if (isFound) {
      submissionId = `seed-sub-${number}`;
      submissions.push({
        id: submissionId,
        gameId,
        figureNumber: number,
        playerId: "DEMO",
        playerName: ["小明", "阿凱", "Sumo"][number % 3],
        photoUrl: demoPhoto(number),
        photoBytes: null,
        uploadStatus: "uploaded",
        uploadError: null,
        reviewStatus: "active",
        createdAt: now,
        reviewedAt: null,
        reviewedBy: null,
      });
    }
    return {
      id: `mock-figure-${number}`,
      gameId,
      number,
      isFound,
      foundAt: isFound ? now : null,
      photoUrl: isFound ? demoPhoto(number) : null,
      submissionId,
      foundByName: isFound ? ["小明", "阿凱", "Sumo"][number % 3] : null,
      isVerified: false,
    };
  });
  return {
    game: { id: gameId, slug: "camp-hide-and-seek", title: "躲貓貓小人", isCompleted: false, timer: IDLE_TIMER },
    figures,
    submissions,
  };
}

let memoryDb: MockDb | null = null;

export function readDb(): MockDb {
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw) as MockDb;
  } catch {
    /* fall through */
  }
  const db = memoryDb ?? seedDb();
  writeDb(db, { silent: true });
  return db;
}

type ChangeListener = (prev: MockDb | null, next: MockDb) => void;
const listeners = new Set<ChangeListener>();

/** 寫入資料庫；超過 localStorage 容量時丟出錯誤（模擬上傳失敗） */
export function writeDb(next: MockDb, opts: { silent?: boolean; echoDelay?: number } = {}) {
  const prev = memoryDb;
  window.localStorage.setItem(DB_KEY, JSON.stringify(next));
  memoryDb = next;
  if (!opts.silent) {
    const fire = () => listeners.forEach((l) => l(prev, next));
    if (opts.echoDelay) setTimeout(fire, opts.echoDelay);
    else fire();
  }
}

/** 訂閱資料變更：同分頁（listeners）+ 其他分頁（storage event） */
export function onDbChange(listener: ChangeListener): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== DB_KEY || !e.newValue) return;
    const prev = e.oldValue ? (JSON.parse(e.oldValue) as MockDb) : null;
    const next = JSON.parse(e.newValue) as MockDb;
    memoryDb = next;
    listener(prev, next);
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function hasQueryFlag(flag: string): boolean {
  try {
    return new URLSearchParams(window.location.search).has(flag);
  } catch {
    return false;
  }
}

export function recount(db: MockDb): MockDb {
  const found = db.figures.filter((f) => f.isFound).length;
  const isCompleted = found === TOTAL_FIGURES;
  let timer = db.game.timer ?? IDLE_TIMER;
  // 倒數中 8/8 → 提前完成（同 submit_figure_found）
  if (isCompleted && !db.game.isCompleted) {
    const now = Date.now();
    const end = timer.endsAt ? new Date(timer.endsAt).getTime() : 0;
    const start = timer.startedAt ? new Date(timer.startedAt).getTime() : 0;
    if (timer.status === "paused" || (timer.status === "running" && end > now)) {
      timer = {
        ...timer,
        status: "ended",
        endReason: "completed",
        endedAt: new Date(now).toISOString(),
        remainingMs: timer.status === "paused" ? timer.remainingMs : Math.max(0, end - Math.max(now, start)),
        version: timer.version + 1,
      };
    }
  }
  return { ...db, game: { ...db.game, isCompleted, timer } };
}
