# Developer API, webhooks and MCP

Developers and AI agents can use Parallax without the website. There are three parts:

- **Account routes** under `/api/developer/*`. These use the normal cookie session, and the developer screens call them. They manage API keys, the usage log and webhook endpoints.
- **The public REST API** under `/api/v1/*`. It authenticates with `Authorization: Bearer <key>`. The OpenAPI document is at `/api/v1/openapi.json`.
- **The MCP server** at `/api/mcp`, for AI agents. It uses the same bearer keys.

Conventions are the same as the rest of Parallax:

- Times are Unix milliseconds.
- Credit amounts are **millicredits** (1000 = 1 credit).
- Ids are opaque strings.
- Every error has this shape, and `message` is written so it can be shown to the member as is:

```json
{ "error": { "code": "not_found", "message": "That key does not exist." } }
```

Common codes: `invalid_request` (400), `unauthorized` (401), `insufficient_credits` (402), `forbidden` / `account_required` (403), `not_found` (404, also used for other members' data), `limit_reached` / `not_cancelable` / `model_unavailable` (409), `idempotency_mismatch` (422), `rate_limited` / `too_many_jobs` (429), `invalid_url` (400, webhooks).

---

## 1. Account routes (cookie session)

These routes need a signed-in member. Guest accounts can list keys and webhooks but cannot create them; they get `403 account_required` ("Create a free account to use API keys."). Cross-site writes are refused (`403`).

### API key object

```json
{
  "id": "key_x7Gk2...",
  "name": "Main key",
  "prefix": "pxk_PmX-UNAL",
  "scopes": ["read", "generate"],
  "createdAt": 1794562000000,
  "lastUsedAt": 1794562100000,
  "revokedAt": null
}
```

- `prefix` is the start of the key, safe to show so the member can tell keys apart.
- `lastUsedAt` is updated at most once a minute. It is `null` if the key was never used.
- `revokedAt` is set once the key is revoked, and revoking is permanent. Revoked keys stay in the list, after the active ones, so the usage table can still name them.
- Scopes:
  - `read`: everything that only reads, plus pricing (`quote`).
  - `generate`: starting and canceling generations, and uploading files.

  A key with only `generate` cannot read the results of its generations. Most keys need both.

### GET /api/developer/keys

Lists the member's keys, active keys first. The key itself is never included.

**200**

```json
{ "keys": [ApiKey, ...], "limit": 10, "scopes": ["read", "generate"] }
```

### POST /api/developer/keys

Creates a key. **The response is the only time the key itself (`secret`) is shown.** The screen must make that clear and offer a copy button. Only a SHA-256 hash of the key is stored.

Request:

```json
{ "name": "CI server", "scopes": ["read"] }
```

| Field | Rules |
|---|---|
| `name` | Optional text, up to 60 characters. Defaults to "Untitled key". |
| `scopes` | Optional. A non-empty array containing `read` and/or `generate`. Defaults to both. |

**201**

```json
{ "key": ApiKey, "secret": "pxk_PmX-UNALq9...43 more characters" }
```

Errors:

- `400` bad name or scopes
- `403 account_required` (guest)
- `409 limit_reached`: the member already has 10 active keys. Message: "You can have 10 active keys. Revoke one first."

### GET /api/developer/keys/:id

**200** `{ "key": ApiKey }`. Answers `404` if the key does not exist or belongs to someone else.

### PATCH /api/developer/keys/:id

Renames a key or changes its scopes. Body: `{ "name"?, "scopes"? }`, with the same rules as create.

**200** `{ "key": ApiKey }`. Errors: `400`, `404`, and `409` if the key was revoked.

### DELETE /api/developer/keys/:id

Revokes the key. It stops working at once, and this cannot be undone.

**200** `{ "key": ApiKey }`, with `revokedAt` set.

### GET /api/developer/usage?key=&limit=&before=

The request log behind a usage table, newest first, plus totals per key for the last 24 hours. Logs are kept for 30 days.

| Query | Meaning |
|---|---|
| `key` | Optional key id. Only that key's requests. `404` if it is not the member's key. |
| `limit` | 1 to 200. Default 50. |
| `before` | The `cursor` of the last row already shown, to get the next page. |

**200**

```json
{
  "requests": [
    { "id": 812, "keyId": "key_...", "method": "POST", "route": "/v1/generations", "status": 201, "credits": 100, "createdAt": 1794562100000, "cursor": 812 }
  ],
  "last24h": [ { "keyId": "key_...", "requests": 68, "errors": 9, "credits": 300 } ]
}
```

- `route` is the route pattern (`/v1/generations/{id}`), never the actual id. MCP calls show as `/mcp tools/call generate`, `/mcp tools/list` and so on.
- `credits` is the millicredits held by that request. It is only non-zero for a successful generation request. A failed or canceled generation gives its credits back later; the log does not show that, and the wallet history does.
- `errors` counts responses with status 400 or above.
- Requests rejected for a missing or unknown key are not logged, because there is no key to log them under.

### Webhook endpoint object

```json
{
  "id": "whk_...",
  "url": "https://example.com/parallax-hook",
  "description": "Production",
  "events": ["generation.succeeded", "generation.failed"],
  "enabled": true,
  "secretHint": "x9Qa",
  "createdAt": 1794562000000
}
```

Events a member can subscribe to:

| Event | When |
|---|---|
| `generation.succeeded` | A generation finished and its files are ready. |
| `generation.failed` | A generation failed. Its credits were returned. |
| `generation.canceled` | A queued generation was canceled. |

Events fire for **all** of the member's generations, whether they were started from the website, the API or MCP. Only generations that finish after the endpoint was created are sent.

The test event `webhook.test` is sent only by the "send test event" route.

### GET /api/developer/webhooks

**200**

```json
{ "webhooks": [Webhook, ...], "events": ["generation.succeeded", "generation.failed", "generation.canceled"], "limit": 10 }
```

### POST /api/developer/webhooks

Creates an endpoint. **The response is the only time the signing `secret` is shown.**

Request:

```json
{ "url": "https://example.com/hook", "events": ["generation.succeeded"], "description": "Production" }
```

| Field | Rules |
|---|---|
| `url` | Required. Must be `https` on the public internet. Plain `http`, `localhost`, `.local`/`.internal` names, user:password in the URL, ports below 1024 other than 443, and any host that resolves to a private, loopback, link-local, shared or multicast address are refused. |
| `events` | Optional. A non-empty array of the event names above. Defaults to all of them. |
| `description` | Optional, up to 200 characters. |

**201**

```json
{ "webhook": Webhook, "secret": "whsec_..." }
```

Errors:

- `400 invalid_url`, with a message such as "The endpoint must use https.", "The endpoint must be on the public internet." or "We could not find that host."
- `400` bad events or description
- `403 account_required`
- `409 limit_reached` (10 endpoints per member)

### GET /api/developer/webhooks/:id

**200** `{ "webhook": Webhook }`, or `404`.

### PATCH /api/developer/webhooks/:id

Body: `{ "url"?, "events"?, "description"?, "enabled"? }`. The fields follow the same rules as create, and `enabled` is a boolean. A disabled endpoint gets no new deliveries.

**200** `{ "webhook": Webhook }`.

### DELETE /api/developer/webhooks/:id

Deletes the endpoint and its delivery log. **200** `{ "ok": true }`.

### POST /api/developer/webhooks/:id/rotate

Creates a new signing secret. The old one stops working at once.

**200** `{ "webhook": Webhook, "secret": "whsec_..." }`. The new secret is shown this once.

### POST /api/developer/webhooks/:id/test

Sends a `webhook.test` event right away and waits for the endpoint to answer, for up to 10 seconds.

**200** `{ "delivery": Delivery }`. Show its `status` and `responseStatus` or `error`. If the endpoint failed, the delivery stays `pending` and is retried like any other.

### GET /api/developer/webhooks/:id/deliveries?limit=&before=

The delivery log, newest first. `limit` is 1 to 100 (default 30). `before` is the `createdAt` of the last row already shown.

**200** `{ "deliveries": [Delivery, ...] }`

```json
{
  "id": "dlv_...",
  "webhookId": "whk_...",
  "event": "generation.succeeded",
  "generationId": "job_...",
  "status": "delivered",
  "attempts": 1,
  "nextAttemptAt": null,
  "responseStatus": 200,
  "error": null,
  "createdAt": 1794562100000,
  "deliveredAt": 1794562100400,
  "payload": { "id": "dlv_...", "type": "generation.succeeded", "createdAt": 1794562100000, "data": { "generation": Generation } }
}
```

| Field | Meaning |
|---|---|
| `status` | `pending` (waiting to be sent or retried), `delivered` or `failed` (gave up after 6 attempts). |
| `nextAttemptAt` | When the next retry is due. Only set while `pending`. |
| `responseStatus` | The HTTP status of the last attempt. `null` if it never connected. |
| `error` | The reason the last attempt failed, in plain words, e.g. "The endpoint answered 500." or "Could not connect to the endpoint." |

### POST /api/developer/webhooks/:id/deliveries/:deliveryId/retry

Puts a `delivered` or `failed` delivery back in the queue, with a fresh set of attempts.

**200** `{ "delivery": Delivery }`. Answers `409` if it is already pending, and `404` if it does not exist.

### How deliveries work (for the docs screen)

- Each delivery is a `POST` of JSON (the `payload` above) with these headers:
  - `Parallax-Webhook-Id`: the delivery id. It is the same on every retry, so receivers can drop repeats.
  - `Parallax-Webhook-Event`: the event name.
  - `Parallax-Webhook-Timestamp`: Unix **seconds**.
  - `Parallax-Webhook-Signature`: `v1=` followed by the hex HMAC-SHA256 of `"<timestamp>.<raw body>"`, keyed with the endpoint's secret.
- To verify a delivery, compute the same HMAC, compare it in constant time, and reject timestamps older than 5 minutes.
- Any 2xx answer counts as delivered. Anything else, a timeout (10 s) or a connection error is retried after 30 s, 2 min, 10 min, 1 h and 6 h. After 6 attempts the delivery is `failed`.
- Redirects are not followed.
- Every attempt resolves the host again and refuses private addresses at connect time, so a DNS change cannot point an endpoint at an internal address.

Example receiver check (Python):

```python
expected = "v1=" + hmac.new(secret.encode(), f"{ts}.".encode() + raw_body, hashlib.sha256).hexdigest()
ok = hmac.compare_digest(expected, request.headers["Parallax-Webhook-Signature"])
```

---

## 2. Public REST API: `/api/v1`

- **Auth:** `Authorization: Bearer pxk_...` on every request except `/api/v1/openapi.json`. A missing, unknown or revoked key gets `401 unauthorized`. A key without the route's scope gets `403 forbidden` ("This key does not have the "generate" scope."). Session cookies are ignored.
- **Rate limits:** each key may make 120 requests per minute (fixed window). This can be changed with `PARALLAX_API_RATE_LIMIT`. Every response carries:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset` (Unix seconds)

  When the limit is reached the answer is `429 rate_limited` with `Retry-After` (seconds).

  Separately, the member's plan limits how many generations can run at once (`429 too_many_jobs`).
- **Logging:** every request with a valid key is logged for the usage table (see above).

### Shapes

**Generation**

```json
{
  "id": "job_...",
  "status": "queued",
  "kind": "image",
  "output": "image",
  "modelId": "flux-schnell",
  "modelName": "FLUX Schnell",
  "surface": "api",
  "prompt": "a lighthouse in fog",
  "values": { "aspect": "16:9" },
  "inputs": { "refs": ["ast_..."] },
  "count": 1,
  "cost": 100,
  "error": null,
  "batchId": null,
  "eta": 8,
  "createdAt": 0,
  "startedAt": null,
  "finishedAt": null,
  "files": [File],
  "cursor": 42
}
```

| Field | Meaning |
|---|---|
| `status` | `queued`, `running`, `succeeded`, `failed` or `canceled`. |
| `surface` | `api` for REST, `mcp` for MCP, or the studio that made it. |
| `cost` | Millicredits held when the generation starts, charged on success, returned on failure or cancel. |
| `error` | `{ code, message }` when the generation failed, otherwise `null`. |
| `files` | Filled only once the generation has succeeded. |

**File**

```json
{
  "id": "ast_...",
  "kind": "image",
  "source": "generated",
  "mime": "image/png",
  "bytes": 354667,
  "width": 1024,
  "height": 576,
  "duration": null,
  "title": "",
  "generationId": "job_...",
  "url": "/api/v1/files/ast_.../content",
  "createdAt": 0,
  "cursor": 9
}
```

| Field | Meaning |
|---|---|
| `source` | `generated` or `upload`. |
| `duration` | Seconds, for audio and video. |
| `url` | Needs the same bearer key. It is not a public link. |

### GET /api/v1/models?kind=&available=1 (scope `read`)

Lists models. `kind` is `image`, `video`, `audio` or `music` (anything else is `400`). `available=1` hides models that cannot run right now.

**200**

```json
{ "models": [ { "id": "flux-schnell", "kind": "image", "name": "...", "vendor": "...", "tagline": "...", "status": "available", "statusNote": null, "output": "image", "surfaces": ["image"], "eta": 8 } ] }
```

### GET /api/v1/models/:id (scope `read`)

One model with everything needed to fill a draft:

- `prompt`: `{ required, maxLength }`, or `null` if the model takes no prompt.
- `slots`: media slots, each `{ id, label, accept[], min, max, when? }`.
- `controls`: each `select`, `slider`, `toggle` or `text`, with `id`, `label`, `default` and its options or limits. `when` is a condition on other values.
- `batch`: `{ max, native }`.
- `badges`.

Answers `404` for an unknown model.

### POST /api/v1/quote (scope `read`)

Prices a draft without running it. Nothing is queued and no credits move. The body is the same as for create. File ids in `inputs` are only counted, not loaded.

Request:

```json
{ "modelId": "flux-schnell", "prompt": "a red kite", "values": {}, "count": 2 }
```

**200**

```json
{
  "modelId": "flux-schnell",
  "available": true,
  "credits": 200,
  "perGeneration": 200,
  "generations": 1,
  "resultsPerGeneration": 2,
  "exact": true,
  "metered": false,
  "values": { "aspect": "1:1" },
  "controls": ["aspect"],
  "missingInputs": [],
  "promptMissing": false,
  "balance": 150000,
  "affordable": true
}
```

| Field | Meaning |
|---|---|
| `values` | The control values after defaults and limits were applied. |
| `controls` | Ids of the controls that apply with these values. |
| `missingInputs` | Ids of slots that still need files. |
| `metered` | `true` means the price is the most the generation can cost. |

Errors: `400` (no or unknown model, prompt too long, bad `inputs`).

### POST /api/v1/generations (scope `generate`)

Starts a generation through the same path the website uses, so validation, price, credits and limits are identical.

Request:

```json
{ "modelId": "flux-schnell", "prompt": "a lighthouse in fog", "values": { "aspect": "16:9" }, "inputs": { "refs": ["ast_..."] }, "count": 1 }
```

Optional header: `Idempotency-Key`, 1 to 200 characters. Repeating the same body with the same key within 24 hours returns the first answer (status `200`, header `Idempotent-Replayed: true`) and starts nothing new. The same key with a different body gets `422 idempotency_mismatch`. Keys are per API key.

**201**

```json
{ "generations": [Generation, ...], "balance": 149900 }
```

`balance` is the balance after the hold. The answer holds one generation per result, or a single one when the model returns several results per call.

Errors:

- `400`: no or unknown model, missing prompt or files, too many files, wrong file type
- `402 insufficient_credits`
- `404`: an input file is not the member's
- `409 model_unavailable`
- `422`
- `429 too_many_jobs`

### GET /api/v1/generations?status=active|all&kind=&limit=&before= (scope `read`)

The member's generations, newest first. Canceled generations are not listed. `limit` is 1 to 100 (default 20). `before` takes a `cursor` from the previous page.

**200** `{ "generations": [Generation, ...] }`

### GET /api/v1/generations/:id (scope `read`)

**200** `{ "generation": Generation }`, or `404`. Poll this until `status` is `succeeded`, `failed` or `canceled`, or use webhooks instead.

### POST /api/v1/generations/:id/cancel (scope `generate`)

Cancels a **queued** generation and returns its credits.

**200**

```json
{ "generation": { ..., "status": "canceled" }, "balance": 150000 }
```

Errors: `409 not_cancelable` ("This one is already running and cannot be canceled." or "This one has already finished."), and `404`.

### POST /api/v1/files (scope `generate`)

Uploads a file to use as a generation input. Send it as multipart form data in the field `file`. The type is read from the bytes, not the name.

Accepted types: PNG, JPEG, WebP, GIF, MP4, MOV, WebM, MP3, WAV, M4A and OGG. Size limits: images and audio 20 MB, video 30 MB.

**201** `{ "file": File }`.

Errors: `400` (unsupported type, no file), `413` (too large).

### GET /api/v1/files?kind=&source=&limit=&before= (scope `read`)

Lists files, newest first.

- `kind`: `image`, `video` or `audio`.
- `source`: `generated` or `upload`.
- `limit`: 1 to 200 (default 50).

**200** `{ "files": [File, ...] }`

### GET /api/v1/files/:id (scope `read`)

**200** `{ "file": File }`, or `404`.

### GET /api/v1/files/:id/content[?download=1] (scope `read`)

Returns the file's bytes with its own content type. `Range` is honoured, so video can seek. `download=1` asks the browser to save the file. Answers `404` for someone else's file.

### GET /api/v1/balance (scope `read`)

**200**

```json
{ "balance": 149900, "credits": "149.9", "plan": { "id": "free", "name": "Free", "concurrency": 4 } }
```

### GET /api/v1/openapi.json (no key)

An OpenAPI 3.1 document for all the routes above. It is built from the same route table (`src/server/developer/routes.ts`) that the route handlers use, so it cannot drift. Each operation carries `x-scope`. A docs screen can render it directly.

### Example

```bash
curl -s -X POST https://<host>/api/v1/generations \
  -H "Authorization: Bearer $PARALLAX_KEY" -H "Idempotency-Key: 7d1c..." \
  -H "Content-Type: application/json" \
  -d '{"modelId":"flux-schnell","prompt":"a lighthouse in fog"}'
```

---

## 3. MCP server: `/api/mcp`

This is the Model Context Protocol over Streamable HTTP, JSON-RPC 2.0. It is stateless: one JSON answer per POST, no sessions, and no SSE. It uses the same `Authorization: Bearer <key>`.

The server speaks both eras of the protocol:

- **Current revision `2026-07-28`.** There is no handshake. Each request carries `params._meta["io.modelcontextprotocol/protocolVersion"]` and the headers `MCP-Protocol-Version` and `Mcp-Method`, plus `Mcp-Name` for `tools/call`.
  - If a header does not match the body, the answer is `400` with error `-32020` (header mismatch).
  - An unknown version gets `400` with `-32022` and `data: { supported, requested }`.
  - An unknown method gets `404` with `-32601`.
  - Results carry `resultType: "complete"`.
  - `server/discover` is supported.
- **Earlier revisions `2025-11-25`, `2025-06-18` and `2025-03-26`.**
  - `initialize` answers with the client's version when it is supported, otherwise `2025-11-25`.
  - The `MCP-Protocol-Version` header is checked when present.
  - A request without the header is treated as `2025-03-26`.

On every revision:

- Methods: `initialize`, `ping`, `server/discover`, `tools/list` and `tools/call`.
- Notifications get `202` with an empty body.
- `GET` and `DELETE` get `405`.
- A request with an `Origin` header from another site gets `403`.
- A missing or bad key gets `401` (Parallax error shape, with `WWW-Authenticate: Bearer`).
- Rate limit headers and the request log work as for REST.

Tools (`tools/list`):

| Tool | Scope | Arguments | Returns (`structuredContent`) |
|---|---|---|---|
| `list_models` | read | `kind?` | `{ models }` (available models only) |
| `get_model` | read | `modelId` | `{ model }` |
| `quote` | read | `modelId, prompt?, values?, inputs?, count?` | the quote object |
| `generate` | generate | same as quote | `{ generations }` (queued; poll `get_generation`) |
| `get_generation` | read | `id` | `{ generation }` |
| `list_generations` | read | `status?, kind?, limit? (≤50), before?` | `{ generations }` |
| `list_files` | read | `kind?, source?, limit? (≤50), before?` | `{ files }` |
| `get_balance` | read | none | `{ balance, credits, plan }` |

A tool result has `content: [{ type: "text", text: <JSON> }]`, `structuredContent` and `isError`. When a tool fails (missing scope, not found, no credits and so on), the result has `isError: true` and the member-facing message as its text, so the agent can read it. An unknown tool name is a JSON-RPC error, `-32602`.

Client setup to show on the connect screen:

- URL: `https://<host>/api/mcp`
- Header: `Authorization: Bearer <key>`

---

## Tables (`migrations/040_developer.sql`)

| Table | What it holds |
|---|---|
| `dev_api_keys` | Keys: name, prefix, SHA-256 hash, scopes, created / last used / revoked. |
| `dev_request_log` | One row per request with a valid key: key, method, route pattern, status, credits held. Trimmed to 30 days. |
| `dev_idempotency` | `(key_id, Idempotency-Key)` → request hash and generation ids, for 24 h. |
| `dev_webhooks` | Endpoints: URL, description, secret (in the clear, because it is needed to sign), events, enabled. |
| `dev_webhook_deliveries` | One row per event per endpoint: payload, status, attempts, next attempt, last status / error. Unique per (endpoint, event, generation). |
| `dev_state` | The dispatcher's watermark (last `finished_at` it scanned). |

## Server configuration

| Variable | Effect |
|---|---|
| `PARALLAX_API_RATE_LIMIT` | Requests per minute per key (default 120). |
| `PARALLAX_ALLOW_LOCAL_WEBHOOKS=1` | Allows `http://127.0.0.1:<port>` webhook URLs. For tests only. |

## Open improvements

1. **A "job finished" hook in `src/server/worker.ts`.** For example, `onJobFinished(fn: (job: JobRow) => void)`, called after a job reaches `succeeded`, `failed` or `canceled` (including the cancel in `removeJob`). For now a dispatcher loop polls `jobs` every second for rows whose `finished_at` is past a watermark. That works, but it scans `jobs` without an index on `finished_at`, and it adds up to a second of latency.
2. **Start feature loops at boot.** For example, an `instrumentation.ts` `register()` that calls a list of `ensure*` functions, or a way for `ensureWorker()` to start registered loops. The webhook dispatcher only starts when a developer route or `/api/v1` / `/api/mcp` request arrives. After a restart, deliveries for generations started on the website wait until one of those routes is hit. (Nothing is lost, because of the watermark; it is only late.)
3. **An index `CREATE INDEX jobs_finished ON jobs(finished_at)`**, for the dispatcher scan, until item 1 exists.
4. **A cancel function that only cancels.** `removeJob` cancels a queued job, but deletes a finished one. `POST /v1/generations/:id/cancel` checks the status first and calls `removeJob` in the same synchronous step. Something like `cancelJob(userId, id): boolean` would make that intent explicit.
5. **A shared rate limiter that returns its state.** `rateLimit()` in `http.ts` only throws, so it cannot fill `X-RateLimit-*` headers. This feature has its own per-key limiter, which is also in memory and per process.
