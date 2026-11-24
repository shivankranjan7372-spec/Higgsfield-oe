import { readJson, route } from "@/server/http";
import { listChats } from "@/server/agent/chats";
import { readProject } from "@/server/agent/input";
import { deleteProject, getProject, updateProject } from "@/server/agent/library";

/** GET /api/agent/projects/:id  The project and its chats. */
export const GET = route<{ id: string }>(({ user, params }) => ({
  project: getProject(user.id, params.id),
  chats: listChats(user.id, { projectId: params.id, limit: 200 }),
}));

/** PATCH /api/agent/projects/:id  { name?, instructions?, fileIds? } */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => ({
  project: updateProject(user.id, params.id, readProject(await readJson(req), true)),
}));

/** DELETE /api/agent/projects/:id  Its chats stay, outside any project. */
export const DELETE = route<{ id: string }>(({ user, params }) => {
  deleteProject(user.id, params.id);
  return { ok: true };
});
