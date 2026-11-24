import { planTake, quotePlan } from "@/server/cinema/takes";
import { route } from "@/server/http";

/** GET /api/cinema/shots/:id/compose?mode=still|animate|text&modelId=&fromTakeId=&count=  What Generate would send, and its price. */
export const GET = route<{ id: string }>(({ req, user, params }) => {
  const q = req.nextUrl.searchParams;
  const body: Record<string, unknown> = { mode: q.get("mode") ?? undefined, modelId: q.get("modelId") ?? undefined, fromTakeId: q.get("fromTakeId") ?? undefined };
  const plan = planTake(user.id, params.id, body);
  const count = Math.min(4, Math.max(1, Math.floor(Number(q.get("count") ?? 1)) || 1));
  const price = quotePlan(plan, count);
  return { ...plan.composed, values: price.values, sourceTakeId: plan.sourceTakeId, price: { total: price.millicredits, perTake: price.perJob, takes: price.jobs } };
});
