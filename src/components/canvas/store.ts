"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Canvases live in this browser only: there is no server for them. Each person (or guest) on
 * this browser has their own list, keyed by their user id. Every read and write is wrapped,
 * so a browser that refuses storage still works for the length of the tab.
 */

export interface BoardItem {
  id: string;
  kind: "image" | "note" | "pending";
  x: number;
  y: number;
  w: number;
  h: number;
  /** Pictures: the asset and its address. */
  assetId?: string;
  src?: string;
  prompt?: string;
  /** Notes. */
  text?: string;
  /** Pending: the job that will fill it. */
  jobId?: string;
  failed?: string;
}

export interface Board {
  id: string;
  name: string;
  items: BoardItem[];
  view: { x: number; y: number; zoom: number };
  createdAt: number;
  updatedAt: number;
}

const PREFIX = "parallax.canvas.v1:";
const memory = new Map<string, string>();
let broken = false;
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; boards: Board[] }>();

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    broken = true;
    return memory.get(key) ?? null;
  }
}

function write(key: string, value: string) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    broken = true;
  }
}

export function storageBroken() {
  return broken;
}

function load(owner: string): Board[] {
  const key = PREFIX + owner;
  const raw = read(key) ?? memory.get(key) ?? null;
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.boards;
  let boards: Board[] = [];
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) boards = parsed.filter((b): b is Board => !!b && typeof b === "object" && typeof (b as Board).id === "string" && Array.isArray((b as Board).items));
  } catch {
    boards = [];
  }
  cache.set(key, { raw, boards });
  return boards;
}

function save(owner: string, boards: Board[]) {
  write(PREFIX + owner, JSON.stringify(boards));
  for (const l of listeners) l();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith(PREFIX)) fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

const NONE: Board[] = [];

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** The boards of one owner (a user id), newest edit first. Null owner: none. */
export function useBoards(owner: string | null) {
  const boards = useSyncExternalStore(
    subscribe,
    () => (owner ? load(owner) : NONE),
    () => NONE,
  );
  const sorted = [...boards].sort((a, b) => b.updatedAt - a.updatedAt);

  const create = useCallback(
    (name: string, items: BoardItem[] = []): Board | null => {
      if (!owner) return null;
      const now = Date.now();
      const board: Board = { id: newId("cnv"), name, items, view: { x: 80, y: 80, zoom: 1 }, createdAt: now, updatedAt: now };
      save(owner, [board, ...load(owner)]);
      return board;
    },
    [owner],
  );

  const remove = useCallback(
    (id: string) => {
      if (!owner) return;
      save(owner, load(owner).filter((b) => b.id !== id));
    },
    [owner],
  );

  const update = useCallback(
    (id: string, change: (b: Board) => Board) => {
      if (!owner) return;
      save(
        owner,
        load(owner).map((b) => (b.id === id ? { ...change(b), updatedAt: Date.now() } : b)),
      );
    },
    [owner],
  );

  return { boards: sorted, create, remove, update };
}
