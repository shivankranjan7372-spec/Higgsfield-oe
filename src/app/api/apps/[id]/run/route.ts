import { balance } from "@/server/credits";
import { readJson, route } from "@/server/http";
import { runApp } from "@/server/apps/service";

/**
 * POST /api/apps/:id/run  { fields, values?, inputs, count? }
 * One press of Run. Answers with the run, its queued jobs and the balance after the hold.
 */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const run = runApp(user, params.id, await readJson(req));
  return { run, jobs: run.jobs, balance: balance(user.id) };
});
