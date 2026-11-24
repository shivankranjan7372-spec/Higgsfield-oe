import { readJson, route } from "@/server/http";
import { addMcp, listMcp } from "@/server/agent/connectors";
import { text } from "@/server/agent/util";

/** GET /api/agent/connectors/mcp */
export const GET = route(({ user }) => ({ servers: listMcp(user.id) }));

/** POST /api/agent/connectors/mcp  { name, url }  Stored only; Parallax does not call it yet. */
export const POST = route(async ({ req, user }) => {
  const body = await readJson(req);
  return { server: addMcp(user.id, text(body.name, "Name", 60, { required: true }), text(body.url, "Address", 500, { required: true })) };
});
