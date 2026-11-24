import { NextResponse } from "next/server";
import { createWebhook, EVENTS, listWebhooks, MAX_WEBHOOKS } from "@/server/developer/webhooks";
import { readJson, route } from "@/server/http";

/** GET /api/developer/webhooks  The member's endpoints and the events they can choose. */
export const GET = route(({ user }) => ({ webhooks: listWebhooks(user.id), events: EVENTS, limit: MAX_WEBHOOKS }));

/** POST /api/developer/webhooks  { url, events?, description? }  Answers with `secret`, shown this once. */
export const POST = route(async ({ req, user }) => NextResponse.json(await createWebhook(user, await readJson(req)), { status: 201 }));
