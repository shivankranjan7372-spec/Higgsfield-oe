import { ownedAsset, patchAsset, removeAsset, toAsset, type AssetPatch } from "@/server/assets";
import { badRequest, readJson, route } from "@/server/http";

export const GET = route<{ id: string }>(({ user, params }) => ({ asset: toAsset(ownedAsset(user.id, params.id)) }));

/** PATCH /api/assets/:id  { title?, favorite?, folderId?, isPublic? } */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  const body = await readJson(req);
  const patch: AssetPatch = {};
  if (body.title !== undefined) {
    if (typeof body.title !== "string") throw badRequest("The title must be text.");
    patch.title = body.title;
  }
  if (body.favorite !== undefined) patch.favorite = body.favorite === true;
  if (body.isPublic !== undefined) patch.isPublic = body.isPublic === true;
  if (body.folderId !== undefined) {
    if (body.folderId !== null && typeof body.folderId !== "string") throw badRequest("Unknown folder.");
    patch.folderId = body.folderId;
  }
  return { asset: toAsset(patchAsset(user.id, params.id, patch)) };
});

export const DELETE = route<{ id: string }>(({ user, params }) => {
  removeAsset(user.id, params.id);
  return { ok: true };
});
