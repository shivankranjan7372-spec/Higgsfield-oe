import { readJson, route } from "@/server/http";
import { readProject } from "@/server/agent/input";
import { createProject, listProjects } from "@/server/agent/library";

/** GET /api/agent/projects */
export const GET = route(({ user }) => ({ projects: listProjects(user.id) }));

/** POST /api/agent/projects  { name, instructions?, fileIds? } */
export const POST = route(async ({ req, user }) => {
  const p = readProject(await readJson(req), false);
  return { project: createProject(user.id, { name: p.name!, instructions: p.instructions ?? "", fileIds: p.fileIds ?? [] }) };
});
