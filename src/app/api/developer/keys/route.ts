import { NextResponse } from "next/server";
import { createKey, listKeys, MAX_KEYS, SCOPES } from "@/server/developer/keys";
import { readJson, route } from "@/server/http";

/** GET /api/developer/keys  The member's keys, active first. Never includes the key itself. */
export const GET = route(({ user }) => ({ keys: listKeys(user.id), limit: MAX_KEYS, scopes: SCOPES }));

/** POST /api/developer/keys  { name?, scopes? }  Answers with `secret`, the key itself, shown this once. */
export const POST = route(async ({ req, user }) => NextResponse.json(createKey(user, await readJson(req)), { status: 201 }));
