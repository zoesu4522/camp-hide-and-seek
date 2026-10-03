/** 玩家暱稱：第一次進入時輸入，存在 localStorage，之後自動帶入。 */
const KEY = "camp-hide-and-seek:player-name";
export const NAME_MAX = 12;

const listeners = new Set<() => void>();
let memoryName: string | null = null;

export function normalizeName(raw: string): string {
  // 去除控制字元與前後空白，限制長度
  return Array.from(raw.replace(/[\u0000-\u001f\u007f]/g, "").trim()).slice(0, NAME_MAX).join("");
}

export function readPlayerName(): string | null {
  try {
    return window.localStorage.getItem(KEY) || null;
  } catch {
    return memoryName;
  }
}

export function savePlayerName(name: string) {
  const v = normalizeName(name);
  memoryName = v;
  try {
    window.localStorage.setItem(KEY, v);
  } catch {
    /* 無痕模式等：只存在記憶體 */
  }
  listeners.forEach((l) => l());
}

/** for useSyncExternalStore */
export function subscribePlayerName(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
