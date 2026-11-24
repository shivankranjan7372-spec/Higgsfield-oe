import { balance } from "@/server/credits";
import { route } from "@/server/http";
import { getJob, removeJob } from "@/server/jobs";

export const GET = route<{ id: string }>(({ user, params }) => ({ job: getJob(user.id, params.id) }));

/** Cancels a queued job (credits come back), or removes a finished one with its results. */
export const DELETE = route<{ id: string }>(({ user, params }) => {
  removeJob(user.id, params.id);
  return { ok: true, balance: balance(user.id) };
});
