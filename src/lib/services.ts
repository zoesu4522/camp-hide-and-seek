/**
 * 依環境變數選擇資料來源：
 * - 有 NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY → Supabase
 * - 沒有 → mock（localStorage，本機開發 / demo）
 */
import { isSupabaseConfigured } from "./supabase/client";
import { supabaseGameService } from "./supabase/supabaseGameService";
import { supabaseAdminService } from "./supabase/supabaseAdminService";
import { mockGameService } from "./mock/mockGameService";
import { mockAdminService } from "./mock/mockAdminService";

export const IS_MOCK = !isSupabaseConfigured;
export const gameService = IS_MOCK ? mockGameService : supabaseGameService;
export const adminService = IS_MOCK ? mockAdminService : supabaseAdminService;
