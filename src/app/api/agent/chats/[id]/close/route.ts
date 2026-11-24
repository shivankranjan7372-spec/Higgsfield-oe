import { route } from "@/server/http";
import { closeChat } from "@/server/agent/chats";
import { ensureAgent } from "@/server/agent/loop";

/** POST /api/agent/chats/:id/close  An incognito chat is deleted when closed. */
export const POST = route<{ id: string }>(({ user, params }) => {
  ensureAgent();
  return closeChat(user.id, params.id);
});
