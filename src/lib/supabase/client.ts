import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
