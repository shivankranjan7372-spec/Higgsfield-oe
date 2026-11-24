import { apiRoute } from "@/server/developer/api";
import { getFile } from "@/server/developer/service";

/** GET /api/v1/files/:id */
export const GET = apiRoute<{ id: string }>("getFile", ({ user, params }) => ({ file: getFile(user.id, params.id) }));
