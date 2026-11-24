"use client";

import {
  ArrowDownToLine,
  ArrowLeft,
  BringToFront,
  ChevronDown,
  ChevronUp,
  Images,
  Loader2,
  Maximize,
  Minus,
  Plus,
  StickyNote,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { LoginDialog } from "@/components/entry/login-dialog";
import { Composer, ComposerDock } from "@/components/studio";
import { canvasCopy } from "@/content/canvas";
import { routes } from "@/content/site";
import type { Asset, Job } from "@/lib/api";
import { useQueryParam } from "@/lib/browser";
import { ensureSession, useSession } from "@/lib/session";
import { useJobs, useStudio, type Studio } from "@/lib/studio";
import { cn } from "@/ui";
import { templateItems } from "./canvas-home";
import { exportBoard } from "./export";
import { DRAG_TYPE, LibraryPanel } from "./library-panel";
import { newId, storageBroken, useBoards, type Board, type BoardItem } from "./store";

const t = canvasCopy.board;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const PICTURE_W = 240;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A 32-high round icon button on the board's bars. */
function Tool({ label, onClick, children, disabled, active }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40",
        active ? "bg-border-default text-text-primary" : "text-text-primary hover:bg-border-subtle",
      )}
    >
      {children}
    </button>
  );
}

type Drag =
  | { mode: "pan"; sx: number; sy: number; vx: number; vy: number }
  | { mode: "move"; id: string; sx: number; sy: number; ix: number; iy: number }
  | { mode: "resize"; id: string; sx: number; sy: number; iw: number; ih: number; keep: boolean };

/** The board once we know whose it is and which one. */
function Workspace({ board: initial, save, studio }: { board: Board; save: (b: Board) => void; studio: Studio }) {
  const [board, setBoard] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [library, setLibrary] = useState(false);
  const [login, setLogin] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [panning, setPanning] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const { jobs, loading: jobsLoading } = useJobs("image");

  const { view, items } = board;

  // Save a moment after the last change, and when leaving.
  const latest = useRef(board);
  useEffect(() => {
    if (latest.current === board) return;
    latest.current = board;
    const id = window.setTimeout(() => save(board), 300);
    return () => window.clearTimeout(id);
  }, [board, save]);
  useEffect(() => () => save(latest.current), [save]);

  const change = useCallback((fn: (b: Board) => Board) => setBoard((b) => fn(b)), []);
  const setItems = useCallback((fn: (items: BoardItem[]) => BoardItem[]) => change((b) => ({ ...b, items: fn(b.items) })), [change]);
  const patch = useCallback((id: string, p: Partial<BoardItem>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...p } : i))), [setItems]);

  /** The middle of what is on screen, in board units. */
  const centre = useCallback(() => {
    const r = viewport.current?.getBoundingClientRect();
    const w = r?.width ?? 800;
    const h = (r?.height ?? 600) - 140;
    return { x: (w / 2 - view.x) / view.zoom, y: (Math.max(120, h) / 2 - view.y) / view.zoom };
  }, [view]);

  const toWorld = (clientX: number, clientY: number) => {
    const r = viewport.current!.getBoundingClientRect();
    return { x: (clientX - r.left - view.x) / view.zoom, y: (clientY - r.top - view.y) / view.zoom };
  };

  const addAsset = useCallback(
    (a: Asset, at?: { x: number; y: number }) => {
      const ratio = a.width && a.height ? a.height / a.width : 1;
      const w = PICTURE_W;
      const h = Math.round(w * ratio);
      const c = at ?? centre();
      const item: BoardItem = { id: newId("itm"), kind: "image", x: Math.round(c.x - w / 2), y: Math.round(c.y - h / 2), w, h, assetId: a.id, src: a.posterUrl ?? a.url, prompt: a.prompt || a.title };
      setItems((list) => [...list, item]);
      setSelected(item.id);
    },
    [centre, setItems],
  );

  const addNote = () => {
    const c = centre();
    const item: BoardItem = { id: newId("itm"), kind: "note", x: Math.round(c.x - 110), y: Math.round(c.y - 60), w: 220, h: 120, text: "" };
    setItems((list) => [...list, item]);
    setSelected(item.id);
    setEditing(item.id);
  };

  const remove = (id: string) => {
    setItems((list) => list.filter((i) => i.id !== id));
    setSelected(null);
    setEditing(null);
    viewport.current?.focus();
  };

  const layer = (id: string, how: "up" | "down" | "top") =>
    setItems((list) => {
      const at = list.findIndex((i) => i.id === id);
      if (at < 0) return list;
      const next = [...list];
      const [it] = next.splice(at, 1);
      const to = how === "top" ? next.length : how === "up" ? Math.min(next.length, at + 1) : Math.max(0, at - 1);
      next.splice(to, 0, it);
      return next;
    });

  const zoomAt = useCallback(
    (factor: number, px?: number, py?: number) =>
      change((b) => {
        const r = viewport.current?.getBoundingClientRect();
        const cx = px ?? (r ? r.width / 2 : 0);
        const cy = py ?? (r ? r.height / 2 : 0);
        const zoom = clamp(b.view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
        const k = zoom / b.view.zoom;
        return { ...b, view: { zoom, x: cx - (cx - b.view.x) * k, y: cy - (cy - b.view.y) * k } };
      }),
    [change],
  );

  const fit = () =>
    change((b) => {
      const r = viewport.current?.getBoundingClientRect();
      if (!r || !b.items.length) return { ...b, view: { x: 80, y: 80, zoom: 1 } };
      const minX = Math.min(...b.items.map((i) => i.x));
      const minY = Math.min(...b.items.map((i) => i.y));
      const maxX = Math.max(...b.items.map((i) => i.x + i.w));
      const maxY = Math.max(...b.items.map((i) => i.y + i.h));
      const room = { w: r.width - 64, h: Math.max(160, r.height - 64 - 150) };
      const zoom = clamp(Math.min(room.w / (maxX - minX), room.h / (maxY - minY)), MIN_ZOOM, 1.5);
      return { ...b, view: { zoom, x: (r.width - (maxX - minX) * zoom) / 2 - minX * zoom, y: 32 + (room.h - (maxY - minY) * zoom) / 2 - minY * zoom } };
    });

  // Wheel: scroll pans, Ctrl (or a pinch on a trackpad) zooms. Needs a non-passive listener.
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest("textarea")) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
      } else change((b) => ({ ...b, view: { ...b.view, x: b.view.x - e.deltaX, y: b.view.y - e.deltaY } }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, change]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("textarea, [data-ui]")) return;
    const handle = target.closest<HTMLElement>("[data-resize]");
    const node = target.closest<HTMLElement>("[data-item]");
    if (handle) {
      const it = items.find((i) => i.id === handle.dataset.resize);
      if (!it) return;
      drag.current = { mode: "resize", id: it.id, sx: e.clientX, sy: e.clientY, iw: it.w, ih: it.h, keep: it.kind !== "note" };
    } else if (node) {
      const it = items.find((i) => i.id === node.dataset.item);
      if (!it) return;
      setSelected(it.id);
      if (editing !== it.id) setEditing(null);
      drag.current = { mode: "move", id: it.id, sx: e.clientX, sy: e.clientY, ix: it.x, iy: it.y };
    } else {
      setSelected(null);
      setEditing(null);
      drag.current = { mode: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      setPanning(true);
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (d.mode === "pan") change((b) => ({ ...b, view: { ...b.view, x: d.vx + dx, y: d.vy + dy } }));
    else if (d.mode === "move") patch(d.id, { x: Math.round(d.ix + dx / view.zoom), y: Math.round(d.iy + dy / view.zoom) });
    else {
      const w = Math.max(60, d.iw + dx / view.zoom);
      const h = d.keep ? Math.round((w * d.ih) / d.iw) : Math.max(48, d.ih + dy / view.zoom);
      patch(d.id, { w: Math.round(w), h: Math.round(h) });
    }
  };

  const onPointerUp = () => {
    drag.current = null;
    setPanning(false);
  };

  const onItemKey = (e: React.KeyboardEvent, it: BoardItem) => {
    if (editing === it.id) return;
    const step = e.shiftKey ? 10 : 1;
    const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (move[e.key]) {
      e.preventDefault();
      patch(it.id, { x: it.x + move[e.key][0], y: it.y + move[e.key][1] });
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      remove(it.id);
    } else if (e.key === "Enter" && it.kind === "note") {
      e.preventDefault();
      setEditing(it.id);
    } else if (e.key === "Escape") {
      setSelected(null);
      viewport.current?.focus();
    }
  };

  // Generating: the jobs this press of Generate made are claimed by the board as placeholders.
  const claim = useRef<{ known: Set<string>; since: number } | null>(null);
  const boardStudio: Studio = useMemo(
    () => ({
      ...studio,
      generate: async () => {
        claim.current = { known: new Set(jobs.map((j) => j.id)), since: Date.now() - 60_000 };
        const ok = await studio.generate();
        if (!ok) claim.current = null;
        return ok;
      },
    }),
    [studio, jobs],
  );

  useEffect(() => {
    const c = claim.current;
    if (c) {
      const fresh = jobs.filter((j) => !c.known.has(j.id) && j.createdAt >= c.since);
      if (fresh.length) {
        claim.current = null;
        const mid = centre();
        const w = PICTURE_W;
        // Queue the change: it is a reaction to the server's list, not to this render.
        queueMicrotask(() => {
          setItems((list) => [
            ...list,
            ...fresh.flatMap((job, n) =>
              Array.from({ length: Math.max(1, job.count) }, (_, k) => ({
                id: newId("itm"),
                kind: "pending" as const,
                jobId: job.id,
                prompt: job.prompt,
                x: Math.round(mid.x - w / 2 + (n + k) * (w + 24)),
                y: Math.round(mid.y - w / 2),
                w,
                h: w,
              })),
            ),
          ]);
        });
      }
    }
  }, [jobs, centre, setItems]);

  // Fill placeholders when their pictures land.
  useEffect(() => {
    if (jobsLoading) return;
    const byId = new Map<string, Job>(jobs.map((j) => [j.id, j]));
    const waiting = items.filter((i) => i.kind === "pending" && !i.failed);
    if (!waiting.length) return;
    // Work out what each waiting placeholder becomes, then apply it to the latest list.
    const outcome = new Map<string, BoardItem | null>();
    const used = new Map<string, number>();
    for (const it of waiting) {
      const job = it.jobId ? byId.get(it.jobId) : undefined;
      if (!job) {
        // Gone from a short list: canceled or removed. Drop quietly.
        if (jobs.length < 40) outcome.set(it.id, null);
        continue;
      }
      if (job.status === "failed") {
        outcome.set(it.id, { ...it, failed: job.error?.message || t.failed });
        continue;
      }
      if (job.status !== "succeeded") continue;
      const n = used.get(job.id) ?? 0;
      used.set(job.id, n + 1);
      const a = job.assets[n];
      if (!a) {
        outcome.set(it.id, null);
        continue;
      }
      const ratio = a.width && a.height ? a.height / a.width : 1;
      outcome.set(it.id, { id: it.id, kind: "image", x: it.x, y: it.y, w: it.w, h: Math.round(it.w * ratio), assetId: a.id, src: a.posterUrl ?? a.url, prompt: job.prompt });
    }
    if (!outcome.size) return;
    queueMicrotask(() =>
      setItems((list) =>
        list.flatMap((it) => {
          if (!outcome.has(it.id)) return [it];
          const to = outcome.get(it.id);
          return to ? [to] : [];
        }),
      ),
    );
  }, [jobs, jobsLoading, items, setItems]);

  const doExport = async () => {
    if (!items.some((i) => i.kind !== "pending")) {
      setProblem(t.exportEmpty);
      return;
    }
    setExporting(true);
    setProblem(null);
    try {
      const blob = await exportBoard(items);
      if (!blob) throw new Error("empty");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(board.name || canvasCopy.untitled).replace(/[^\w\- ]+/g, "").trim() || "canvas"}.png`;
      document.body.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      setProblem(t.exportFailed);
    } finally {
      setExporting(false);
    }
  };

  const sel = items.find((i) => i.id === selected) ?? null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border-subtle px-3 sm:px-4">
        <Link
          href={routes.canvas}
          aria-label={t.back}
          title={t.back}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-text-primary transition-colors duration-150 hover:bg-border-subtle"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden />
        </Link>
        <label className="min-w-0 flex-1 sm:flex-none">
          <span className="sr-only">{t.name}</span>
          <input
            value={board.name}
            onChange={(e) => change((b) => ({ ...b, name: e.target.value.slice(0, 80) }))}
            placeholder={canvasCopy.untitled}
            className="h-8 w-full min-w-0 rounded-md bg-transparent px-2 text-sm leading-5 font-semibold text-text-primary transition-colors duration-150 outline-none placeholder:text-text-tertiary hover:bg-border-subtle focus:bg-border-subtle sm:w-[240px]"
          />
        </label>
        <span className="hidden truncate text-xs leading-[18px] text-text-secondary md:block">{storageBroken() ? canvasCopy.storageFailed : t.localNote}</span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-pressed={library}
            onClick={() => setLibrary((v) => !v)}
            className={cn(
              "flex h-8 items-center gap-1 rounded-full px-2 text-xs leading-[18px] font-semibold transition-colors duration-150 sm:px-3",
              library ? "bg-border-default text-text-primary" : "text-text-primary hover:bg-border-subtle",
            )}
          >
            <Images className="size-4" strokeWidth={1.5} aria-hidden />
            <span className="hidden sm:inline">{t.addPictures}</span>
            <span className="sr-only sm:hidden">{t.addPictures}</span>
          </button>
          <button type="button" onClick={addNote} className="flex h-8 items-center gap-1 rounded-full px-2 text-xs leading-[18px] font-semibold text-text-primary transition-colors duration-150 hover:bg-border-subtle sm:px-3">
            <StickyNote className="size-4" strokeWidth={1.5} aria-hidden />
            <span className="hidden sm:inline">{t.addNote}</span>
            <span className="sr-only sm:hidden">{t.addNote}</span>
          </button>
          <button
            type="button"
            onClick={() => void doExport()}
            disabled={exporting}
            className="flex h-8 items-center gap-1 rounded-full bg-text-primary px-3 text-xs leading-[18px] font-semibold text-ink transition-colors duration-150 hover:bg-text-soft disabled:opacity-60"
          >
            {exporting ? <Loader2 className="size-4 animate-spin" strokeWidth={1.5} aria-hidden /> : <ArrowDownToLine className="size-4" strokeWidth={1.5} aria-hidden />}
            <span className="hidden sm:inline">{exporting ? t.exporting : t.export}</span>
            <span className="sr-only sm:hidden">{t.export}</span>
          </button>
        </div>
      </div>

      <div
        ref={viewport}
        tabIndex={-1}
        aria-label={board.name || canvasCopy.untitled}
        role="application"
        data-board
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DRAG_TYPE)) e.preventDefault();
        }}
        onDrop={(e) => {
          const raw = e.dataTransfer.getData(DRAG_TYPE);
          if (!raw) return;
          e.preventDefault();
          try {
            addAsset(JSON.parse(raw) as Asset, toWorld(e.clientX, e.clientY));
          } catch {
            /* not one of ours */
          }
        }}
        className="relative min-h-0 flex-1 touch-none overflow-hidden outline-none select-none"
        style={{
          cursor: panning ? "grabbing" : "default",
          backgroundColor: "var(--color-page)",
          backgroundImage: "radial-gradient(#FFFFFF1A 1px, transparent 1px)",
          backgroundSize: `${24 * view.zoom}px ${24 * view.zoom}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
      >
        <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
          {items.map((it) => {
            const isSel = it.id === selected;
            return (
              <div
                key={it.id}
                data-item={it.id}
                tabIndex={0}
                role="button"
                aria-pressed={isSel}
                aria-label={it.kind === "note" ? t.note(it.text ?? "") : it.kind === "pending" ? t.pending : t.picture(it.prompt ?? "")}
                onFocus={() => setSelected(it.id)}
                onKeyDown={(e) => onItemKey(e, it)}
                onDoubleClick={() => it.kind === "note" && setEditing(it.id)}
                className={cn("absolute cursor-move", isSel ? "outline outline-[#1886F5]" : "hover:outline hover:outline-border-strong")}
                style={{ left: it.x, top: it.y, width: it.w, height: it.h, outlineWidth: (isSel ? 2 : 1) / view.zoom }}
              >
                {it.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.src} alt="" draggable={false} className="pointer-events-none size-full rounded-lg bg-surface-secondary object-cover" />
                ) : it.kind === "pending" ? (
                  <div className={cn("flex size-full flex-col items-center justify-center gap-2 rounded-lg bg-surface-secondary p-3 text-center", !it.failed && "shimmer")} aria-busy={!it.failed}>
                    {it.failed ? (
                      <>
                        <TriangleAlert className="size-5 text-danger" strokeWidth={1.5} aria-hidden />
                        <p className="line-clamp-3 text-xs leading-[18px] text-text-primary">{it.failed}</p>
                        <button data-ui type="button" onClick={() => remove(it.id)} className="h-7 rounded-full bg-border-default px-3 text-xs font-semibold text-text-primary transition-colors duration-150 hover:bg-border-strong">
                          {t.dismiss}
                        </button>
                      </>
                    ) : (
                      <>
                        <Loader2 className="size-5 animate-spin text-text-secondary" strokeWidth={1.5} aria-hidden />
                        <p className="text-xs leading-[18px] text-text-secondary">{t.pending}</p>
                      </>
                    )}
                  </div>
                ) : editing === it.id ? (
                  <textarea
                    autoFocus
                    aria-label={t.noteLabel}
                    value={it.text ?? ""}
                    onChange={(e) => patch(it.id, { text: e.target.value.slice(0, 2000) })}
                    onBlur={() => setEditing(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setEditing(null);
                        (e.currentTarget.closest("[data-item]") as HTMLElement | null)?.focus();
                      }
                    }}
                    placeholder={t.newNote}
                    className="size-full resize-none rounded-xl border border-border-default bg-surface-secondary-strong p-3 text-sm leading-5 font-medium text-text-primary outline-none placeholder:text-text-tertiary"
                  />
                ) : (
                  <div className="size-full overflow-hidden rounded-xl border border-border-default bg-surface-secondary-strong p-3 text-sm leading-5 font-medium break-words whitespace-pre-wrap text-text-primary">
                    {it.text || <span className="text-text-tertiary">{t.newNote}</span>}
                  </div>
                )}
                {isSel && it.kind !== "pending" ? (
                  <span
                    data-resize={it.id}
                    aria-hidden
                    className="absolute rounded-full border border-[#1886F5] bg-text-primary"
                    style={{ width: 12 / view.zoom, height: 12 / view.zoom, right: -6 / view.zoom, bottom: -6 / view.zoom, cursor: "nwse-resize" }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        {items.length === 0 ? (
          <div className="pointer-events-none absolute inset-x-0 top-[22%] flex justify-center px-6">
            <div className="flex max-w-[360px] flex-col items-center gap-2 text-center">
              <p className="text-base leading-6 font-semibold text-text-primary">{t.emptyTitle}</p>
              <p className="text-sm leading-5 text-text-muted">{t.emptyText}</p>
              <p className="hidden text-xs leading-[18px] text-text-tertiary sm:block">{t.hint}</p>
            </div>
          </div>
        ) : null}

        {/* What can be done to the picked item. */}
        {sel ? (
          <div data-ui className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full bg-surface-glass p-1 shadow-menu backdrop-blur-md" role="toolbar" aria-label="Selection">
            <Tool label={t.backward} onClick={() => layer(sel.id, "down")}>
              <ChevronDown className="size-4" strokeWidth={1.5} aria-hidden />
            </Tool>
            <Tool label={t.forward} onClick={() => layer(sel.id, "up")}>
              <ChevronUp className="size-4" strokeWidth={1.5} aria-hidden />
            </Tool>
            <Tool label={t.toFront} onClick={() => layer(sel.id, "top")}>
              <BringToFront className="size-4" strokeWidth={1.5} aria-hidden />
            </Tool>
            <span aria-hidden className="mx-1 h-4 w-px bg-border-default" />
            <Tool label={t.remove} onClick={() => remove(sel.id)}>
              <Trash2 className="size-4 text-danger" strokeWidth={1.5} aria-hidden />
            </Tool>
          </div>
        ) : null}

        <div data-ui className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-full bg-surface-glass p-1 shadow-menu backdrop-blur-md">
          <Tool label={t.zoomOut} onClick={() => zoomAt(1 / 1.25)} disabled={view.zoom <= MIN_ZOOM}>
            <Minus className="size-4" strokeWidth={1.5} aria-hidden />
          </Tool>
          <span className="w-10 text-center font-mono text-xs leading-[18px] text-text-primary" aria-live="polite" aria-label={t.zoomLevel(Math.round(view.zoom * 100))}>
            {Math.round(view.zoom * 100)}%
          </span>
          <Tool label={t.zoomIn} onClick={() => zoomAt(1.25)} disabled={view.zoom >= MAX_ZOOM}>
            <Plus className="size-4" strokeWidth={1.5} aria-hidden />
          </Tool>
          <Tool label={t.fit} onClick={fit}>
            <Maximize className="size-4" strokeWidth={1.5} aria-hidden />
          </Tool>
        </div>

        {problem ? (
          <div data-ui role="alert" className="absolute inset-x-0 top-16 z-30 flex justify-center px-4">
            <div className="flex max-w-full animate-rise-in items-center gap-2 rounded-full bg-surface-secondary-strong py-[6px] pr-[6px] pl-3 shadow-menu">
              <span className="min-w-0 text-sm leading-5 text-text-primary">{problem}</span>
              <button
                type="button"
                aria-label={t.dismiss}
                onClick={() => setProblem(null)}
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-border-subtle text-text-secondary transition-colors duration-150 hover:bg-border-default hover:text-text-primary"
              >
                <X className="size-4" strokeWidth={1.5} aria-hidden />
              </button>
            </div>
          </div>
        ) : null}

        {library ? <LibraryPanel onClose={() => setLibrary(false)} onAdd={(a) => addAsset(a)} onSignIn={() => setLogin(true)} /> : null}

        <div data-ui>
          <ComposerDock>
            <Composer studio={boardStudio} placeholder={t.placeholder} />
          </ComposerDock>
        </div>
      </div>
      <LoginDialog open={login} onOpenChange={setLogin} mode="login" next={routes.canvas} />
    </div>
  );
}

/** A centred message on an otherwise empty board page. */
function Notice({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-[1184px] flex-col items-center justify-center gap-3 rounded-xl border border-border-subtle bg-[#FFFFFF05] px-4 py-14 text-center">
        <p className="text-sm leading-5 text-text-muted">{text}</p>
        {children}
      </div>
    </div>
  );
}

const pill =
  "inline-flex h-8 items-center justify-center rounded-full bg-text-primary px-[15px] text-xs leading-[18px] font-semibold whitespace-nowrap text-ink transition-colors duration-150 hover:bg-text-soft disabled:opacity-40";

/**
 * /canvas/board?id=… : one board. `?new=1[&template=…]` makes a fresh one and swaps the
 * address to its id. Everything is kept in this browser (see store.ts).
 */
export function CanvasBoard() {
  const router = useRouter();
  const id = useQueryParam("id");
  const fresh = useQueryParam("new");
  const template = useQueryParam("template");
  const { user, loading } = useSession();
  const owner = user?.id ?? null;
  const { boards, create, update } = useBoards(owner);
  const studio = useStudio("image");
  const made = useRef(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!fresh || id || !owner || made.current) return;
    made.current = true;
    const tpl = template ? canvasCopy.templates.find((x) => x.id === template) : undefined;
    const b = create(tpl?.name ?? canvasCopy.untitled, tpl ? templateItems(tpl.id) : []);
    if (b) router.replace(`${routes.canvas}/board?id=${encodeURIComponent(b.id)}`);
  }, [fresh, id, owner, template, create, router]);

  const board = id ? boards.find((b) => b.id === id) : undefined;
  const save = useCallback((b: Board) => update(b.id, () => b), [update]);

  if (loading || (fresh && !id && owner)) {
    return <div aria-busy="true" aria-label="Loading" className="shimmer m-4 flex-1 rounded-xl bg-surface-primary" />;
  }
  if (!owner) {
    return (
      <Notice text={canvasCopy.empty.text}>
        <button
          type="button"
          disabled={starting}
          className={pill}
          onClick={() => {
            setStarting(true);
            void ensureSession()
              .then(() => router.replace(`${routes.canvas}/board?new=1`))
              .finally(() => setStarting(false));
          }}
        >
          {canvasCopy.newCanvas}
        </button>
      </Notice>
    );
  }
  if (!board) {
    return (
      <Notice text={t.notFound}>
        <Link href={routes.canvas} className={pill}>
          {t.notFoundAction}
        </Link>
      </Notice>
    );
  }
  return <Workspace key={board.id} board={board} save={save} studio={studio} />;
}
