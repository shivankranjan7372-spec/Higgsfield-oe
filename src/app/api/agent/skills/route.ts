import { readJson, route } from "@/server/http";
import { readSkill } from "@/server/agent/input";
import { createSkill, listSkills } from "@/server/agent/library";

/** GET /api/agent/skills  Built-in skills first, then the member's own. */
export const GET = route(({ user }) => ({ skills: listSkills(user.id) }));

/** POST /api/agent/skills  { name, description?, instructions } */
export const POST = route(async ({ req, user }) => {
  const s = readSkill(await readJson(req), false);
  return { skill: createSkill(user.id, { name: s.name!, description: s.description ?? "", instructions: s.instructions! }) };
});
