import { badRequest, readJson, route } from "@/server/http";
import { copyWriter } from "@/server/ads/copy";
import { kitData, ownedKit, ownedProduct, productData } from "@/server/ads/library";

/**
 * POST /api/ads/copy  { productId, brandKitId?, count?, seconds? }
 * Headlines, captions and calls to action, plus a spoken script. Template-based for now.
 */
export const POST = route(async ({ req, user }) => {
  const body = await readJson(req);
  if (typeof body.productId !== "string") throw badRequest("Pick a product first.");
  const product = ownedProduct(user.id, body.productId.slice(0, 80));
  const kitId = body.brandKitId ?? product.brand_kit_id;
  const brand = kitId == null ? null : kitData(ownedKit(user.id, String(kitId).slice(0, 80)));
  const count = body.count == null ? 3 : Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > 10) throw badRequest("Ask for between 1 and 10 options.");
  const seconds = body.seconds == null ? 15 : Number(body.seconds);
  if (!Number.isFinite(seconds) || seconds < 5 || seconds > 60) throw badRequest("Pick a script length between 5 and 60 seconds.");
  const writer = copyWriter();
  const data = productData(product);
  const options = Array.from({ length: count }, (_, i) => writer.write({ product: data, brand, seed: i + 1 }));
  return { writer: writer.kind, copy: options, script: writer.script({ product: data, brand, seed: 1 }, seconds) };
});
