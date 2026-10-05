/**
 * 音效（Web Audio 即時合成，不需要額外音檔）+ 共用靜音開關。
 *
 * 手機限制：AudioContext 必須在使用者手勢中 resume，
 * 所以在「開始找小人」按鈕與第一次點畫面時呼叫 unlockSound()。
 */

const MUTE_KEY = "camp-hide-and-seek:music-muted";
const listeners = new Set<() => void>();
let mutedMemory = false;

export function isMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return mutedMemory;
  }
}

export function setMuted(m: boolean) {
  mutedMemory = m;
  try {
    window.localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function subscribeMuted(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/* ---------------- Web Audio ---------------- */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  return ctx;
}

/** 在使用者手勢中呼叫（iOS 需要） */
export function unlockSound() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  // iOS 舊版：播一個無聲 buffer 才算解鎖
  const b = c.createBuffer(1, 1, 22050);
  const src = c.createBufferSource();
  src.buffer = b;
  src.connect(c.destination);
  src.start(0);
}

function ready(): AudioContext | null {
  if (isMuted()) return null;
  const c = getCtx();
  if (!c || !master) return null;
  if (c.state === "suspended") c.resume().catch(() => {});
  return c;
}

interface ToneOpts {
  freq: number;
  to?: number;
  at?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  vibrato?: number;
}

function tone(c: AudioContext, { freq, to, at = 0, dur, type = "triangle", gain = 0.35, attack = 0.008, vibrato }: ToneOpts) {
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  if (vibrato) {
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 6;
    lg.gain.value = vibrato;
    lfo.connect(lg).connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.05);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master!);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** 木頭敲擊聲 */
function knock(c: AudioContext, at = 0, freq = 1800, gain = 0.5) {
  const t0 = c.currentTime + at;
  const len = Math.floor(c.sampleRate * 0.04);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = 6;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(bp).connect(g).connect(master!);
  src.start(t0);
}

const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, G4 = 392, E4 = 329.63, C4 = 261.63, G3 = 196;

export const sfx = {
  /** 3、2、1 */
  count() {
    const c = ready();
    if (!c) return;
    knock(c, 0, 1400, 0.6);
    tone(c, { freq: 880, dur: 0.18, type: "square", gain: 0.12 });
    tone(c, { freq: 880, dur: 0.22, gain: 0.25 });
  },
  /** GO！開始音效：上升琶音 + 哨音 */
  go() {
    const c = ready();
    if (!c) return;
    [C5, E5, G5, C6].forEach((f, i) => tone(c, { freq: f, at: i * 0.07, dur: 0.5, type: "sawtooth", gain: 0.09 }));
    [C5, E5, G5, C6].forEach((f, i) => tone(c, { freq: f, at: i * 0.07, dur: 0.6, gain: 0.22 }));
    tone(c, { freq: 1500, to: 2600, at: 0.28, dur: 0.35, type: "sine", gain: 0.12, vibrato: 40 });
    tone(c, { freq: C6, at: 0.3, dur: 0.9, gain: 0.18, vibrato: 8 });
  },
  /** 每秒滴答（最後 10 秒） */
  tick(sec: number) {
    const c = ready();
    if (!c) return;
    const hi = sec <= 3;
    knock(c, 0, hi ? 2400 : 1700, hi ? 0.7 : 0.45);
    tone(c, { freq: hi ? 1320 : 990, dur: hi ? 0.14 : 0.08, type: "sine", gain: hi ? 0.28 : 0.16 });
  },
  /** 時間到：下降三音 + 長和弦 */
  timeUp() {
    const c = ready();
    if (!c) return;
    tone(c, { freq: 220, dur: 0.55, type: "sawtooth", gain: 0.1 });
    tone(c, { freq: 233, dur: 0.55, type: "sawtooth", gain: 0.08 });
    [G4, E4, C4].forEach((f, i) => tone(c, { freq: f, at: 0.6 + i * 0.22, dur: 0.3, gain: 0.3 }));
    tone(c, { freq: C4, at: 1.3, dur: 1.4, gain: 0.25, vibrato: 4 });
    tone(c, { freq: G3, at: 1.3, dur: 1.4, gain: 0.2, vibrato: 3 });
    tone(c, { freq: E4, at: 1.3, dur: 1.4, gain: 0.12 });
  },
  /** 加時間：叮叮 */
  bonus() {
    const c = ready();
    if (!c) return;
    tone(c, { freq: E5, dur: 0.25, gain: 0.25 });
    tone(c, { freq: C6, at: 0.12, dur: 0.45, gain: 0.25 });
  },
  /** 暫停 */
  pause() {
    const c = ready();
    if (!c) return;
    tone(c, { freq: G5, dur: 0.2, gain: 0.2 });
    tone(c, { freq: C5, at: 0.14, dur: 0.35, gain: 0.2 });
  },
};
