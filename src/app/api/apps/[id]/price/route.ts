import { publicRoute, readJson } from "@/server/http";
import { priceForm } from "@/server/apps/service";

/** POST /api/apps/:id/price  { fields?, values?, inputs?, count? }  The price of the form as filled so far. */
export const POST = publicRoute<{ id: string }>(async ({ req, params }) => priceForm(params.id, await readJson(req)));
