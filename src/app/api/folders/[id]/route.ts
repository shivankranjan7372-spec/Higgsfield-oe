import { readJson, route } from "@/server/http";
import { deleteFolder, folderName, getFolder, renameFolder } from "@/server/library/folders";

export const GET = route<{ id: string }>(({ user, params }) => ({ folder: getFolder(user.id, params.id) }));

/** PATCH /api/folders/:id  { name } */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  const body = await readJson(req);
  return { folder: renameFolder(user.id, params.id, folderName(body.name)) };
});

/** DELETE /api/folders/:id  Its files go back to "no folder". */
export const DELETE = route<{ id: string }>(({ user, params }) => ({ ok: true, ...deleteFolder(user.id, params.id) }));
