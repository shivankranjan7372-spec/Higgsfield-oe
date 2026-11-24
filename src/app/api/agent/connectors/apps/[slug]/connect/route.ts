import { route } from "@/server/http";
import { publicOrigin } from "@/server/origin";
import { requireAgentAccess } from "@/server/agent/config";
import { startConnect } from "@/server/agent/connectors";

/** POST /api/agent/connectors/apps/:slug/connect  Answers with the sign-in link to open. */
export const POST = route<{ slug: string }>(async ({ req, user, params }) => {
  requireAgentAccess(user);
  return startConnect(user.id, params.slug, publicOrigin(req));
});
