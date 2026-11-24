import { ROUTES, type RouteSpec } from "./routes";

/** Builds the OpenAPI 3.1 document from the route table in `routes.ts`. */

type Schema = Record<string, unknown>;
const t = (type: string, description?: string, extra: Schema = {}): Schema => ({ type, ...(description ? { description } : {}), ...extra });
const nullable = (type: string, description?: string): Schema => ({ type: [type, "null"], ...(description ? { description } : {}) });

const FILE: Schema = {
  type: "object",
  properties: {
    id: t("string"),
    kind: t("string", "image | video | audio"),
    source: t("string", "generated | upload"),
    mime: t("string"),
    bytes: t("integer"),
    width: nullable("integer"),
    height: nullable("integer"),
    duration: nullable("number", "Seconds"),
    title: t("string"),
    generationId: nullable("string"),
    url: t("string", "Path of the bytes: /api/v1/files/{id}/content. Send the same key."),
    createdAt: t("integer", "Unix milliseconds"),
    cursor: t("integer", "Pass as `before` to get the next page."),
  },
};

const SUMMARY: Schema = {
  type: "object",
  properties: {
    id: t("string"),
    kind: t("string", "image | video | audio | music"),
    name: t("string"),
    vendor: t("string"),
    tagline: t("string"),
    status: t("string", "available | offline | soon"),
    statusNote: nullable("string"),
    output: t("string", "image | video | audio"),
    surfaces: t("array", undefined, { items: t("string") }),
    eta: t("integer", "Typical seconds to a result."),
  },
};

const SCHEMAS: Record<string, Schema> = {
  Error: {
    type: "object",
    properties: { error: { type: "object", properties: { code: t("string"), message: t("string", "Plain words, safe to show a person.") }, required: ["code", "message"] } },
    required: ["error"],
  },
  ModelSummary: SUMMARY,
  Model: {
    allOf: [
      { $ref: "#/components/schemas/ModelSummary" },
      {
        type: "object",
        properties: {
          badges: t("array", undefined, { items: t("string") }),
          prompt: { type: ["object", "null"], description: "Null when the model takes no prompt.", properties: { required: t("boolean"), maxLength: t("integer") } },
          slots: t("array", "Media slots: { id, label, accept[], min, max, when? }", { items: t("object") }),
          controls: t("array", "Controls: select | slider | toggle | text, each with id, label, default and its limits", { items: t("object") }),
          batch: { type: "object", properties: { max: t("integer"), native: t("boolean") } },
        },
      },
    ],
  },
  Quote: {
    type: "object",
    properties: {
      modelId: t("string"),
      available: t("boolean"),
      credits: t("integer", "Total in millicredits."),
      perGeneration: t("integer", "Millicredits per generation."),
      generations: t("integer", "Generations that would be queued."),
      resultsPerGeneration: t("integer"),
      exact: t("boolean", "False when the price is an estimate."),
      metered: t("boolean", "True when this is the most it can cost."),
      values: t("object", "The control values after defaults and limits were applied."),
      controls: t("array", "Ids of the controls that apply to these values.", { items: t("string") }),
      missingInputs: t("array", "Slot ids that still need files.", { items: t("string") }),
      promptMissing: t("boolean"),
      balance: t("integer", "Millicredits."),
      affordable: t("boolean"),
    },
  },
  Generation: {
    type: "object",
    properties: {
      id: t("string"),
      status: t("string", "queued | running | succeeded | failed | canceled"),
      kind: t("string"),
      output: t("string"),
      modelId: t("string"),
      modelName: t("string"),
      surface: t("string", "api, mcp, or the studio that made it"),
      prompt: t("string"),
      values: t("object"),
      inputs: t("object", "{ slotId: [fileId] }"),
      count: t("integer", "Results this generation returns."),
      cost: t("integer", "Millicredits held, then charged on success or returned on failure."),
      error: { type: ["object", "null"], properties: { code: t("string"), message: t("string") } },
      batchId: nullable("string"),
      eta: t("integer"),
      createdAt: t("integer"),
      startedAt: nullable("integer"),
      finishedAt: nullable("integer"),
      files: t("array", undefined, { items: { $ref: "#/components/schemas/File" } }),
      cursor: t("integer"),
    },
  },
  File: FILE,
};

const ERRORS: Record<string, string> = {
  "400": "Bad input (invalid_request).",
  "401": "Missing, unknown or revoked key (unauthorized).",
  "402": "Not enough credits (insufficient_credits).",
  "403": "The key lacks the scope (forbidden).",
  "404": "Not found, or not yours (not_found).",
  "409": "Conflict: model unavailable, not cancelable, or a limit.",
  "422": "Idempotency-Key reused with a different body (idempotency_mismatch).",
  "429": "Rate limited (rate_limited) or too many running (too_many_jobs). See Retry-After.",
};

function operation(id: string, r: RouteSpec): Schema {
  const params: Schema[] = [];
  for (const m of r.path.matchAll(/\{(\w+)\}/g)) params.push({ name: m[1], in: "path", required: true, schema: { type: "string" } });
  for (const q of r.query ?? []) params.push({ name: q.name, in: "query", required: false, schema: q.schema, description: q.description });
  for (const h of r.headers ?? []) params.push({ name: h.name, in: "header", required: false, schema: { type: "string" }, description: h.description });
  const errorRef = { content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
  const responses: Schema = {
    [r.method === "POST" && (id === "createGeneration" || id === "uploadFile") ? "201" : "200"]: {
      description: "OK",
      content: r.binary ? { "application/octet-stream": { schema: r.response } } : { "application/json": { schema: r.response } },
    },
  };
  for (const [code, description] of Object.entries(ERRORS)) responses[code] = { description, ...errorRef };
  const op: Schema = {
    operationId: id,
    summary: r.summary,
    ...(r.description ? { description: r.description } : {}),
    "x-scope": r.scope,
    security: [{ bearer: [] }],
    parameters: params,
    responses,
  };
  if (r.body) {
    op.requestBody = {
      required: true,
      content: "json" in r.body ? { "application/json": { schema: r.body.json } } : { "multipart/form-data": { schema: r.body.multipart } },
    };
  }
  return op;
}

export function openApiDocument(origin: string) {
  const paths: Record<string, Record<string, Schema>> = {};
  for (const [id, r] of Object.entries(ROUTES) as [string, RouteSpec][]) {
    (paths[r.path] ??= {})[r.method.toLowerCase()] = operation(id, r);
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Parallax API",
      version: "1.0.0",
      description:
        "Make images, video and audio with Parallax from your own code. Authenticate with `Authorization: Bearer <key>`; create keys in your account. " +
        "Credit amounts are millicredits (1000 = 1 credit). Times are Unix milliseconds. Every response carries X-RateLimit-Limit, X-RateLimit-Remaining and X-RateLimit-Reset.",
    },
    servers: [{ url: `${origin}/api` }],
    components: { securitySchemes: { bearer: { type: "http", scheme: "bearer" } }, schemas: SCHEMAS },
    paths,
  };
}
