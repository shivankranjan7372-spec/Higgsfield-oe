import { route } from "@/server/http";
import { sendTest } from "@/server/developer/webhooks";

/** POST /api/developer/webhooks/:id/test  Sends a `webhook.test` event now and answers with the delivery. */
export const POST = route<{ id: string }>(async ({ user, params }) => ({ delivery: await sendTest(user.id, params.id) }));
