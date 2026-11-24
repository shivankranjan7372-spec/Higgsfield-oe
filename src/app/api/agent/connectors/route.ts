import { ApiError, badRequest, route } from "@/server/http";
import { connectorClient, connections, listMcp } from "@/server/agent/connectors";

/** GET /api/agent/connectors?search=  The app catalog with this member's status, plus custom servers. */
export const GET = route(async ({ req, user }) => {
  const search = req.nextUrl.searchParams.get("search") ?? "";
  if (search.length > 100) throw badRequest("Search is too long.");
  let apps;
  try {
    apps = await connectorClient().catalog(search.trim());
  } catch {
    throw new ApiError(502, "connector_unavailable", "The app catalog is not loading right now. Try again soon.");
  }
  const mine = new Map(connections(user.id).map((c) => [c.app, c.status]));
  return {
    apps: apps.map((a) => ({ ...a, status: mine.get(a.slug) ?? "none" })),
    connected: connections(user.id),
    mcpServers: listMcp(user.id),
  };
});
