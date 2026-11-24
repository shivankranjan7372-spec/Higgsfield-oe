import { readJson, route } from "@/server/http";
import { publish } from "@/server/community/posts";
import { limit } from "@/server/community/shared";

/** POST /api/community/posts  { assetId, title?, description?, tags?, allowRecreate? }  Publishes a generated file. */
export const POST = route(async ({ req, user }) => {
  limit("publish", user.id);
  return { post: publish(user, await readJson(req)) };
});
