import { usage } from "@/server/account/usage";
import { intParam, route } from "@/server/http";

/** GET /api/billing/usage?days=30&tz=120   Credits spent per day, per kind and per model. */
export const GET = route(({ req, user }) => ({ usage: usage(user.id, intParam(req, "days", 30, 1, 366), intParam(req, "tz", 0, -840, 840)) }));
