import { apiRoute } from "@/server/developer/api";
import { quoteDraft } from "@/server/developer/service";
import { readJson } from "@/server/http";

/** POST /api/v1/quote  { modelId, prompt, values, inputs, count }  Prices a draft; nothing runs. */
export const POST = apiRoute("quote", async ({ req, user }) => quoteDraft(user, await readJson(req)));
