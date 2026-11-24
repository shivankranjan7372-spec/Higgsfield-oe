import { readJson, route } from "@/server/http";
import { bulk } from "@/server/library/bulk";

/** POST /api/library/bulk  { action: favorite|move|trash|restore|delete, ids, favorite?, folderId? } */
export const POST = route(async ({ req, user }) => ({ ok: true, ...bulk(user.id, await readJson(req)) }));
