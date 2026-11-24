import { route } from "@/server/http";
import { ensureAgent, stopChat } from "@/server/agent/loop";

/** POST /api/agent/chats/:id/stop  Stops the running turn and drops queued ones. */
export const POST = route<{ id: string }>(({ user, params }) => {
  ensureAgent();
  return stopChat(user.id, params.id);
});
