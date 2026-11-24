import { intParam, route } from "@/server/http";
import { listDeliveries } from "@/server/developer/webhooks";

/** GET /api/developer/webhooks/:id/deliveries?limit=&before=  The delivery log, newest first. */
export const GET = route<{ id: string }>(({ req, user, params }) => ({
  deliveries: listDeliveries(user.id, params.id, intParam(req, "limit", 30, 1, 100), intParam(req, "before", 0, 0, Number.MAX_SAFE_INTEGER) || undefined),
}));
