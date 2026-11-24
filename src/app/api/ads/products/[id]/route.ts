import { readJson, route } from "@/server/http";
import { deleteProduct, ownedProduct, saveProduct, toProduct } from "@/server/ads/library";

/** GET /api/ads/products/:id */
export const GET = route<{ id: string }>(({ user, params }) => ({ product: toProduct(ownedProduct(user.id, params.id)) }));

/** PATCH /api/ads/products/:id — only the fields sent change. */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => ({ product: saveProduct(user.id, await readJson(req), params.id) }));

/** DELETE /api/ads/products/:id */
export const DELETE = route<{ id: string }>(({ user, params }) => {
  deleteProduct(user.id, params.id);
  return { ok: true };
});
