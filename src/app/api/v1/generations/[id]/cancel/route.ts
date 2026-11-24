import { apiRoute } from "@/server/developer/api";
import { cancelGeneration } from "@/server/developer/service";

/** POST /api/v1/generations/:id/cancel  Queued only; the held credits come back. */
export const POST = apiRoute<{ id: string }>("cancelGeneration", ({ user, params }) => cancelGeneration(user.id, params.id));
