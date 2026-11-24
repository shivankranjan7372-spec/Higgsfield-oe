import { balance } from "@/server/credits";
import { badRequest, intParam, readJson, route } from "@/server/http";
import { listJobs, submitJobs } from "@/server/jobs";

const KINDS = ["image", "video", "audio", "music"] as const;

/**
 * GET /api/jobs?status=active|all&kind=&surface=&limit=&before=
 * The member's generations, newest first, each with its results.
 */
export const GET = route(({ req, user }) => {
  const q = req.nextUrl.searchParams;
  const kind = KINDS.find((k) => k === q.get("kind"));
  if (q.get("kind") && !kind) throw badRequest("Unknown kind.");
  const jobs = listJobs(user.id, {
    status: q.get("status") === "active" ? "active" : "all",
    kind,
    surface: q.get("surface") ?? undefined,
    limit: intParam(req, "limit", 40, 1, 100),
    before: intParam(req, "before", 0, 0, Number.MAX_SAFE_INTEGER) || undefined,
  });
  return { jobs };
});

/**
 * POST /api/jobs  { modelId, prompt, values, inputs, count, surface?, meta? }
 * One press of Generate. Answers with the queued jobs and the balance after the hold.
 */
export const POST = route(async ({ req, user }) => {
  const jobs = submitJobs(user, await readJson(req));
  return { jobs, balance: balance(user.id) };
});
