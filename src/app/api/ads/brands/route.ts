import { readJson, route } from "@/server/http";
import { listKits, saveKit } from "@/server/ads/library";

/** GET /api/ads/brands */
export const GET = route(({ user }) => ({ brandKits: listKits(user.id) }));

/** POST /api/ads/brands  { name, colors?, fonts?, tone?, logoAssetId?, wordsToUse?, wordsToAvoid? } */
export const POST = route(async ({ req, user }) => ({ brandKit: saveKit(user.id, await readJson(req)) }));
