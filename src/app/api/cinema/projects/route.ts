import { createProject, listProjects, toProject } from "@/server/cinema/store";
import { readJson, route } from "@/server/http";

/** GET /api/cinema/projects */
export const GET = route(({ user }) => ({ projects: listProjects(user.id) }));

/** POST /api/cinema/projects  { title, logline?, aspect?, look?, stillModelId?, videoModelId? } */
export const POST = route(async ({ req, user }) => ({ project: toProject(createProject(user.id, await readJson(req))) }));
