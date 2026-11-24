import { route } from "@/server/http";
import { finishConnect } from "@/server/agent/connectors";

/**
 * GET /api/agent/connectors/apps/:slug/callback?connected_account_id=
 * Where the sign-in page sends the member back. Also usable as "check status".
 */
export const GET = route<{ slug: string }>(async ({ req, user, params }) => {
  const returned = req.nextUrl.searchParams.get("connected_account_id");
  return { connection: await finishConnect(user.id, params.slug, returned && returned.length <= 100 ? returned : null) };
});
