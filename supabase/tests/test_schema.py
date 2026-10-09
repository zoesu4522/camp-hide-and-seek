"""
本機測試 supabase/schema.sql（在一般 PostgreSQL + supabase_stubs.sql 上）。

用法：
  pip install "psycopg[binary]"
  PG_DSN="host=/var/tmp port=54329 user=postgres" python supabase/tests/test_schema.py

會建立一個暫時資料庫 camp_test，測完刪除。
"""
import json
import os
import pathlib
import threading
import time

import psycopg

ROOT = pathlib.Path(__file__).resolve().parents[1]
DSN = os.environ.get("PG_DSN", "host=/var/tmp port=54329 user=postgres")
DB = "camp_test"
ADMIN = "host@example.com"

results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = ""):
    results.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))


def connect():
    return psycopg.connect(f"{DSN} dbname={DB}", autocommit=True)


def as_role(cur, role: str, email: str | None = None):
    cur.execute("reset role")
    claims = {"role": role}
    if email:
        claims.update({"email": email, "sub": "00000000-0000-0000-0000-000000000001"})
    cur.execute("select set_config('request.jwt.claims', %s, false)", (json.dumps(claims),))
    cur.execute(f"set role {role}")


def expect_error(cur, sql, params=None, contains=""):
    try:
        cur.execute(sql, params)
        return False, "no error"
    except psycopg.Error as e:
        msg = str(e).strip().splitlines()[0]
        return (contains in msg), msg


def rpc(cur, fn, *args):
    placeholders = ", ".join(["%s"] * len(args))
    cur.execute(f"select public.{fn}({placeholders})", args)
    row = cur.fetchone()
    return row[0] if row else None


def upload(cur, path):
    cur.execute("insert into storage.objects (bucket_id, name) values ('figure-photos', %s)", (path,))


def main():
    with psycopg.connect(f"{DSN} dbname=postgres", autocommit=True) as c:
        c.execute(f"drop database if exists {DB}")
        c.execute(f"create database {DB}")

    schema = (ROOT / "schema.sql").read_text().replace("your-admin@example.com", ADMIN)
    with connect() as c:
        c.execute((ROOT / "tests" / "supabase_stubs.sql").read_text())
        c.execute(schema)
        c.execute(schema)  # idempotent
        check("schema 可重複執行", True)
        cur0 = c.execute("select count(*) from public.figures")
        check("seed 8 個小人", cur0.fetchone()[0] == 8)
        cur0 = c.execute("select count(*) from pg_publication_tables where pubname='supabase_realtime'")
        check("realtime publication 含 games + figures + submissions", cur0.fetchone()[0] == 3)

        cur = c.cursor()

        # ---------- anon 權限 ----------
        as_role(cur, "anon")
        cur.execute("select count(*) from public.figures")
        check("anon 可讀 figures", cur.fetchone()[0] == 8)
        ok, msg = expect_error(cur, "update public.figures set is_found = true", contains="permission denied")
        check("anon 不能直接 update figures", ok, msg)
        ok, msg = expect_error(cur, "insert into public.submissions (game_id) values (gen_random_uuid())", contains="permission denied")
        check("anon 不能直接 insert submissions", ok, msg)

        # ---------- 正常流程 ----------
        sub = rpc(cur, "start_submission", "camp-hide-and-seek", 2, "P1AB", "小明", 120000)
        path = sub["photo_path"]
        check("create_submission 回傳路徑", path.startswith("games/camp-hide-and-seek/2/") and path.endswith(".jpg"), path)
        cur.execute("select count(*) from public.submissions")
        check("anon 看不到投稿紀錄（RLS）", cur.fetchone()[0] == 0)

        ok, msg = expect_error(cur, "select public.submit_figure_found(%s)", (sub["submission_id"],), "photo_not_uploaded")
        check("照片還沒上傳不能點亮", ok, msg)

        ok, msg = expect_error(
            cur, "insert into storage.objects (bucket_id, name) values ('figure-photos', 'games/x/evil.jpg')",
            contains="row-level security")
        check("Storage 不能上傳到任意路徑", ok, msg)
        upload(cur, path)
        check("Storage 可上傳到自己的投稿路徑", True)

        res = rpc(cur, "submit_figure_found", sub["submission_id"])
        check("submit_figure_found 成功點亮", res["status"] == "success" and res["found_count"] == 1, json.dumps(res)[:120])
        check("點亮記錄玩家名稱", res["figure"]["found_by_name"] == "小明")
        res2 = rpc(cur, "submit_figure_found", sub["submission_id"])
        check("重送同一筆是 idempotent", res2["status"] == "success" and res2["found_count"] == 1)

        ok, msg = expect_error(
            cur, "insert into storage.objects (bucket_id, name) values ('figure-photos', %s)", (path + "x",),
            contains="row-level security")
        check("已完成的投稿不能再上傳其他檔", ok, msg)

        # 第二位玩家找同一隻 → duplicate
        sub_b = rpc(cur, "start_submission", "camp-hide-and-seek", 2, "P2CD", None, 100000)
        check("建立時告知已被找到", sub_b["already_found"] is True)
        upload(cur, sub_b["photo_path"])
        res = rpc(cur, "submit_figure_found", sub_b["submission_id"])
        check("同一隻第二人 → already_found", res["status"] == "already_found" and res["found_count"] == 1)

        # 上傳失敗
        sub_f = rpc(cur, "start_submission", "camp-hide-and-seek", 4, "P3EF", None, 90000)
        rpc(cur, "mark_submission_failed", sub_f["submission_id"], "network lost")
        ok, msg = expect_error(cur, "select public.submit_figure_found(%s)", (sub_f["submission_id"],), "submission_not_uploading")
        check("失敗的投稿不能點亮", ok, msg)

        ok, msg = expect_error(cur, "select public.start_submission('camp-hide-and-seek', 3, 'bad id!', null, null)", contains="invalid_player_id")
        check("player_id 格式檢查", ok, msg)
        ok, msg = expect_error(cur, "select public.start_submission('camp-hide-and-seek', 9, 'P1AB', null, null)", contains="figure_not_found")
        check("不存在的小人編號", ok, msg)

        # ---------- 後台權限 ----------
        ok, msg = expect_error(cur, "select public.review_submission(%s, 'approve')", (sub["submission_id"],), "permission denied")
        check("anon 不能呼叫 review_submission", ok, msg)

        as_role(cur, "authenticated", "stranger@example.com")
        ok, msg = expect_error(cur, "select public.review_submission(%s, 'approve')", (sub["submission_id"],), "not_admin")
        check("非管理員登入不能審核", ok, msg)
        cur.execute("select count(*) from public.submissions")
        check("非管理員看不到投稿紀錄", cur.fetchone()[0] == 0)

        as_role(cur, "anon")
        check("is_admin_email 白名單", rpc(cur, "is_admin_email", " Host@Example.com ") is True
              and rpc(cur, "is_admin_email", "x@y.z") is False)

        as_role(cur, "authenticated", ADMIN)
        check("管理員 is_admin()", rpc(cur, "is_admin") is True)
        cur.execute("select upload_status, review_status from public.submissions order by created_at")
        rows = cur.fetchall()
        check("管理員看得到全部投稿", len(rows) == 3, str(rows))

        res = rpc(cur, "review_submission", sub_b["submission_id"], "reject")
        check("duplicate 不能審核", res["ok"] is False)
        res = rpc(cur, "review_submission", sub["submission_id"], "approve")
        cur.execute("select is_verified from public.figures where number = 2")
        check("確認正確 → is_verified", res["ok"] and cur.fetchone()[0] is True)
        res = rpc(cur, "review_submission", sub["submission_id"], "reject")
        check("已審核的不能再改", res["ok"] is False)

        # 退回流程：#5
        as_role(cur, "anon")
        s5 = rpc(cur, "start_submission", "camp-hide-and-seek", 5, "P1AB", None, 1)
        upload(cur, s5["photo_path"])
        rpc(cur, "submit_figure_found", s5["submission_id"])
        as_role(cur, "authenticated", ADMIN)
        rpc(cur, "review_submission", s5["submission_id"], "reject")
        cur.execute("select is_found, photo_path, submission_id from public.figures where number = 5")
        f5 = cur.fetchone()
        check("退回 → 小人變回未找到", f5 == (False, None, None), str(f5))
        cur.execute("select reviewed_by from public.submissions where id = %s", (s5["submission_id"],))
        check("記錄審核人", cur.fetchone()[0] == ADMIN)

        # 8/8 完成 → is_completed，退回一隻 → false
        as_role(cur, "anon")
        last = None
        for n in [1, 3, 4, 5, 6, 7, 8]:
            s = rpc(cur, "start_submission", "camp-hide-and-seek", n, f"PL{n}", None, 1)
            upload(cur, s["photo_path"])
            last = (s, rpc(cur, "submit_figure_found", s["submission_id"]))
        cur.execute("select is_completed from public.games")
        check("8/8 → games.is_completed = true", last[1]["found_count"] == 8 and cur.fetchone()[0] is True)
        as_role(cur, "authenticated", ADMIN)
        rpc(cur, "review_submission", last[0]["submission_id"], "reject")
        cur.execute("select is_completed from public.games")
        check("退回後 is_completed = false", cur.fetchone()[0] is False)

        # rate limit
        as_role(cur, "anon")
        hit = False
        for i in range(12):
            try:
                rpc(cur, "start_submission", "camp-hide-and-seek", 8, "SPAM", None, 1)
            except psycopg.Error as e:
                hit = "rate_limited" in str(e)
                break
        check("同一玩家 1 分鐘超過 10 筆會被擋", hit)

        cur.execute("reset role")
        cur.execute("update public.figures set is_found=false, found_at=null, photo_path=null, submission_id=null, is_verified=false where number = 8")

    # ---------- 併發：兩人同時點亮 #8 ----------
    with connect() as c:
        cur = c.cursor()
        as_role(cur, "anon")
        a = rpc(cur, "start_submission", "camp-hide-and-seek", 8, "RACEA", None, 1)
        b = rpc(cur, "start_submission", "camp-hide-and-seek", 8, "RACEB", None, 1)
        upload(cur, a["photo_path"])
        upload(cur, b["photo_path"])

    out = {}

    def worker(key, sid, hold):
        with psycopg.connect(f"{DSN} dbname={DB}") as conn:  # transaction mode
            cur = conn.cursor()
            as_role(cur, "anon")
            cur.execute("select public.submit_figure_found(%s)", (sid,))
            out[key] = cur.fetchone()[0]["status"]
            time.sleep(hold)
            conn.commit()

    ta = threading.Thread(target=worker, args=("A", a["submission_id"], 0.8))
    tb = threading.Thread(target=worker, args=("B", b["submission_id"], 0))
    ta.start(); time.sleep(0.2); tb.start(); ta.join(); tb.join()
    check("併發：只有一人成功", sorted(out.values()) == ["already_found", "success"], str(out))

    with connect() as c:
        cur0 = c.execute("select review_status from public.submissions where photo_path in (%s, %s) order by player_id",
                         (a["photo_path"], b["photo_path"]))
        check("併發：輸的那筆標成 duplicate", [r[0] for r in cur0.fetchall()] == ["active", "duplicate"])

    # ---------- 倒數計時 ----------
    with connect() as c:
        cur = c.cursor()
        cur.execute("update public.figures set is_found=false, found_at=null, photo_path=null, submission_id=null, found_by_name=null, is_verified=false")
        cur.execute("update public.games set is_completed=false")

        def timer():
            cur.execute("reset role")
            cur.execute("""select timer_status, timer_end_reason, timer_remaining_ms, timer_version,
                                  extract(epoch from timer_ends_at - now()), extract(epoch from timer_started_at - now())
                           from public.games""")
            return cur.fetchone()

        as_role(cur, "anon")
        check("server_now 給 anon", rpc(cur, "server_now") is not None)
        ok, msg = expect_error(cur, "select public.admin_timer('start', 600)", contains="permission denied")
        check("anon 不能控制倒數", ok, msg)
        as_role(cur, "authenticated", "stranger@example.com")
        ok, msg = expect_error(cur, "select public.admin_timer('start', 600)", contains="not_admin")
        check("非管理員不能控制倒數", ok, msg)

        as_role(cur, "authenticated", ADMIN)
        ok, msg = expect_error(cur, "select public.admin_timer('start', 5)", contains="invalid_seconds")
        check("倒數秒數檢查", ok, msg)
        res = rpc(cur, "admin_timer", "start", 600)
        t = timer()
        check("start → running、3 秒後 GO", res["ok"] and t[0] == "running" and 2.5 < float(t[5]) <= 3.01 and 602 < float(t[4]) <= 603.01, str(t))
        v0 = t[3]
        rpc(cur, "admin_timer", "add", 300)
        t = timer()
        check("+5 分鐘", 902 < float(t[4]) <= 903.01 and t[3] == v0 + 1, str(t))
        rpc(cur, "admin_timer", "pause")
        t = timer()
        check("暫停記下剩餘時間", t[0] == "paused" and t[2] == 900000, str(t))
        check("暫停中不能再暫停", rpc(cur, "admin_timer", "pause")["ok"] is False)
        rpc(cur, "admin_timer", "add", -60)
        check("暫停中可以減時間", timer()[2] == 840000)
        rpc(cur, "admin_timer", "resume")
        t = timer()
        check("繼續 → running", t[0] == "running" and 842 < float(t[4]) <= 843.01, str(t))

        # 時間到 → 玩家不能再建立投稿
        cur.execute("reset role")
        cur.execute("update public.games set timer_started_at = now() - interval '20 minutes', timer_ends_at = now() - interval '10 seconds'")
        as_role(cur, "anon")
        ok, msg = expect_error(cur, "select public.start_submission('camp-hide-and-seek', 1, 'LATE1', null, 1)", contains="time_up")
        check("時間到不能再回報", ok, msg)
        as_role(cur, "authenticated", ADMIN)
        check("時間到後不能暫停", rpc(cur, "admin_timer", "pause")["ok"] is False)
        rpc(cur, "admin_timer", "end")
        t = timer()
        check("時間到後按結束 → ended/time_up", t[0] == "ended" and t[1] == "time_up", str(t))

        # 管理員提前結束 → 不能回報；重置 → 可以
        rpc(cur, "admin_timer", "start", 60)
        rpc(cur, "admin_timer", "end")
        t = timer()
        check("手動結束 → ended/manual", t[0] == "ended" and t[1] == "manual" and t[2] == 60000, str(t))
        as_role(cur, "anon")
        ok, msg = expect_error(cur, "select public.start_submission('camp-hide-and-seek', 1, 'LATE2', null, 1)", contains="time_up")
        check("手動結束後不能回報", ok, msg)
        as_role(cur, "authenticated", ADMIN)
        rpc(cur, "admin_timer", "reset")
        t = timer()
        check("重置 → idle", t[0] == "idle" and t[4] is None, str(t))
        as_role(cur, "anon")
        rpc(cur, "start_submission", "camp-hide-and-seek", 1, "FREE1", None, 1)
        check("未開始倒數也能回報（自由模式）", True)

        # 倒數中 8/8 → 提前完成
        as_role(cur, "authenticated", ADMIN)
        rpc(cur, "admin_timer", "start", 1200)
        as_role(cur, "anon")
        for n in range(1, 9):
            s = rpc(cur, "start_submission", "camp-hide-and-seek", n, f"TM{n}", None, 1)
            upload(cur, s["photo_path"])
            rpc(cur, "submit_figure_found", s["submission_id"])
        t = timer()
        check("倒數中 8/8 → ended/completed 並記下剩餘", t[0] == "ended" and t[1] == "completed" and 1195000 < t[2] <= 1200000, str(t))
        as_role(cur, "anon")
        rpc(cur, "start_submission", "camp-hide-and-seek", 1, "AFTER", None, 1)
        check("提前完成後仍可建立投稿（例如照片被退回後重找）", True)

    # ---------- 刪除投稿 ----------
    with connect() as c:
        cur = c.cursor()
        cur.execute("update public.figures set is_found=false, found_at=null, photo_path=null, submission_id=null, found_by_name=null, is_verified=false")
        cur.execute("update public.games set timer_status='idle', timer_ends_at=null, timer_started_at=null, timer_end_reason=null")
        cur.execute("delete from public.submissions")
        as_role(cur, "anon")
        ids = {}
        for key, n in [("active", 1), ("dup", 1), ("rej", 2), ("fail", 3), ("stuck", 4), ("fresh", 5)]:
            sub = rpc(cur, "start_submission", "camp-hide-and-seek", n, "DEL" + key[:3].upper(), None, 1)
            ids[key] = sub
            if key in ("active", "dup", "rej"):
                upload(cur, sub["photo_path"])
                rpc(cur, "submit_figure_found", sub["submission_id"])
        rpc(cur, "mark_submission_failed", ids["fail"]["submission_id"], "x")
        as_role(cur, "authenticated", ADMIN)
        rpc(cur, "review_submission", ids["rej"]["submission_id"], "reject")
        cur.execute("reset role")
        cur.execute("update public.submissions set created_at = now() - interval '11 minutes' where id = %s", (ids["stuck"]["submission_id"],))

        all_ids = [v["submission_id"] for v in ids.values()]
        as_role(cur, "anon")
        ok, msg = expect_error(cur, "select public.admin_delete_submissions(%s::uuid[])", (all_ids,), "permission denied")
        check("anon 不能刪投稿", ok, msg)
        as_role(cur, "authenticated", "stranger@example.com")
        ok, msg = expect_error(cur, "select public.admin_delete_submissions(%s::uuid[])", (all_ids,), "not_admin")
        check("非管理員不能刪投稿", ok, msg)
        cur.execute("reset role"); cur.execute("select count(*) from storage.objects"); n_before = cur.fetchone()[0]
        as_role(cur, "authenticated", "stranger@example.com")
        cur.execute("delete from storage.objects where bucket_id = 'figure-photos'")
        cur.execute("reset role"); cur.execute("select count(*) from storage.objects")
        check("非管理員刪不到照片檔", cur.fetchone()[0] == n_before)

        as_role(cur, "authenticated", ADMIN)
        res = rpc(cur, "admin_delete_submissions", all_ids)
        cur.execute("select player_id from public.submissions order by player_id")
        left = [r[0] for r in cur.fetchall()]
        check("成功與無效投稿可刪，保留剛開始的上傳", res["deleted"] == 5 and left == ["DELFRE"], f"{res} {left}")
        cur.execute("select path from public.camp_photo_cleanup")
        paths = [r[0] for r in cur.fetchall()]
        check("照片清理路徑已持久保存", len(paths) == 5, str(paths))
        cur.execute("select is_found from public.figures where number = 1")
        check("刪除點亮照片撤回小人進度", cur.fetchone()[0] is False)
        cur.execute("delete from storage.objects where bucket_id = 'figure-photos' and name = any(%s)", (paths,))
        check("管理員可以刪照片檔", cur.rowcount == 3, str(cur.rowcount))

    # reset.sql
    with connect() as c:
        c.execute((ROOT / "reset.sql").read_text())
        cur0 = c.execute("select count(*) filter (where is_found), (select count(*) from public.submissions) from public.figures")
        check("reset.sql 清空進度與投稿", cur0.fetchone() == (0, 0))
        cur0 = c.execute("select timer_status, timer_ends_at from public.games")
        check("reset.sql 倒數歸零", cur0.fetchone() == ("idle", None))

    with psycopg.connect(f"{DSN} dbname=postgres", autocommit=True) as c:
        c.execute(f"drop database {DB} with (force)")

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
