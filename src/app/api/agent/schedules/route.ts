import { readJson, route } from "@/server/http";
import { ensureAgent } from "@/server/agent/loop";
import { checkInterval, createSchedule, listSchedules } from "@/server/agent/schedules";
import { text } from "@/server/agent/util";

/** GET /api/agent/schedules */
export const GET = route(({ user }) => {
  ensureAgent();
  return { schedules: listSchedules(user.id) };
});

/** POST /api/agent/schedules  { title, prompt, intervalMinutes, runNow? } */
export const POST = route(async ({ req, user }) => {
  ensureAgent();
  const body = await readJson(req);
  return {
    schedule: createSchedule(user.id, {
      title: text(body.title, "Title", 80, { required: true }),
      prompt: text(body.prompt, "Prompt", 4_000, { required: true }),
      intervalMinutes: checkInterval(body.intervalMinutes),
      firstRunAt: body.runNow === true ? Date.now() : undefined,
    }),
  };
});
