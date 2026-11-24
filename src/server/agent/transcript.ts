import "server-only";

import { all, get, newId, parseJson, run, tx } from "@/server/db";
import { notFound } from "@/server/errors";
import { publish } from "./hub";

/**
 * Chats and their transcripts. A transcript is rows with a `seq` (position) and an
 * `updatedSeq` (the chat's revision when the row last changed). A streaming reply is the
 * same row written again with a higher `updatedSeq`, so clients upsert rows by `seq` and
 * catch up with "everything after the highest updatedSeq I have".
 */

export type RowKind = "message" | "tool-call" | "card" | "event" | "notice";

export interface ChatRow {
  id: string;
  user_id: string;
  title: string;
  project_id: string | null;
  skill_ids: string;
  pinned: number;
  incognito: number;
  state: "idle" | "running" | "waiting";
  last_seq: number;
  rev: number;
  created_at: number;
  updated_at: number;
}

export interface Chat {
  id: string;
  title: string;
  projectId: string | null;
  skillIds: string[];
  pinned: boolean;
  incognito: boolean;
  state: ChatRow["state"];
  /** The chat's newest `updatedSeq`. */
  rev: number;
  createdAt: number;
  updatedAt: number;
}

export function toChat(r: ChatRow): Chat {
  return {
    id: r.id,
    title: r.title,
    projectId: r.project_id,
    skillIds: parseJson<string[]>(r.skill_ids, []),
    pinned: r.pinned === 1,
    incognito: r.incognito === 1,
    state: r.state,
    rev: r.rev,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface Row {
  chatId: string;
  seq: number;
  updatedSeq: number;
  kind: RowKind;
  body: Record<string, unknown>;
  createdAt: number;
}

interface RowRecord {
  chat_id: string;
  seq: number;
  updated_seq: number;
  kind: RowKind;
  body: string;
  created_at: number;
}

const toRow = (r: RowRecord): Row => ({
  chatId: r.chat_id,
  seq: r.seq,
  updatedSeq: r.updated_seq,
  kind: r.kind,
  body: parseJson<Record<string, unknown>>(r.body, {}),
  createdAt: r.created_at,
});

export function ownedChat(userId: string, chatId: string): ChatRow {
  const row = get<ChatRow>("SELECT * FROM super_chats WHERE id = ? AND user_id = ?", chatId, userId);
  if (!row) throw notFound("That chat does not exist.");
  return row;
}

export function chatById(chatId: string): ChatRow | undefined {
  return get<ChatRow>("SELECT * FROM super_chats WHERE id = ?", chatId);
}

export function createChat(userId: string, input: { title?: string; projectId?: string | null; skillIds?: string[]; incognito?: boolean }): Chat {
  const id = newId("sch");
  const now = Date.now();
  run(
    "INSERT INTO super_chats (id, user_id, title, project_id, skill_ids, incognito, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    userId,
    input.title ?? "",
    input.projectId ?? null,
    JSON.stringify(input.skillIds ?? []),
    input.incognito ? 1 : 0,
    now,
    now,
  );
  const chat = toChat(ownedChat(userId, id));
  publish(userId, "chat", { chat });
  return chat;
}

export function publishChat(chatId: string) {
  const row = chatById(chatId);
  if (row) publish(row.user_id, "chat", { chat: toChat(row) });
}

export function setChatState(chatId: string, state: ChatRow["state"]) {
  run("UPDATE super_chats SET state = ?, updated_at = ? WHERE id = ?", state, Date.now(), chatId);
  publishChat(chatId);
}

/** Appends a row and tells the member's stream. Returns its seq. */
export function addRow(chatId: string, kind: RowKind, body: Record<string, unknown>): Row {
  const row = tx(() => {
    run("UPDATE super_chats SET last_seq = last_seq + 1, rev = rev + 1, updated_at = ? WHERE id = ?", Date.now(), chatId);
    const c = get<{ last_seq: number; rev: number; user_id: string }>("SELECT last_seq, rev, user_id FROM super_chats WHERE id = ?", chatId);
    if (!c) throw notFound("That chat does not exist.");
    const now = Date.now();
    run("INSERT INTO super_rows (chat_id, seq, updated_seq, kind, body, created_at) VALUES (?, ?, ?, ?, ?, ?)", chatId, c.last_seq, c.rev, kind, JSON.stringify(body), now);
    return { userId: c.user_id, row: { chatId, seq: c.last_seq, updatedSeq: c.rev, kind, body, createdAt: now } as Row };
  });
  publish(row.userId, "row", row.row);
  return row.row;
}

/** Rewrites a row's body (merging fields) under a new updatedSeq. */
export function updateRow(chatId: string, seq: number, patch: Record<string, unknown>): Row | null {
  const out = tx(() => {
    const cur = get<RowRecord>("SELECT * FROM super_rows WHERE chat_id = ? AND seq = ?", chatId, seq);
    if (!cur) return null;
    run("UPDATE super_chats SET rev = rev + 1, updated_at = ? WHERE id = ?", Date.now(), chatId);
    const c = get<{ rev: number; user_id: string }>("SELECT rev, user_id FROM super_chats WHERE id = ?", chatId)!;
    const body = { ...parseJson<Record<string, unknown>>(cur.body, {}), ...patch };
    run("UPDATE super_rows SET body = ?, updated_seq = ? WHERE chat_id = ? AND seq = ?", JSON.stringify(body), c.rev, chatId, seq);
    return { userId: c.user_id, row: { ...toRow(cur), body, updatedSeq: c.rev } };
  });
  if (out) publish(out.userId, "row", out.row);
  return out?.row ?? null;
}

export function rowsAfter(chatId: string, after: number, limit: number): Row[] {
  return all<RowRecord>("SELECT * FROM super_rows WHERE chat_id = ? AND updated_seq > ? ORDER BY updated_seq LIMIT ?", chatId, after, limit).map(toRow);
}

export function getRow(chatId: string, seq: number): Row | null {
  const r = get<RowRecord>("SELECT * FROM super_rows WHERE chat_id = ? AND seq = ?", chatId, seq);
  return r ? toRow(r) : null;
}

/* ------------------------------ model history ------------------------------ */

export function llmHistory<T>(chatId: string): T[] {
  return all<{ message: string }>("SELECT message FROM super_llm WHERE chat_id = ? ORDER BY n", chatId).map((r) => parseJson<T>(r.message, null as T)).filter(Boolean);
}

export function pushLlm(chatId: string, message: unknown) {
  const n = get<{ n: number }>("SELECT COALESCE(MAX(n), 0) + 1 AS n FROM super_llm WHERE chat_id = ?", chatId)!.n;
  run("INSERT INTO super_llm (chat_id, n, message) VALUES (?, ?, ?)", chatId, n, JSON.stringify(message));
}
