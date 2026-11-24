import "server-only";

import { all, get, newId, run } from "@/server/db";
import { badRequest, notFound } from "@/server/errors";
import { limits } from "./config";

/** Scheduled chats: a prompt that runs again every N minutes, always in "ask" mode. */

export interface ScheduleRow {
  id: string;
  user_id: string;
  chat_id: string | null;
  title: string;
  prompt: string;
  interval_minutes: number;
  enabled: number;
  next_run_at: number;
  last_run_at: number | null;
  created_at: number;
}

export interface Schedule {
  id: string;
  chatId: string | null;
  title: string;
  prompt: string;
  intervalMinutes: number;
  enabled: boolean;
  nextRunAt: number;
  lastRunAt: number | null;
  createdAt: number;
}

export const toSchedule = (r: ScheduleRow): Schedule => ({
  id: r.id,
  chatId: r.chat_id,
  title: r.title,
  prompt: r.prompt,
  intervalMinutes: r.interval_minutes,
  enabled: r.enabled === 1,
  nextRunAt: r.next_run_at,
  lastRunAt: r.last_run_at,
  createdAt: r.created_at,
});

export const MIN_INTERVAL = 60;
export const MAX_INTERVAL = 43_200;

export function checkInterval(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < MIN_INTERVAL || n > MAX_INTERVAL) throw badRequest(`Pick an interval from ${MIN_INTERVAL} minutes to 30 days.`);
  return n;
}

export function listSchedules(userId: string): Schedule[] {
  return all<ScheduleRow>("SELECT * FROM super_schedules WHERE user_id = ? ORDER BY created_at", userId).map(toSchedule);
}

function owned(userId: string, id: string): ScheduleRow {
  const r = get<ScheduleRow>("SELECT * FROM super_schedules WHERE id = ? AND user_id = ?", id, userId);
  if (!r) throw notFound("That schedule does not exist.");
  return r;
}

export function createSchedule(userId: string, input: { title: string; prompt: string; intervalMinutes: number; firstRunAt?: number }): Schedule {
  if (get<{ n: number }>("SELECT COUNT(*) AS n FROM super_schedules WHERE user_id = ?", userId)!.n >= limits.maxSchedules) {
    throw badRequest(`You can have up to ${limits.maxSchedules} scheduled chats.`);
  }
  const id = newId("ssc");
  const now = Date.now();
  run(
    "INSERT INTO super_schedules (id, user_id, title, prompt, interval_minutes, next_run_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    id,
    userId,
    input.title,
    input.prompt,
    input.intervalMinutes,
    input.firstRunAt ?? now + input.intervalMinutes * 60_000,
    now,
  );
  return toSchedule(owned(userId, id));
}

export function updateSchedule(userId: string, id: string, patch: { title?: string; prompt?: string; intervalMinutes?: number; enabled?: boolean; runNow?: boolean }): Schedule {
  const cur = owned(userId, id);
  const every = patch.intervalMinutes ?? cur.interval_minutes;
  let next = cur.next_run_at;
  if (patch.intervalMinutes && patch.intervalMinutes !== cur.interval_minutes) next = Date.now() + every * 60_000;
  if (patch.enabled === true && cur.enabled === 0) next = Date.now() + every * 60_000;
  if (patch.runNow) next = Date.now();
  run(
    "UPDATE super_schedules SET title = ?, prompt = ?, interval_minutes = ?, enabled = ?, next_run_at = ? WHERE id = ?",
    patch.title ?? cur.title,
    patch.prompt ?? cur.prompt,
    every,
    patch.enabled == null ? cur.enabled : patch.enabled ? 1 : 0,
    next,
    id,
  );
  return toSchedule(owned(userId, id));
}

export function deleteSchedule(userId: string, id: string) {
  owned(userId, id);
  run("DELETE FROM super_schedules WHERE id = ?", id);
}

export function dueSchedules(now: number): ScheduleRow[] {
  return all<ScheduleRow>("SELECT * FROM super_schedules WHERE enabled = 1 AND next_run_at <= ? ORDER BY next_run_at LIMIT 20", now);
}

export function markRan(id: string, chatId: string, now: number, every: number) {
  run("UPDATE super_schedules SET chat_id = ?, last_run_at = ?, next_run_at = ? WHERE id = ?", chatId, now, now + every * 60_000, id);
}
