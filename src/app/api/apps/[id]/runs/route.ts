import { intParam, route } from "@/server/http";
import { listRuns } from "@/server/apps/service";

/** GET /api/apps/:id/runs?limit=&before=  The member's past runs of this app, newest first, with results. */
export const GET = route<{ id: string }>(({ req, user, params }) => ({
  runs: listRuns(user.id, params.id, intParam(req, "limit", 20, 1, 50), intParam(req, "before", 0, 0, Number.MAX_SAFE_INTEGER) || undefined),
}));
