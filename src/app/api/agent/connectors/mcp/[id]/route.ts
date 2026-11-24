import { route } from "@/server/http";
import { removeMcp } from "@/server/agent/connectors";

/** DELETE /api/agent/connectors/mcp/:id */
export const DELETE = route<{ id: string }>(({ user, params }) => {
  removeMcp(user.id, params.id);
  return { ok: true };
});
