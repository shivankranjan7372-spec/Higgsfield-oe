import { readJson, route } from "@/server/http";
import { deleteChat, patchChat } from "@/server/agent/chats";
import { readChatPatch } from "@/server/agent/input";
import { ensureAgent, listTurns } from "@/server/agent/loop";
import { ownedChat, toChat } from "@/server/agent/transcript";

/** GET /api/agent/chats/:id  The chat and its recent turns. Read rows from /rows. */
export const GET = route<{ id: string }>(({ user, params }) => {
  ensureAgent();
  return { chat: toChat(ownedChat(user.id, params.id)), turns: listTurns(user.id, params.id) };
});

/** PATCH /api/agent/chats/:id  { title?, pinned?, projectId?, skillIds? } */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  ensureAgent();
  return { chat: patchChat(user.id, params.id, readChatPatch(await readJson(req))) };
});

/** DELETE /api/agent/chats/:id  Stops any running turn and removes the chat with its transcript. */
export const DELETE = route<{ id: string }>(({ user, params }) => {
  ensureAgent();
  deleteChat(user.id, params.id);
  return { ok: true };
});
