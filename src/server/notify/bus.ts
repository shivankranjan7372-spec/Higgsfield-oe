import "server-only";

import { EventEmitter } from "node:events";

/**
 * In-process fan-out from `notify()` and read/delete calls to open event streams.
 * One Node process only: with several app servers, a member's stream only hears
 * notices created on the same process (the stream also re-checks every few seconds,
 * so nothing is lost, it just arrives later).
 */
const holder = globalThis as unknown as { __parallaxNotifyBus?: EventEmitter };
const bus = (holder.__parallaxNotifyBus ??= new EventEmitter().setMaxListeners(0));

export type BusEvent = { event: "notice" | "unread"; data: Record<string, unknown> };

export function publish(userId: string, e: BusEvent) {
  bus.emit(userId, e);
}

export function subscribe(userId: string, fn: (e: BusEvent) => void): () => void {
  bus.on(userId, fn);
  return () => bus.off(userId, fn);
}
