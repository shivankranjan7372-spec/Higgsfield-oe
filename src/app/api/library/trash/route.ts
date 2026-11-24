import { intParam, route } from "@/server/http";
import { emptyTrash, listTrash } from "@/server/library/trash";

/** GET /api/library/trash?limit=&cursor=  Deletes anything older than 30 days first. */
export const GET = route(({ req, user }) => ({ ...listTrash(user.id, intParam(req, "limit", 60, 1, 200), req.nextUrl.searchParams.get("cursor")) }));

/** DELETE /api/library/trash  Empties the trash for good. */
export const DELETE = route(({ user }) => ({ ok: true, ...emptyTrash(user.id) }));
