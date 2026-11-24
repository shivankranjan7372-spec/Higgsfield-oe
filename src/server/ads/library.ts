import "server-only";

import { assetById } from "@/server/assets";
import { all, get, newId, parseJson, run } from "@/server/db";
import { badRequest, notFound } from "@/server/errors";
import { has, link, ownImage, text, textList } from "./fields";
import type { BrandColor, BrandData, ProductData } from "./types";

/**
 * Brand kits and products: what a member describes once and reuses in every campaign.
 * Every query filters by user_id; someone else's id answers 404.
 */

const MAX_KITS = 50;
const MAX_PRODUCTS = 200;

/* -------------------------------- brand kits ------------------------------- */

interface KitRow {
  id: string;
  user_id: string;
  name: string;
  colors: string;
  fonts: string;
  tone: string;
  logo_asset_id: string | null;
  words_use: string;
  words_avoid: string;
  created_at: number;
  updated_at: number;
}

/** A file link, or null when the image has since been deleted. */
function imageRef(id: string | null) {
  if (!id) return null;
  const row = assetById(id);
  return row ? { assetId: id, url: `/api/assets/${id}/file` } : null;
}

export function kitData(r: KitRow): BrandData {
  const fonts = parseJson<{ heading?: string; body?: string }>(r.fonts, {});
  return {
    name: r.name,
    colors: parseJson<BrandColor[]>(r.colors, []),
    fonts: { heading: fonts.heading ?? "", body: fonts.body ?? "" },
    tone: r.tone,
    wordsToUse: parseJson<string[]>(r.words_use, []),
    wordsToAvoid: parseJson<string[]>(r.words_avoid, []),
  };
}

export function toKit(r: KitRow) {
  return { id: r.id, ...kitData(r), logo: imageRef(r.logo_asset_id), createdAt: r.created_at, updatedAt: r.updated_at };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function readColors(raw: unknown): BrandColor[] {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > 12) throw badRequest("Use at most 12 colours.");
  return raw.map((c) => {
    const hex = typeof c === "string" ? c : c && typeof c === "object" ? (c as Record<string, unknown>).hex : null;
    const name = c && typeof c === "object" ? (c as Record<string, unknown>).name : "";
    if (typeof hex !== "string" || !HEX.test(hex)) throw badRequest("Write each colour as a hex code like #1A2B3C.");
    if (name != null && typeof name !== "string") throw badRequest("Colour names must be text.");
    return { name: String(name ?? "").trim().slice(0, 40), hex: hex.toUpperCase() };
  });
}

function readFonts(raw: unknown): { heading: string; body: string } {
  if (raw == null) return { heading: "", body: "" };
  if (typeof raw !== "object" || Array.isArray(raw)) throw badRequest("Fonts must look like { heading, body }.");
  const r = raw as Record<string, unknown>;
  return { heading: text(r, "heading", "the heading font", 60), body: text(r, "body", "the body font", 60) };
}

export function ownedKit(userId: string, id: string): KitRow {
  const row = get<KitRow>("SELECT * FROM ad_brand_kits WHERE id = ? AND user_id = ?", id, userId);
  if (!row) throw notFound("That brand kit does not exist.");
  return row;
}

export function listKits(userId: string) {
  return all<KitRow>("SELECT * FROM ad_brand_kits WHERE user_id = ? ORDER BY created_at DESC", userId).map(toKit);
}

/** Creates a kit, or (with `id`) changes only the fields present in the body. */
export function saveKit(userId: string, body: Record<string, unknown>, id?: string) {
  const old = id ? ownedKit(userId, id) : null;
  if (!old && get<{ n: number }>("SELECT COUNT(*) AS n FROM ad_brand_kits WHERE user_id = ?", userId)!.n >= MAX_KITS) {
    throw badRequest(`You can keep up to ${MAX_KITS} brand kits. Delete one first.`);
  }
  const pick = <T>(key: string, read: () => T, fallback: T): T => (!old || has(body, key) ? read() : fallback);
  const name = pick("name", () => text(body, "name", "a brand name", 80, true), old?.name ?? "");
  const colors = pick("colors", () => JSON.stringify(readColors(body.colors)), old?.colors ?? "[]");
  const fonts = pick("fonts", () => JSON.stringify(readFonts(body.fonts)), old?.fonts ?? "{}");
  const tone = pick("tone", () => text(body, "tone", "the tone of voice", 300), old?.tone ?? "");
  const logo = pick("logoAssetId", () => (body.logoAssetId == null ? null : ownImage(userId, body.logoAssetId, "the logo")), old?.logo_asset_id ?? null);
  const use = pick("wordsToUse", () => JSON.stringify(textList(body, "wordsToUse", "words to use", 30, 40)), old?.words_use ?? "[]");
  const avoid = pick("wordsToAvoid", () => JSON.stringify(textList(body, "wordsToAvoid", "words to avoid", 30, 40)), old?.words_avoid ?? "[]");
  const now = Date.now();
  if (old) {
    run("UPDATE ad_brand_kits SET name = ?, colors = ?, fonts = ?, tone = ?, logo_asset_id = ?, words_use = ?, words_avoid = ?, updated_at = ? WHERE id = ? AND user_id = ?",
      name, colors, fonts, tone, logo, use, avoid, now, old.id, userId);
    return toKit(ownedKit(userId, old.id));
  }
  const newKit = newId("abk");
  run("INSERT INTO ad_brand_kits (id, user_id, name, colors, fonts, tone, logo_asset_id, words_use, words_avoid, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    newKit, userId, name, colors, fonts, tone, logo, use, avoid, now, now);
  return toKit(ownedKit(userId, newKit));
}

export function deleteKit(userId: string, id: string) {
  ownedKit(userId, id);
  run("DELETE FROM ad_brand_kits WHERE id = ? AND user_id = ?", id, userId);
  // Products and campaigns keep working without a kit.
  run("UPDATE ad_products SET brand_kit_id = NULL WHERE brand_kit_id = ? AND user_id = ?", id, userId);
  run("UPDATE ad_campaigns SET brand_kit_id = NULL WHERE brand_kit_id = ? AND user_id = ?", id, userId);
}

/* --------------------------------- products -------------------------------- */

interface ProductRow {
  id: string;
  user_id: string;
  brand_kit_id: string | null;
  name: string;
  description: string;
  benefits: string;
  audience: string;
  price: string;
  link: string;
  image_ids: string;
  created_at: number;
  updated_at: number;
}

export function productData(r: ProductRow): ProductData {
  return { name: r.name, description: r.description, benefits: parseJson<string[]>(r.benefits, []), audience: r.audience, price: r.price, link: r.link };
}

/** Image ids that still exist and still belong to the member. */
export function productImages(r: ProductRow): string[] {
  return parseJson<string[]>(r.image_ids, []).filter((id) => {
    const a = assetById(id);
    return a && a.user_id === r.user_id && a.kind === "image";
  });
}

export function toProduct(r: ProductRow) {
  return {
    id: r.id,
    brandKitId: r.brand_kit_id,
    ...productData(r),
    images: productImages(r).map((id) => ({ assetId: id, url: `/api/assets/${id}/file` })),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function ownedProduct(userId: string, id: string): ProductRow {
  const row = get<ProductRow>("SELECT * FROM ad_products WHERE id = ? AND user_id = ?", id, userId);
  if (!row) throw notFound("That product does not exist.");
  return row;
}

export function listProducts(userId: string, brandKitId?: string | null) {
  const rows = brandKitId
    ? all<ProductRow>("SELECT * FROM ad_products WHERE user_id = ? AND brand_kit_id = ? ORDER BY created_at DESC", userId, brandKitId)
    : all<ProductRow>("SELECT * FROM ad_products WHERE user_id = ? ORDER BY created_at DESC", userId);
  return rows.map(toProduct);
}

export function saveProduct(userId: string, body: Record<string, unknown>, id?: string) {
  const old = id ? ownedProduct(userId, id) : null;
  if (!old && get<{ n: number }>("SELECT COUNT(*) AS n FROM ad_products WHERE user_id = ?", userId)!.n >= MAX_PRODUCTS) {
    throw badRequest(`You can keep up to ${MAX_PRODUCTS} products. Delete one first.`);
  }
  const pick = <T>(key: string, read: () => T, fallback: T): T => (!old || has(body, key) ? read() : fallback);
  const name = pick("name", () => text(body, "name", "a product name", 80, true), old?.name ?? "");
  const description = pick("description", () => text(body, "description", "the description", 600), old?.description ?? "");
  const benefits = pick("benefits", () => JSON.stringify(textList(body, "benefits", "key benefits", 8, 120)), old?.benefits ?? "[]");
  const audience = pick("audience", () => text(body, "audience", "the audience", 200), old?.audience ?? "");
  const price = pick("price", () => text(body, "price", "the price", 40), old?.price ?? "");
  const url = pick("link", () => link(body, "link"), old?.link ?? "");
  const kit = pick("brandKitId", () => (body.brandKitId == null ? null : ownedKit(userId, String(body.brandKitId).slice(0, 80)).id), old?.brand_kit_id ?? null);
  const images = pick(
    "imageIds",
    () => {
      const raw = body.imageIds ?? [];
      if (!Array.isArray(raw) || raw.length > 8) throw badRequest("Add up to 8 product images.");
      return JSON.stringify([...new Set(raw.map((x) => ownImage(userId, x, "each product image")))]);
    },
    old?.image_ids ?? "[]",
  );
  const now = Date.now();
  if (old) {
    run("UPDATE ad_products SET brand_kit_id = ?, name = ?, description = ?, benefits = ?, audience = ?, price = ?, link = ?, image_ids = ?, updated_at = ? WHERE id = ? AND user_id = ?",
      kit, name, description, benefits, audience, price, url, images, now, old.id, userId);
    return toProduct(ownedProduct(userId, old.id));
  }
  const pid = newId("apr");
  run("INSERT INTO ad_products (id, user_id, brand_kit_id, name, description, benefits, audience, price, link, image_ids, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    pid, userId, kit, name, description, benefits, audience, price, url, images, now, now);
  return toProduct(ownedProduct(userId, pid));
}

export function deleteProduct(userId: string, id: string) {
  ownedProduct(userId, id);
  run("DELETE FROM ad_products WHERE id = ? AND user_id = ?", id, userId);
  run("UPDATE ad_campaigns SET product_id = NULL WHERE product_id = ? AND user_id = ?", id, userId);
}
