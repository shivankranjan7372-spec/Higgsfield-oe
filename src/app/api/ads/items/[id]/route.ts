import { badRequest, readJson, route } from "@/server/http";
import { setWinner } from "@/server/ads/campaigns";

/** PATCH /api/ads/items/:id  { winner: boolean } */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  const body = await readJson(req);
  if (typeof body.winner !== "boolean") throw badRequest("Say whether this ad is a winner.");
  return { item: setWinner(user.id, params.id, body.winner) };
});
