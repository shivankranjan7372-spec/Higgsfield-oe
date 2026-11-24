import "server-only";

import { all, run } from "@/server/db";
import { badRequest } from "@/server/errors";
import { publish } from "./hub";
import { ownedProject, usableSkills } from "./library";
import { stopChat } from "./loop";
import { createChat, ownedChat, publishChat, toChat, type Chat, type ChatRow } from "./transcript";
import { limits } from "./config";

/** Chat list operations: create, list, rename, pin, attach, delete, close. */

export interface ChatFilter {
  projectId?: string;
  pinned?: boolean;
  search?: string;
  limit: number;
  /** An `updatedAt` from the previous page. */
  before?: number;
}

export function listChats(userId: string, f: ChatFilter): Chat[] {
  const where = ["user_id = ?"];
  const params: (string | number)[] = [userId];
  if (f.projectId) {
    where.push("project_id = ?");
    params.push(f.projectId);
  }
  if (f.pinned) where.push("pinned = 1");
  if (f.search) {
    where.push("title LIKE ? ESCAPE '\\'");
    params.push(`%${f.search.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
  }
  if (f.before) {
    where.push("updated_at < ?");
    params.push(f.before);
  }
  return all<ChatRow>(`SELECT * FROM super_chats WHERE ${where.join(" AND ")} ORDER BY pinned DESC, updated_at DESC LIMIT ?`, ...params, f.limit).map(toChat);
}

export function newChat(userId: string, input: { title: string; projectId: string | null; skillIds: string[]; incognito: boolean }): Chat {
  if (all("SELECT 1 FROM super_chats WHERE user_id = ? LIMIT ?", userId, limits.maxChats).length >= limits.maxChats) {
    throw badRequest(`You have ${limits.maxChats} chats. Delete some to start new ones.`);
  }
  if (input.projectId) ownedProject(userId, input.projectId);
  usableSkills(userId, input.skillIds);
  if (input.incognito && input.projectId) throw badRequest("Incognito chats cannot belong to a project.");
  return createChat(userId, input);
}

export function patchChat(userId: string, id: string, patch: { title?: string; pinned?: boolean; projectId?: string | null; skillIds?: string[] }): Chat {
  const cur = ownedChat(userId, id);
  if (patch.projectId) {
    ownedProject(userId, patch.projectId);
    if (cur.incognito) throw badRequest("Incognito chats cannot belong to a project.");
  }
  if (patch.skillIds) usableSkills(userId, patch.skillIds);
  run(
    "UPDATE super_chats SET title = ?, pinned = ?, project_id = ?, skill_ids = ?, updated_at = ? WHERE id = ?",
    patch.title ?? cur.title,
    patch.pinned == null ? cur.pinned : patch.pinned ? 1 : 0,
    patch.projectId === undefined ? cur.project_id : patch.projectId,
    patch.skillIds ? JSON.stringify(patch.skillIds) : cur.skill_ids,
    Date.now(),
    id,
  );
  publishChat(id);
  return toChat(ownedChat(userId, id));
}

export function deleteChat(userId: string, id: string) {
  ownedChat(userId, id);
  stopChat(userId, id);
  run("DELETE FROM super_approvals WHERE chat_id = ?", id);
  run("DELETE FROM super_turns WHERE chat_id = ?", id);
  run("DELETE FROM super_chats WHERE id = ?", id); // rows and model history go with it
  run("UPDATE super_schedules SET chat_id = NULL WHERE chat_id = ? AND user_id = ?", id, userId);
  publish(userId, "chat-deleted", { chatId: id });
}

/** Closing an incognito chat deletes it; closing any other chat changes nothing. */
export function closeChat(userId: string, id: string): { deleted: boolean } {
  const cur = ownedChat(userId, id);
  if (cur.incognito !== 1) return { deleted: false };
  deleteChat(userId, id);
  return { deleted: true };
}
