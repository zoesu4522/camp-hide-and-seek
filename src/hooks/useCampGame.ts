"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gameService } from "@/lib/services";
import {
  GAME_SLUG,
  TOTAL_FIGURES,
  type Figure,
  type FoundEvent,
  type Game,
  type GameLoadStatus,
  type GameService,
  type MarkFoundResult,
  type RejectEvent,
  type SubmitFindInput,
} from "@/types/game";

/**
 * 遊戲狀態 hook。
 *
 * 資料流程：fetch game + figures → render → subscribe（Realtime）
 * 去重：`announced` 記錄已經播過「找到」動畫的小人編號，
 *       自己點亮後 Realtime 回音、或多個來源重複推送，都不會重播動畫。
 * 退回：管理員退回照片時 isFound 會變回 false，從 announced 移除並發出 RejectEvent，
 *       之後有人重新找到會再播一次動畫。
 */
export function useCampGame(service: GameService = gameService, slug: string = GAME_SLUG) {
  const [status, setStatus] = useState<GameLoadStatus>("loading");
  const [game, setGame] = useState<Game | null>(null);
  const [figures, setFigures] = useState<Figure[]>([]);
  const [foundEvent, setFoundEvent] = useState<FoundEvent | null>(null);
  const [rejectEvent, setRejectEvent] = useState<RejectEvent | null>(null);
  /** 管理員重置遊戲（round 增加） */
  const [resetEvent, setResetEvent] = useState<{ key: number; round: number } | null>(null);
  const roundRef = useRef<number | null>(null);
  const lastResetAt = useRef(0);
  const pendingRejects = useRef<number[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const [clockOffset, setClockOffset] = useState(0);

  const figuresRef = useRef<Figure[]>([]);
  const announced = useRef<Set<number>>(new Set());

  const commitFigures = useCallback((next: Figure[]) => {
    figuresRef.current = next;
    setFigures(next);
  }, []);

  const applyFigure = useCallback(
    (incoming: Figure, source: FoundEvent["source"]) => {
      const current = figuresRef.current;
      const existing = current.find((f) => f.number === incoming.number);
      const next = current.map((f) => (f.number === incoming.number ? { ...f, ...incoming } : f));
      commitFigures(next);
      const foundCount = next.filter((f) => f.isFound).length;
      setGame((g) => (g ? { ...g, isCompleted: foundCount === TOTAL_FIGURES } : g));

      if (incoming.isFound && !announced.current.has(incoming.number)) {
        announced.current.add(incoming.number);
        setFoundEvent({
          key: `${incoming.number}-${Date.now()}`,
          number: incoming.number,
          source,
          foundCount,
          photoUrl: incoming.photoUrl,
          foundByName: incoming.foundByName,
        });
      } else if (!incoming.isFound && existing?.isFound) {
        announced.current.delete(incoming.number);
        // 重置時 8 個小人會一起變回未找到 → 不要跳 8 次「照片被退回」。
        // 稍等一下再通知：如果這段時間收到 round 變化（重置），就取消
        if (Date.now() - lastResetAt.current > 3000) {
          const n = incoming.number;
          const t = window.setTimeout(() => {
            pendingRejects.current = pendingRejects.current.filter((x) => x !== t);
            setRejectEvent({ key: `${n}-${Date.now()}`, number: n });
          }, 450);
          pendingRejects.current.push(t);
        }
      }
    },
    [commitFigures],
  );

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    service
      .fetchGame(slug)
      .then(({ game: g, figures: list }) => {
        if (cancelled) return;
        const sorted = [...list].sort((a, b) => a.number - b.number);
        announced.current = new Set(sorted.filter((f) => f.isFound).map((f) => f.number));
        commitFigures(sorted);
        roundRef.current = g.round;
        setGame(g);
        setStatus("ready");
        unsubscribe = service.subscribe(
          g.id,
          (fig) => applyFigure(fig, "remote"),
          // 倒數計時：只接受版本較新的（避免重連時舊資料蓋掉新的）
          (incoming) => {
            if (roundRef.current !== null && incoming.round > roundRef.current) {
              roundRef.current = incoming.round;
              lastResetAt.current = Date.now();
              pendingRejects.current.forEach(clearTimeout);
              pendingRejects.current = [];
              setResetEvent({ key: Date.now(), round: incoming.round });
            }
            setGame((cur) =>
              cur && incoming.timer.version >= cur.timer.version ? { ...cur, timer: incoming.timer, round: incoming.round } : cur,
            );
          },
        );
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [service, slug, reloadToken, applyFigure, commitFigures]);

  // 校正手機時間（每次回到前景再量一次）
  useEffect(() => {
    let cancelled = false;
    const measure = () =>
      service
        .getClockOffset()
        .then((o) => !cancelled && setClockOffset(o))
        .catch(() => {
          /* 用 0 */
        });
    measure();
    const onVisible = () => document.visibilityState === "visible" && measure();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [service]);

  const retry = useCallback(() => {
    setStatus("loading");
    setReloadToken((t) => t + 1);
  }, []);

  /** 上傳照片並點亮（照片必填） */
  const submitFind = useCallback(
    async (input: SubmitFindInput): Promise<MarkFoundResult> => {
      try {
        const result = await service.submitFind(slug, input);
        if (result.figure) applyFigure(result.figure, result.status === "success" ? "local" : "remote");
        return result;
      } catch {
        return { status: "error", error: "unknown" };
      }
    },
    [service, slug, applyFigure],
  );

  const foundCount = useMemo(() => figures.filter((f) => f.isFound).length, [figures]);

  return {
    status,
    game,
    figures,
    foundCount,
    total: TOTAL_FIGURES,
    isCompleted: foundCount === TOTAL_FIGURES,
    foundEvent,
    rejectEvent,
    resetEvent,
    clockOffset,
    submitFind,
    retry,
  };
}
