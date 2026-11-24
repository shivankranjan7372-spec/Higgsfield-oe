import { route } from "@/server/http";
import { disconnect } from "@/server/agent/connectors";

/** POST /api/agent/connectors/apps/:slug/disconnect */
export const POST = route<{ slug: string }>(async ({ user, params }) => {
  await disconnect(user.id, params.slug);
  return { ok: true };
});
