import { publicUser } from "@/server/auth";
import { updateProfile } from "@/server/account/profile";
import { readJson, route } from "@/server/http";

/** GET /api/account/profile */
export const GET = route(({ user }) => ({ user: publicUser(user) }));

/** PATCH /api/account/profile  { name?, handle?, bio?, avatarAssetId? (null clears) } */
export const PATCH = route(async ({ req, user }) => {
  const body = await readJson(req);
  const next = updateProfile(user, { name: body.name, handle: body.handle, bio: body.bio, avatarAssetId: body.avatarAssetId });
  return { user: publicUser(next) };
});
