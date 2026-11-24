import type { Scope } from "./keys";

/**
 * The one table of public API routes. The route files look their entry up by id
 * (`apiRoute("listModels", ...)`), and `openapi.ts` builds the OpenAPI document from
 * it, so the served spec and the real routes cannot drift apart.
 */

type Schema = Record<string, unknown>;

export interface RouteSpec {
  method: "GET" | "POST";
  /** OpenAPI path template, relative to /api. */
  path: string;
  scope: Scope;
  summary: string;
  description?: string;
  query?: { name: string; schema: Schema; description: string }[];
  /** `json` body schema, or `multipart` for uploads. */
  body?: { json: Schema } | { multipart: Schema };
  /** Extra request headers worth documenting. */
  headers?: { name: string; description: string }[];
  /** Name of a component schema the 200 answer uses. */
  response: Schema;
  /** True when the 200 answer is the raw file rather than JSON. */
  binary?: boolean;
}

const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const str = (description: string, extra: Schema = {}): Schema => ({ type: "string", description, ...extra });
const int = (description: string, extra: Schema = {}): Schema => ({ type: "integer", description, ...extra });
const obj = (properties: Record<string, Schema>, required: string[] = []): Schema => ({ type: "object", properties, required });
const list = (key: string, item: string, more: Record<string, Schema> = {}) => obj({ [key]: { type: "array", items: ref(item) }, ...more }, [key]);
const pageQuery = (max: number) => [
  { name: "limit", schema: { type: "integer", minimum: 1, maximum: max }, description: `Page size, 1 to ${max}.` },
  { name: "before", schema: { type: "integer" }, description: "The `cursor` of the last item of the previous page." },
];

const draft = obj(
  {
    modelId: str("A model id from GET /v1/models."),
    prompt: str("The prompt. Required when the model's `prompt.required` is true."),
    values: { type: "object", description: "Control values by control id. Missing or invalid values fall back to the control's default.", additionalProperties: true },
    inputs: { type: "object", description: "Media slots: `{ slotId: [fileId, ...] }`. Files must belong to the key's owner.", additionalProperties: { type: "array", items: { type: "string" } } },
    count: int("How many results. Clamped to the model's `batch.max`."),
  },
  ["modelId"],
);

export const ROUTES = {
  listModels: {
    method: "GET",
    path: "/v1/models",
    scope: "read",
    summary: "List models",
    query: [
      { name: "kind", schema: { type: "string", enum: ["image", "video", "audio", "music"] }, description: "Only models of this kind." },
      { name: "available", schema: { type: "string", enum: ["1"] }, description: "Only models that can run right now." },
    ],
    response: list("models", "ModelSummary"),
  },
  getModel: {
    method: "GET",
    path: "/v1/models/{id}",
    scope: "read",
    summary: "One model with its controls and media slots",
    response: obj({ model: ref("Model") }, ["model"]),
  },
  quote: {
    method: "POST",
    path: "/v1/quote",
    scope: "read",
    summary: "Price a draft without running it",
    description: "Same body as POST /v1/generations. Nothing is queued and no credits move. File ids in `inputs` are only counted.",
    body: { json: draft },
    response: ref("Quote"),
  },
  createGeneration: {
    method: "POST",
    path: "/v1/generations",
    scope: "generate",
    summary: "Start a generation",
    description: "Validates, prices and queues the draft, holding its credits. Returns one generation per result unless the model returns several results per call.",
    body: { json: draft },
    headers: [{ name: "Idempotency-Key", description: "Up to 200 characters. Repeating a request with the same key within 24 hours returns the first answer instead of starting again." }],
    response: list("generations", "Generation", { balance: int("Balance after the hold, in millicredits.") }),
  },
  listGenerations: {
    method: "GET",
    path: "/v1/generations",
    scope: "read",
    summary: "List generations, newest first",
    query: [
      { name: "status", schema: { type: "string", enum: ["active", "all"] }, description: "`active` is queued and running only." },
      { name: "kind", schema: { type: "string", enum: ["image", "video", "audio", "music"] }, description: "Only this kind." },
      ...pageQuery(100),
    ],
    response: list("generations", "Generation"),
  },
  getGeneration: {
    method: "GET",
    path: "/v1/generations/{id}",
    scope: "read",
    summary: "One generation with its result files",
    response: obj({ generation: ref("Generation") }, ["generation"]),
  },
  cancelGeneration: {
    method: "POST",
    path: "/v1/generations/{id}/cancel",
    scope: "generate",
    summary: "Cancel a queued generation and return its credits",
    response: obj({ generation: ref("Generation"), balance: int("Balance after the refund, in millicredits.") }, ["generation", "balance"]),
  },
  uploadFile: {
    method: "POST",
    path: "/v1/files",
    scope: "generate",
    summary: "Upload a file to use as an input",
    body: { multipart: obj({ file: { type: "string", format: "binary" } }, ["file"]) },
    response: obj({ file: ref("File") }, ["file"]),
  },
  listFiles: {
    method: "GET",
    path: "/v1/files",
    scope: "read",
    summary: "List files, newest first",
    query: [
      { name: "kind", schema: { type: "string", enum: ["image", "video", "audio"] }, description: "Only this kind." },
      { name: "source", schema: { type: "string", enum: ["generated", "upload"] }, description: "Only generated or only uploaded files." },
      ...pageQuery(200),
    ],
    response: list("files", "File"),
  },
  getFile: {
    method: "GET",
    path: "/v1/files/{id}",
    scope: "read",
    summary: "One file's record",
    response: obj({ file: ref("File") }, ["file"]),
  },
  getFileContent: {
    method: "GET",
    path: "/v1/files/{id}/content",
    scope: "read",
    summary: "The file's bytes. Honours Range.",
    response: { type: "string", format: "binary" },
    binary: true,
  },
  getBalance: {
    method: "GET",
    path: "/v1/balance",
    scope: "read",
    summary: "Credit balance and plan",
    response: obj({ balance: int("Millicredits."), credits: str("The balance formatted in whole credits."), plan: obj({ id: str("Plan id"), name: str("Plan name"), concurrency: int("Generations that may run at once.") }) }),
  },
} satisfies Record<string, RouteSpec>;

export type RouteId = keyof typeof ROUTES;
