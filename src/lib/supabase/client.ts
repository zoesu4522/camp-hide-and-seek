import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// 支援兩種命名：舊版 anon key，或 Supabase 新版 publishable key（Vercel 整合可能注入其中之一）
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** 有設定環境變數就使用 Supabase，否則使用 mock（本機開發 / demo） */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const PHOTO_BUCKET = "figure-photos";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) throw new Error("Supabase 環境變數未設定");
  client ??= createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // magic link 回到 /admin 時自動取得 session
    },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return client;
}

export function photoPublicUrl(path: string | null): string | null {
  if (!path) return null;
  return getSupabase().storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** 量 3 次取來回最快的那次：offset = 伺服器時間 − 本機時間 */
export async function measureClockOffset(): Promise<number> {
  const sb = getSupabase();
  let best: { rtt: number; offset: number } | null = null;
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    const { data, error } = await sb.rpc("server_now");
    const t1 = Date.now();
    if (error || !data) continue;
    const server = new Date(data as string).getTime();
    const sample = { rtt: t1 - t0, offset: server - (t0 + t1) / 2 };
    if (!best || sample.rtt < best.rtt) best = sample;
  }
  return best?.offset ?? 0;
}
