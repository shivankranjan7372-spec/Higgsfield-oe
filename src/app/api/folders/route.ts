import { readJson, route } from "@/server/http";
import { createFolder, folderName, listFolders } from "@/server/library/folders";

/** GET /api/folders  Every folder with its file count, plus how many files have no folder. */
export const GET = route(({ user }) => listFolders(user.id));

/** POST /api/folders  { name } */
export const POST = route(async ({ req, user }) => {
  const body = await readJson(req);
  return { folder: createFolder(user.id, folderName(body.name)) };
});
