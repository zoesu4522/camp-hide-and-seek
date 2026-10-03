# Camp Hide & Seek / 露營躲貓貓

露營團康活動用的手機優先單頁 Web App：26 位玩家掃同一個 QR Code，一起在營區找 8 個藏起來的小人，找到後在網站點亮，所有人即時看到共同進度，8 / 8 時播放完成動畫。

技術：Next.js 16（App Router）· TypeScript · Tailwind CSS v4 · Framer Motion · canvas-confetti ·（Phase 3 起）Supabase + Realtime

## 目前進度

| Phase | 內容 | 狀態 |
| --- | --- | --- |
| 1 | Next.js 專案 + 手機版靜態 UI | ✅ |
| 2 | 所有動畫（Opening / 翻牌 / 通知 / 完成 / 背景微動畫）| ✅ |
| 2.5 | 拍照上傳點亮（必填）、照片檢視、後台 /admin（Email 登入、上傳紀錄、確認 / 退回）| ✅ mock |
| 3–4 | Supabase schema、Storage、RLS、RPC（`supabase/schema.sql`，本機 36 項 SQL 測試通過）| ✅ |
| 5–6 | 前端串 Supabase（RPC + Storage + Realtime + 斷線補資料），設定環境變數即切換 | ✅ 已在正式環境驗證 |
| 7–9 | Completion 串真實資料、錯誤處理、回歸測試 | ⏳ |

**資料來源自動切換**（`src/lib/services.ts`）：
- 有設定 `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Supabase
- 沒設定 → mock（localStorage 模擬伺服器，同一瀏覽器多分頁互相同步，方便開發 / demo）

## 本機啟動

```bash
npm install
npm run dev          # http://localhost:3000
npm run lint
npx tsc --noEmit
npm run build
```

## 拍照點亮與後台

- 玩家點未找到的小人 → **拍照（必填）** → 手機端壓縮（最長邊 1280px JPEG）→ 上傳 → 點亮並同步給所有人
- 已找到的小人卡片會顯示照片，點一下可放大，看得到「待確認 / 管理員已確認」
- 後台 `/admin`：Email magic link 登入（Supabase Auth），可看每一筆上傳是否成功（成功 / 失敗 + 原因 / 上傳中）、
  8 個小人目前狀態，對照片按「確認正確」或「退回」。退回後該小人變回未找到，所有玩家即時同步
- 規則：上傳即點亮，後台可退回；兩人同時上傳同一隻，後到的紀錄為「重複」

## 目前部署

- 正式網址：https://camp-hide-and-seek.vercel.app （後台 /admin）
- Vercel 專案：camp-hide-and-seek（環境變數已設定 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`）
- Supabase 專案：camp-hide-and-seek（ap-northeast-1 東京，ref `lztuhwkpcpihvqibahze`），schema 已套用
- 目前未連 GitHub：之後可在 Vercel 專案 Settings → Git 連結 repo，就會每次 push 自動部署

## Supabase 設定

### 1. 建立專案、執行 SQL

1. [supabase.com](https://supabase.com) 建立專案（Region 建議 Tokyo / Singapore）
2. 打開 `supabase/schema.sql`，把最下面的 `your-admin@example.com` 換成管理員 Email（小寫，可多筆）
3. Dashboard → **SQL Editor** → New query → 貼上整份 → **Run**（可以重複執行，不會清資料）

會建立：`games` / `figures` / `submissions` / `admin_users`、Storage bucket `figure-photos`、RLS、RPC、Realtime publication、seed（`camp-hide-and-seek` + 8 個小人）。

之後要新增管理員：

```sql
insert into public.admin_users (email) values ('someone@example.com');
```

### 2. Auth（後台 Email 登入）

Dashboard → **Authentication → URL Configuration**

- Site URL：`https://你的網域`（例如 `https://camp-hide-and-seek.vercel.app`）
- Redirect URLs 加上：`https://你的網域/admin`、本機開發 `http://localhost:3000/admin`

Email provider 預設開啟即可。Supabase 內建寄信每小時有數量限制，管理員很多或常重寄時，到 Authentication → SMTP 設定自己的寄信服務。

### 3. 環境變數

Dashboard → **Project Settings → API**，複製到 `.env.local`（本機）或 Vercel：

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

anon key 本來就是公開的，安全性由 RLS + RPC 保護；**不要**把 service_role key 放進前端。

### 資料表與權限摘要

| 對象 | 玩家（anon） | 管理員（白名單登入） |
| --- | --- | --- |
| games / figures | 讀 | 讀 |
| submissions | 看不到 | 讀 |
| 所有表的直接 insert / update / delete | ❌ | ❌（都走 RPC） |
| Storage `figure-photos` | 公開讀；只能上傳到「自己 10 分鐘內建立、尚在上傳中」的投稿路徑 | 同左 |

| RPC | 誰能呼叫 | 作用 |
| --- | --- | --- |
| `create_submission(slug, number, player_id, bytes)` | anon | 建立投稿、回傳上傳路徑；同一玩家 1 分鐘最多 10 筆 |
| `mark_submission_failed(id, error)` | anon | 照片上傳失敗，記錄原因 |
| `submit_figure_found(id)` | anon | 確認照片已在 Storage → 只更新 `is_found = false` 的小人（併發安全、可重送）；回傳 success / already_found |
| `is_admin_email(email)` / `is_admin()` | anon / authenticated | 登入前白名單檢查 / 登入後權限檢查 |
| `review_submission(id, approve\|reject)` | 管理員 | 確認正確（`is_verified`）或退回（小人變回未找到）；記錄審核人 |

> 原 spec 的 `mark_figure_found(game_slug, figure_number)` 因為「照片必填」改成上面三步驟，避免沒照片也能點亮。

### 重置遊戲

網站上不提供 Reset。SQL Editor 執行 `supabase/reset.sql`，照片檔到 Storage → `figure-photos` 手動清空。

### 本機 SQL 測試（選用）

用一般 PostgreSQL 模擬 Supabase 的 roles / auth / storage 跑 36 項測試（權限、RLS、Storage policy、併發、8/8、退回、reset）：

```bash
pip install "psycopg[binary]"
PG_DSN="host=localhost port=5432 user=postgres" python supabase/tests/test_schema.py
```

## Vercel 部署

1. 把專案推到 GitHub
2. [vercel.com](https://vercel.com) → Add New Project → Import 該 repo（Framework 自動偵測 Next.js）
3. Environment Variables 填 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` → Deploy
4. 部署完成後，把網址填回 Supabase 的 Site URL / Redirect URLs（見上面）
5. 用 `https://你的網域/` 產生 QR Code；後台是 `https://你的網域/admin`

活動前建議：兩支手機 + 一台電腦實際走一次「拍照點亮 → 另一支同步 → 後台退回 → 同步變回」，再跑 `reset.sql` 清空。

## 測試用網址參數（只在 mock 模式有效）

- `/?demo`：顯示開發測試面板（模擬其他玩家找到、設成 7/8、重置成 3/8）
- `/?mockError`：模擬連線失敗，檢查錯誤畫面
- `/?mockUploadFail`：模擬照片上傳失敗（後台會出現失敗紀錄）
- `/admin`：mock 登入輸入任意 Email →「模擬點擊信中連結」
- 想重看 Opening：關掉分頁重開，或清除 sessionStorage 的 `camp-hide-and-seek:intro-seen`

## 專案結構

```
src/
  app/
    layout.tsx            # metadata、viewport、字型（Huninn 粉圓體，self-host）
    page.tsx              # 背景（server）+ CampGameApp（client）+ 前景樹葉
    manifest.ts           # PWA manifest
    globals.css           # 色票、木紋 / 紙卡樣式、背景 keyframes、reduced motion
  components/
    CampBackground.tsx    # 分層夜景（天空/星星/山/樹林/帳篷/串燈/營火光）+ ForegroundLeaves
    OpeningAnimation.tsx  # 開場 6 個 scene，可跳過，sessionStorage 只播一次
    HeroSection.tsx       # 標題、木牌、說明、探頭小人
    HowToPlay.tsx         # 4 張玩法卡片（橫向 swipe + 可收合）
    ProgressBoard.tsx     # 目前進度 x / 8 + 進度條
    FigureGrid.tsx        # 8 個小人 slot（4 × 2）
    FigureCard.tsx        # 單一 slot：翻牌動畫、FOUND、sparkles
    ConfirmFoundModal.tsx # Bottom sheet 確認（focus trap、Esc、防連點）
    FoundToast.tsx        # 「找到 #4！」半屏通知（1.4 秒自動退場）
    MessageToast.tsx      # 已被找到 / 點亮失敗提示
    CompletionOverlay.tsx # 8 / 8 結局
    SafetyNotice.tsx      # 安全提醒
    LoadingCamp.tsx       # 小人在帳篷後探頭「正在準備營地...」
    ConnectionError.tsx   # 連線失敗 + 重新連線
    ServiceWorkerRegister.tsx
    illustrations/        # CampFigure（SVG 小人 10 種姿勢）、Logo、WoodSign
    dev/MockDemoPanel.tsx # ?demo 測試面板
  hooks/useCampGame.ts    # 遊戲狀態、markFound、Realtime 事件去重
  lib/assets.ts           # 正式圖片素材路徑（ready 旗標切換 placeholder / next/image）
  lib/mock/               # mock GameService
  lib/supabase/           # client、row 對應、supabaseGameService、supabaseAdminService
  lib/services.ts         # 依環境變數切換 mock / Supabase
  motion/variants.ts      # fadeUp / fadeIn / pop / staggerContainer / cardReveal
  types/game.ts
public/
  camp/                   # 正式素材放這裡（目前空）
  icons/                  # PWA icons（placeholder）
  sw.js                   # 靜態素材 cache-first，不攔截 Supabase
supabase/
  schema.sql              # 貼到 SQL Editor 執行
  reset.sql               # 重置遊戲（僅管理者）
  tests/                  # 本機 SQL 測試（Supabase stub + 36 項測試）
```

## 替換正式素材

把 WebP 放進 `public/camp/`，再到 `src/lib/assets.ts` 把對應項目的 `ready` 改成 `true`：

`background-night.webp`、`tree-left.webp`、`tree-right.webp`、`tent.webp`、`campfire.webp`、
`logo.webp`、`wood-board.webp`、`person-hidden.webp`、`person-found.webp`
