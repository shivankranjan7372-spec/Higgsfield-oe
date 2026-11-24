import { latestBatch, quoteBatch, startBatch } from "@/server/cinema/batch";
import { readJson, route } from "@/server/http";

/** GET /api/cinema/projects/:id/batch?modelId=  Price of every missing still, plus the latest batch. */
export const GET = route<{ id: string }>(({ req, user, params }) => {
  const modelId = req.nextUrl.searchParams.get("modelId") ?? undefined;
  return { quote: quoteBatch(user, params.id, modelId), batch: latestBatch(user.id, params.id) };
});

/** POST /api/cinema/projects/:id/batch  { modelId?, expectedTotal? }  Starts making every missing still. */
export const POST = route<{ id: string }>(async ({ req, user, params }) => ({ batch: startBatch(user, params.id, await readJson(req)) }));
