/**
 * 匿名玩家代號（不需要登入）。存在 localStorage，讓後台知道是哪支手機上傳的。
 * 例如「玩家 7F3K」。
 */
const KEY = "camp-hide-and-seek:player-id";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

let memoryId: string | null = null;

function randomId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function getPlayerId(): string {
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing) return existing;
    const id = randomId();
    window.localStorage.setItem(KEY, id);
    return id;
  } catch {
    memoryId ??= randomId();
    return memoryId;
  }
}
