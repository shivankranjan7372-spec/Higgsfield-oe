import { NextResponse } from "next/server";
import { apiRoute } from "@/server/developer/api";
import { createGeneration, listGenerations } from "@/server/developer/service";
import { balance } from "@/server/credits";
import { intParam, readJson } from "@/server/http";

/** GET /api/v1/generations?status=active|all&kind=&limit=&before= */
export const GET = apiRoute("listGenerations", ({ req, user }) => {
  const q = req.nextUrl.searchParams;
  return {
    generations: listGenerations(user.id, {
      status: q.get("status"),
      kind: q.get("kind"),
      limit: intParam(req, "limit", 20, 1, 100),
      before: intParam(req, "before", 0, 0, Number.MAX_SAFE_INTEGER) || undefined,
    }),
  };
});

/** POST /api/v1/generations  { modelId, prompt, values, inputs, count }  Header: Idempotency-Key (optional). */
export const POST = apiRoute("createGeneration", async ({ req, user, key, spent }) => {
  const body = await readJson(req);
  const r = createGeneration(user, key.id, body, { surface: "api", idempotencyKey: req.headers.get("idempotency-key") });
  spent(r.held);
  const res = NextResponse.json({ generations: r.generations, balance: balance(user.id) }, { status: r.replayed ? 200 : 201 });
  if (r.replayed) res.headers.set("Idempotent-Replayed", "true");
  return res;
});
