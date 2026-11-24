import { apiRoute } from "@/server/developer/api";
import { getGeneration } from "@/server/developer/service";

/** GET /api/v1/generations/:id */
export const GET = apiRoute<{ id: string }>("getGeneration", ({ user, params }) => ({ generation: getGeneration(user.id, params.id) }));
