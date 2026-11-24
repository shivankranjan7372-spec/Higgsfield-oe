# Core API: sessions, jobs, assets, wallet

The four route groups every page builds on: who is signed in (`/api/auth`), generations
(`/api/jobs`), files (`/api/assets`) and credits (`/api/wallet`).

All paths are relative to the app's own origin and start with `/api`. Every answer is JSON,
except `GET /api/assets/:id/file`, which answers with the file's bytes. Every success is
`200` (the file route also answers `206` for a byte range). Nothing answers `201` or `204`.

See also: `account.md`, `library.md`, `community.md`, `developer.md`, `apps.md`, `cinema.md`,
`ads.md`, `agent.md`, `notify.md`.

## Conventions

### Sessions

- The session is one cookie, `px_session`: `HttpOnly`, `SameSite=Lax`, `Path=/`, 30 days.
  Scripts cannot read it. Ask `GET /api/auth/me` who is signed in.
- The cookie is set by `POST /api/auth/guest`, `POST /api/auth/signup` and
  `POST /api/auth/login`, and cleared by `POST /api/auth/logout`. A session ends 30 days after
  it was started. Using it does not extend it.
- A **guest** is a real account with `isGuest: true`, no email and no password. It is made
  on demand so a visitor can generate before signing up. A **member** is an account with an
  email and a password (`isGuest: false`).
- **Guests and members are treated the same by every endpoint in this file.** "Signed in"
  below means "has a valid session, guest or member". No endpoint here is member-only.
  The differences: a guest starts with 60 credits, a new member with 150; a guest cannot log
  back in, so a guest who logs out (or loses the cookie) loses access to that account's work.
- With no session, or an expired or unknown cookie, a protected endpoint answers
  `401 unauthorized`. The auth endpoints and the file endpoint work signed out.
- Before the first write a signed-out visitor makes (Generate, upload), call
  `POST /api/auth/guest`. It is safe to call at any time: with a session it returns the
  current account and creates nothing.

### Same-origin rule for writes

Every request that is not `GET` or `HEAD` is refused with `403 forbidden` when it carries an
`Origin` header whose host differs from the request's host (`X-Forwarded-Host`, else `Host`).
This check runs first, before the session check. A normal same-origin `fetch` from a page of
the app passes. A request with no `Origin` header (a script, curl) is allowed.

### Errors

Every failure has the same body. `message` is written for the person; show it as it is.

```json
{ "error": { "code": "insufficient_credits", "message": "This needs 2.4 credits and you have 1." } }
```

Errors any endpoint can answer (they are not repeated in the tables below):

| Status | `code` | When |
|---|---|---|
| 403 | `forbidden` | A non-GET request from another site. Message: "Cross-site request refused." |
| 401 | `unauthorized` | No valid session on an endpoint that needs one. Message: "Sign in to continue." |
| 413 | `invalid_request` | A JSON body over 256,000 characters. |
| 400 | `invalid_request` | A JSON endpoint got a body that is not a JSON object. Message: "Send a JSON object." |
| 500 | `server_error` | Anything unexpected. Message: "Something went wrong on our side." |

Branch on `status` and `code` together. The same code can come with two statuses
(`invalid_request` is 400, 409 or 413; `model_unavailable` is 409 or 503).

### Rate limits

Some endpoints count calls in a fixed window. When the limit is `N`, the first `N` calls in
the window pass and the next one answers `429 rate_limited` ("Too many attempts. Wait a few
minutes and try again.") until the window ends. Auth limits are counted per client address
(the first `X-Forwarded-For` entry), so clients behind one address share a count. Failed
attempts count too. The counters live in server memory and reset when the server restarts.

### Units

- **Credits** in `balance`, `cost` and `amount` are integers in **millicredits**
  (1 credit = 1000). Show them with `formatCredits(n)` from `@/config/economy`
  (`3400` → `"3.4"`, `12000` → `"12"`, `1250000` → `"1,250"`).
  Exceptions, in **whole credits**: `packs[].credits` and `plan.monthlyCredits` in the wallet.
- **Times** (`createdAt`, `startedAt`, `finishedAt`) are Unix **milliseconds**.
- **Seconds** are used by `Job.eta` and `Asset.duration` only.
- **Sizes** (`bytes`) are bytes. Upload limits use 1 MB = 1,000,000 bytes.
- **Ids** are a prefix plus 16 letters and digits: `usr_`, `job_`, `ast_`, `bat_`.

### Client helpers

The app already wraps these calls. Use them instead of raw `fetch` where they fit.

| File | What it gives |
|---|---|
| `src/lib/api.ts` | `api(path, { method, body })`, `fetcher`, `ApiError` (`status`, `code`, `message`), `errorMessage(e)`, and the types `Job`, `JobStatus`, `Asset`, `SessionUser`. A network failure throws `ApiError` with status `0` and code `network`. |
| `src/lib/session.ts` | `useSession()`, `ensureSession()` (guest on demand), `signUp`, `logIn`, `logOut`, `setBalance`, `refreshSession`. |
| `src/lib/studio.ts` | `useJobs(surface)` (list plus polling), `useStudio(surface)` (composer state, live price, upload, generate), `isActive(job)`. |

### Screens this supports

| Screen | Calls |
|---|---|
| Header: avatar or "Login", credit balance | `GET /api/auth/me` |
| Login and signup dialogs | `POST /api/auth/login`, `POST /api/auth/signup`, `POST /api/auth/logout` |
| Composer: Generate | `POST /api/auth/guest` (if signed out), `POST /api/jobs` |
| Composer: reference files | `POST /api/assets`, `GET /api/assets` (pick from past files) |
| Feed of generations with progress | `GET /api/jobs`, polled |
| One result: favourite, rename, download, delete | `PATCH /api/assets/:id`, `GET /api/assets/:id/file?download=1`, `DELETE /api/jobs/:id` |
| Wallet page | `GET /api/wallet`, `POST /api/wallet/topup` |

---

## Shared shapes

### User

Returned as `user` by every auth endpoint.

```ts
interface User {
  id: string;               // "usr_…"
  email: string | null;     // null for a guest
  handle: string;           // unique, lower-case; a guest's is "guest-" plus 6 hex digits
  name: string;             // display name; a guest's is "Guest"
  isGuest: boolean;         // true until the account signs up
  plan: string;             // plan id: "free", "plus", "pro" or "studio"; new accounts are "free"
  avatarUrl: string | null; // "/api/assets/<id>/file", or null when no avatar is set
  bio: string;              // "" when not set
  createdAt: number;        // ms
}
```

Every auth endpoint answers with the same pair, called the **session answer** below:

```ts
interface SessionAnswer {
  user: User | null; // null when signed out
  balance: number;   // millicredits the account can spend now; 0 when signed out
}
```

### Job

One call to a model. One press of Generate makes one or more jobs.

```ts
type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

interface Job {
  id: string;                    // "job_…"
  kind: "image" | "video" | "audio" | "music"; // the model's kind ("audio" is speech)
  surface: string;               // the studio or tool that queued it: "image", "video", "speech", "music", "avatar", …
  modelId: string;               // registry id of the model
  modelName: string;             // the model's display name; the id itself if the model left the registry
  status: JobStatus;             // see the table below
  prompt: string;                // the prompt, trimmed; "" for a model that takes no prompt
  params: Record<string, string | number | boolean>; // the control values that were used, by control id
  inputs: Record<string, string[]>; // the reference files that were used: { slotId: [assetId, …] }
  count: number;                 // how many results this job should return
  cost: number;                  // millicredits held for this job (charged once it succeeds)
  error: { code: string; message: string } | null; // set only when status is "failed"
  batchId: string | null;        // shared by the jobs of one POST; null when the POST made one job
  meta: Record<string, unknown>; // the `meta` object sent with the POST, returned unchanged
  output: "image" | "video" | "audio"; // media type of the results
  eta: number;                   // typical SECONDS from start to result, for a progress bar
  createdAt: number;             // ms; jobs of one batch are 1 ms apart, in order
  startedAt: number | null;      // ms; when it was first sent to the model
  finishedAt: number | null;     // ms; when it succeeded, failed or was canceled
  assets: Asset[];               // the results, oldest first; always [] unless status is "succeeded"
  cursor: number;                // pass as `before` to GET /api/jobs to read older jobs
}
```

| `status` | Meaning |
|---|---|
| `queued` | Waiting to be sent. Credits are already held. Can be canceled with `DELETE`. A job also returns to `queued` for a short time when a busy model is retried. |
| `running` | Sent to the model. Cannot be canceled or removed until it finishes. |
| `succeeded` | Finished. `assets` holds the results. The hold became a charge. |
| `failed` | Finished with no result. `error` says why. The hold was given back in full. |
| `canceled` | Canceled while queued. **These endpoints never return it:** a canceled job leaves the list and `GET /api/jobs/:id` answers 404. |

Notes on fields:

- `params` holds a value for every control that applied, after defaults were filled in.
  Together with `modelId`, `prompt` and `inputs` it is enough to refill the composer.
- `inputs` leaves out slots that were empty or did not apply.
- `count` is above 1 only for models that return several results from one call. Other models
  get one job per result (see `POST /api/jobs`).
- `assets` can be shorter than `count` (the model returned fewer; the difference is refunded),
  and can shrink later when a result is deleted.
- `cost` can go down when the job succeeds, for models billed by real usage.
- `eta` is 30 when the model is no longer in the registry.

`error.code` on a failed job (these arrive inside a `200` answer, not as HTTP errors):

| `error.code` | Meaning |
|---|---|
| `provider_error` | The model refused the request, failed, or returned something unreadable. The message is often the model's own words (for example a safety filter). |
| `model_unavailable` | The model stayed busy or unreachable after 6 tries, or cannot be used right now. |
| `timeout` | No result within 10 minutes (30 minutes for video). |
| `interrupted` | The connection or the server dropped while sending, and sending again was not safe. |
| `invalid_request` | A reference file the job uses was removed before it started. |
| `request_refused` | The request could not be sent with these settings. |
| `account_paused`, `spend_cap` | Generation is blocked or capped for this account. |
| `server_error` | Unexpected error on our side. |
| `failed` | No code was stored. |

### Asset

One stored file: a result or an upload.

```ts
interface Asset {
  id: string;               // "ast_…"
  kind: "image" | "video" | "audio"; // read from the file's bytes
  source: "generated" | "upload";
  mime: string;             // e.g. "image/png", "video/mp4", "audio/mpeg"
  bytes: number;            // file size
  width: number | null;     // pixels; null for audio, or when it could not be read
  height: number | null;    // pixels; same rule
  duration: number | null;  // SECONDS, may be fractional; null for images, or when unknown
  url: string;              // "/api/assets/<id>/file"
  posterUrl: string | null; // "<url>?poster=1", a JPEG still; only videos can have one, else null
  title: string;            // upload: the file's name (first 200 characters); generated: "" until renamed
  prompt: string;           // generated: the job's prompt; upload: ""
  modelId: string | null;   // generated: the model; upload: null
  params: Record<string, unknown>; // generated: the job's `params`; upload: {}
  favorite: boolean;
  folderId: string | null;  // library folder, see library.md
  isPublic: boolean;        // true = the file URL works for everyone, signed in or not
  jobId: string | null;     // the job that made it; null for uploads
  createdAt: number;        // ms
  cursor: number;           // pass as `before` to GET /api/assets to read older files
}
```

A video's `posterUrl` can be `null` (no still could be made). Fall back to the `<video>`
element itself or an icon. An image's `width`/`height` are read for PNG, JPEG, GIF and WebP.

### Wallet

```ts
interface Wallet {
  balance: number;        // millicredits; open holds are already taken off
  plan: Plan;             // the account's plan
  packs: Pack[];          // the top-up packs on offer
  demoBilling: boolean;   // true = top-ups are free demo credits and POST /api/wallet/topup works
  history: LedgerEntry[]; // newest first
}

interface Plan {
  id: string;             // "free" | "plus" | "pro" | "studio"
  name: string;           // "Free", "Plus", "Pro", "Studio"
  concurrency: number;    // jobs the account may have queued or running at once (4, 6, 10, 16)
  monthlyCredits: number; // WHOLE credits per month (0, 400, 1200, 3600)
  priceUsd: number;       // 0, 19, 49, 129
}

interface Pack {
  id: string;             // "pack-100" | "pack-500" | "pack-2000"
  credits: number;        // WHOLE credits (100, 500, 2000)
  priceUsd: number;       // 5, 22, 80
}

interface LedgerEntry {
  id: number;             // also the paging cursor: pass the last one as `before`
  kind: "grant" | "topup" | "hold" | "charge" | "refund" | "adjust";
  amount: number;         // millicredits, signed: negative spends, positive adds
  note: string;           // short label; for hold and charge it is the model's name
  jobId: string | null;   // the job, for hold, charge and refund
  createdAt: number;      // ms
}
```

| `kind` | Sign | Meaning |
|---|---|---|
| `grant` | + | Free credits: "Guest starter credits", "Welcome credits", plan and promo grants. |
| `topup` | + | A credit pack. |
| `hold` | − | A job that is still queued or running. |
| `charge` | − | A job that succeeded. It is the same entry as the hold, renamed. |
| `refund` | + | Part of a charge given back (fewer results, or the model used less than quoted). |
| `adjust` | ± | Reserved. Nothing writes it today. |

A job that failed or was canceled leaves **no** entry: its hold and the matching release are
both hidden from `history`.

---

## Auth

All four actions answer with the **session answer** `{ user, balance }`. Any other action name
(`POST /api/auth/<anything>`) answers `404 not_found`.

### `POST /api/auth/guest`

Auth: public. Body: none (a body is ignored).

- Signed out: creates a guest account with 60 credits (`balance: 60000`), starts a session
  and sets the cookie.
- Signed in (guest or member): returns the current account. Nothing is created.

Response `200`:
```json
{
  "user": {
    "id": "usr_Zp6dW3nHx0CgY7eM", "email": null, "handle": "guest-3fa91c", "name": "Guest",
    "isGuest": true, "plan": "free", "avatarUrl": null, "bio": "", "createdAt": 1794562390000
  },
  "balance": 60000
}
```

| Status | `code` | When |
|---|---|---|
| 429 | `rate_limited` | More than 10 new guest accounts in one hour from one client address. Calls made with a session are not counted. |

### `POST /api/auth/signup`

Auth: public. Body (JSON):

| Field | Type | Rules |
|---|---|---|
| `email` | string, required | Trimmed and lower-cased. Must look like an address. At most 254 characters. |
| `password` | string, required | 8 to 200 characters. |
| `name` | string, optional | Runs of spaces become one, trimmed, cut to 60 characters. Default: the part of the email before `@`. |

- Called **with a guest session**: that guest account is upgraded in place. The `id` stays the
  same, so its jobs, files and balance are kept. `isGuest` becomes `false`, the `handle`
  changes (made from the name), and 90 credits are added (150 in total with the guest's 60).
  The cookie stays the same.
- Called **signed out**: creates a new account with 150 credits and sets the cookie.
- Called with a member session: creates a new, separate account and switches the cookie to it.

Response `200`: the session answer for the new member.

| Status | `code` | When (message) |
|---|---|---|
| 429 | `rate_limited` | More than 10 signup calls in one hour from one client address. Counted before validation. |
| 400 | `invalid_request` | "Enter a valid email address." |
| 400 | `invalid_request` | "Use at least 8 characters for the password." |
| 400 | `invalid_request` | "That password is too long." (over 200) |
| 400 | `invalid_request` | "An account with that email already exists." (400, not 409) |

### `POST /api/auth/login`

Auth: public. Body (JSON): `{ "email": string, "password": string }`. The email is trimmed and
lower-cased before the lookup.

Starts a session for that account and sets the cookie. Response `200`: the session answer.

**Logging in from a guest session switches accounts.** The guest's jobs and files are not
moved to the member account and can no longer be reached.

| Status | `code` | When (message) |
|---|---|---|
| 429 | `rate_limited` | More than 20 login calls in 15 minutes from one client address. |
| 400 | `invalid_request` | "That email and password do not match." Wrong password and unknown email look the same. Note the status is 400, not 401. |

### `POST /api/auth/logout`

Auth: public. Body: none. Ends the session and clears the cookie. Works signed out too.

Response `200`: `{ "user": null, "balance": 0 }`

After it, drop every cached answer that belonged to the account (`logOut()` in
`src/lib/session.ts` does this).

### `GET /api/auth/me`

Auth: public. No parameters.

Response `200`: the session answer. Signed out it is `{ "user": null, "balance": 0 }`, not a 401.
Call it again whenever credits may have moved (a job finished, failed or was canceled).

---

## Jobs

### `GET /api/jobs`

Auth: signed in (guest ok). The caller's own jobs, newest first, each with its results.
Canceled and removed jobs are never listed.

| Query | Values | Default |
|---|---|---|
| `status` | `active` = only `queued` and `running`. Any other value = all. | all |
| `kind` | `image`, `video`, `audio`, `music` | any kind |
| `surface` | exact surface name, e.g. `image`, `video`, `speech` | any surface |
| `limit` | 1–100. Out-of-range numbers are clamped; a non-number means the default. | 40 |
| `before` | a job's `cursor`; returns only older jobs | first page |

Response `200`:
```json
{ "jobs": [ /* Job, ... */ ] }
```
There is no `nextCursor`. For the next page pass the `cursor` of the last job as `before`,
with the other query values unchanged. A page shorter than `limit` is the last one.

| Status | `code` | When |
|---|---|---|
| 400 | `invalid_request` | `kind` is not one of the four values. Message: "Unknown kind." |

### `POST /api/jobs`

Auth: signed in (guest ok). One press of Generate: validates, prices, holds the credits and
queues the work.

Body (JSON):

| Field | Type | Meaning and rules |
|---|---|---|
| `modelId` | string, required | A model id from the registry (below). |
| `prompt` | string | Trimmed. Required when the model's `prompt.required` is true; at most `prompt.maxLength` characters. Ignored when the model has no prompt (`prompt: null`). |
| `values` | object | Control values by control id, e.g. `{ "aspect": "16:9" }`. **Never an error:** a missing or illegal value becomes the control's default, a value for a control that does not apply is dropped, sliders are clamped and snapped to their step, text is cut to its `maxLength`. Anything that is not an object means "all defaults". |
| `inputs` | object | Reference files: `{ "<slotId>": ["<assetId>", …] }`. See below. Anything that is not an object means "no files". |
| `count` | number | Results wanted. Default 1. Floored, then clamped to 1…`model.batch.max` (never above 4 for models that queue one job per result). Never an error. |
| `surface` | string | Which studio or tool is asking. Must match `^[a-z0-9-]{1,40}$`. Otherwise (or when absent) the model's first surface is used. It is only a label for filtering `GET /api/jobs`. |
| `meta` | object | Free-form data returned on the job as `meta` (a preset id, a project id…). An object whose JSON is over 4,000 characters, or a value that is not an object, is stored as `{}` without an error. |

**The registry.** There is no endpoint that lists models. Import them in the browser:

```ts
import { models, modelsFor, defaultModel, getModel, resolveValues, visibleControls,
         visibleSlots, enabledOptions, clampCount, quoteJob } from "@/registry";
```

- `modelsFor(surface)` lists a studio's models; `defaultModel(surface)` is the one to open on.
- A model (`ModelDef`) has `id`, `kind`, `name`, `vendor`, `status` (`available`, `offline`,
  `soon`), `statusNote`, `surfaces`, `prompt`, `controls`, `slots`, `batch: { max, native }`,
  `output` and `eta`.
- `controls` are what `values` is keyed by. Each has an `id` and a `type`: `select`
  (`options`, `default`), `slider` (`min`, `max`, `step`, `default`), `toggle` (`default`) or
  `text` (`maxLength`, `default`).
- `slots` are what `inputs` is keyed by. Each has `id`, `label`, `accept` (list of `image`,
  `video`, `audio`), `min` and `max`.
- `resolveValues(model, rawValues, filled)` returns the complete, legal `values`. `filled` is
  `{ slotId: numberOfFiles }`. `visibleControls` and `visibleSlots` tell which ones apply.
  The server runs the same functions, so the UI and the server agree.

**Inputs.** An input entry is just an asset id string. The id must be a file the caller owns
(an upload from `POST /api/assets`, or any earlier result) and its `kind` must be in the
slot's `accept`. Keys that are not slot ids of the model are ignored. Files in a slot that
does not apply for the chosen values are dropped without an error.

```json
{ "inputs": { "refs": ["ast_h4NwE7cJx1UyD6sG", "ast_b9KfA2mVt5XqL8rP"] } }
```

**How many jobs.** It depends on `model.batch.native`:

- `native: true` (one call returns several results): **one** job with `count` = the number
  asked for, `batchId: null`.
- `native: false`: **one job per result**, each with `count: 1`, all sharing one `batchId`.
  With a single result there is one job and `batchId` is `null`.

**Price.** Quote it in the browser with the same function the server uses:

```ts
const values = resolveValues(model, rawValues, filled);
const quote = quoteJob(model, { prompt, values, filled, count: clampCount(model, count) });
// quote.millicredits  total for this press     quote.perJob  price of one job
// quote.jobs          jobs that will be queued  quote.perJobCount  results per job
// quote.metered       true = this is the most it can cost; less may be charged
```

Prices are multiples of 100 millicredits (0.1 credit); the lowest price of a job is 100. The
server prices the request again and its number is the one that counts. Wrap `quoteJob` in
try/catch and treat an error as "no price yet", as `useStudio` does.

Response `200`:
```json
{ "jobs": [ /* Job, ... */ ], "balance": 59800 }
```
Every returned job is `queued` with `assets: []`, `startedAt: null` and `error: null`. Jobs of
a batch come oldest first here (the list endpoint returns newest first). `balance` is the
balance after the hold; put it on screen at once.

Errors, in the order they are checked:

| Status | `code` | When (message) |
|---|---|---|
| 400 | `invalid_request` | `modelId` missing or unknown. "Pick a model first." |
| 409 | `model_unavailable` | The model's `status` is `offline` or `soon`. Message is its `statusNote`, else "<name> is not available right now." |
| 400 | `invalid_request` | Required prompt is empty. "Write a prompt first." |
| 400 | `invalid_request` | Prompt too long. "Keep the prompt under 4,000 characters." (the model's own limit) |
| 400 | `invalid_request` | A slot's value is not a list of strings, or has more than 20. "\"<label>\" must be a list of file ids." |
| 404 | `not_found` | An input id is not a file the caller owns (unknown, someone else's, deleted or in the trash). "That file does not exist." |
| 400 | `invalid_request` | A slot has too few files. "Add <label in lower case> first." when it needs one, else "\"<label>\" needs at least N files." |
| 400 | `invalid_request` | A slot has too many files. "\"<label>\" takes at most 1 file." or "… at most N files." |
| 400 | `invalid_request` | A file of the wrong kind. "\"<label>\" takes an image, not a video." (kinds read "an image", "a video", "an audio file", joined by "or") |
| 409 | `model_unavailable` | The model has no price entry. "<name> is not available right now." |
| 402 | `insufficient_credits` | Balance is below the total price. "This needs 2.4 credits and you have 1." Nothing is queued. |
| 429 | `too_many_jobs` | Queued + running jobs plus the new ones would pass the plan's `concurrency` (4 on Free). "You can run 4 at once on the Free plan. Wait for one to finish." Nothing is queued, even when part of the batch would fit. |
| 503 | `model_unavailable` | The server's daily provider budget is used up. "Generation is paused for today. Try again tomorrow." |

A request is all or nothing: on any error no job is queued and no credit is held.

### `GET /api/jobs/:id`

Auth: signed in (guest ok). Response `200`: `{ "job": Job }`.

| Status | `code` | When |
|---|---|---|
| 404 | `not_found` | Unknown id, someone else's job, or a job that was canceled or removed. "That generation does not exist." |

### `DELETE /api/jobs/:id`

Auth: signed in (guest ok). No body. What it does depends on the job's status:

| Job is | Effect | Answer |
|---|---|---|
| `queued` | Canceled. The held credits come back in full. The job disappears from every list. | `200` |
| `running` | Nothing changes. | `409 invalid_request` |
| `succeeded` | The job is removed from the history **and its result files are deleted for good** (from disk, skipping the library trash). No credits come back. | `200` |
| `failed` | The job is removed from the history. Its credits were already returned. | `200` |

Response `200`:
```json
{ "ok": true, "balance": 60000 }
```
`balance` is the balance after any credits came back.

| Status | `code` | When |
|---|---|---|
| 404 | `not_found` | Unknown id, someone else's job, or already canceled or removed. |
| 409 | `invalid_request` | The job is running (or started just before the cancel landed). "This one is already running. You can remove it when it finishes." |

Offer "Cancel" on queued jobs and "Remove" on finished ones. Hide or disable both while a job
is running. Ask before removing a succeeded job: its files cannot come back.

---

## Assets

### `GET /api/assets`

Auth: signed in (guest ok). The caller's own files, newest first. Deleted files and files in
the library trash are left out. For search, sorting and counts use `GET /api/library`
(`library.md`).

| Query | Values | Default |
|---|---|---|
| `kind` | `image`, `video`, `audio`. Any other value is ignored (no error). | any kind |
| `source` | `generated`, `upload`. Any other value is ignored. | both |
| `favorite` | exactly `1` = favourites only | off |
| `folder` | a folder id, or `none` for files in no folder | any folder |
| `job` | a job id: only that job's results | any job |
| `limit` | 1–200, clamped | 60 |
| `before` | an asset's `cursor`; returns only older files | first page |

Response `200`:
```json
{ "assets": [ /* Asset, ... */ ] }
```
Paging works as for jobs: pass the last asset's `cursor` as `before`. A page shorter than
`limit` is the last one. This endpoint has no errors of its own.

### `POST /api/assets`

Auth: signed in (guest ok). Uploads one file to use as a reference. Send
`multipart/form-data` (a `FormData`; do not set the `Content-Type` header yourself):

| Part | Type | Meaning |
|---|---|---|
| `file` | file, required | The file. One per request. |
| `accept` | text, optional | Kinds the caller will take, joined by commas: `image`, `video`, `audio` (pass the slot's `accept.join(",")`). A file of another kind is refused. Unknown words are ignored; with none left, any kind is taken. |

The type is read from the file's bytes. The file name and the browser's MIME type are not
trusted (the name only becomes the `title`).

| Kind | Stored as `mime` | Largest upload |
|---|---|---|
| image | `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/avif` | 20 MB |
| video | `video/mp4`, `video/quicktime`, `video/webm` | 30 MB |
| audio | `audio/mpeg`, `audio/wav`, `audio/mp4`, `audio/ogg`, `audio/flac`, `audio/aac` | 20 MB |

HEIC photos are recognised but refused.

Response `200`:
```json
{ "asset": { /* Asset with source "upload", title = the file name, jobId null */ } }
```

| Status | `code` | When (message) |
|---|---|---|
| 413 | `invalid_request` | The request is over 31 MB, or the file is over 30 MB. "That file is too large." |
| 413 | `invalid_request` | The file is over its kind's limit. "That file is too large. The limit for image is 20 MB." |
| 400 | `invalid_request` | The body is not multipart form data. "Send the file as multipart form data." |
| 400 | `invalid_request` | No `file` part. "Attach a file." |
| 400 | `invalid_request` | The bytes are not a supported type. "That file type is not supported. Use PNG, JPEG, WebP, GIF, MP4, MOV, WebM, MP3, WAV, M4A or OGG." |
| 400 | `invalid_request` | The kind is not in `accept`. "Expected image, but that file is a video." |
| 400 | `invalid_request` | "HEIC photos are not supported yet. Convert the photo to JPEG or PNG first." |

There is no upload progress or resumable upload. Upload files one at a time.

### `GET /api/assets/:id`

Auth: signed in (guest ok). Owner only, even when the file is public.
Response `200`: `{ "asset": Asset }`.

| Status | `code` | When |
|---|---|---|
| 404 | `not_found` | Unknown id, someone else's file, deleted, or in the trash. "That file does not exist." |

### `PATCH /api/assets/:id`

Auth: signed in (guest ok). Owner only. Body (JSON), every field optional:

| Field | Type | Effect |
|---|---|---|
| `title` | string | Trimmed, cut to 200 characters. |
| `favorite` | boolean | `true` sets the mark. **Any other value clears it.** |
| `isPublic` | boolean | `true` makes the file URL work for everyone. **Any other value makes it private.** For sharing to the feed use the community API (`community.md`). |
| `folderId` | string or `null` | Moves the file into the caller's folder, or out of any folder with `null`. |

Response `200`: `{ "asset": Asset }` with the new values. An empty object changes nothing and
returns the asset.

| Status | `code` | When (message) |
|---|---|---|
| 400 | `invalid_request` | `title` is not a string. "The title must be text." |
| 400 | `invalid_request` | `folderId` is neither a string nor `null`. "Unknown folder." |
| 404 | `not_found` | The file is not the caller's. "That file does not exist." |
| 404 | `not_found` | The folder is not the caller's. "That folder does not exist." |

The fields are applied one after another, not as one step. When the folder is unknown, a
`title` or `favorite` sent in the same request has already been saved. Send `folderId` on its
own if that matters.

### `DELETE /api/assets/:id`

Auth: signed in (guest ok). Owner only. No body. **Deletes the file for good**: it is removed
from disk and does not go to the library trash. The job that made it stays in the history
with one result fewer (possibly `assets: []`).

Response `200`: `{ "ok": true }`

| Status | `code` | When |
|---|---|---|
| 404 | `not_found` | Unknown id, someone else's file, or already deleted. |

For a delete the person can undo, use `POST /api/library/bulk` with `action: "trash"`
(`library.md`) instead.

### `GET /api/assets/:id/file`

Auth: public, but private by default. The owner (by session cookie) can always read the file.
Everyone else, signed in or not, can read it only when the asset's `isPublic` is `true`.
Otherwise the answer is `404`, never 401 or 403.

| Query | Effect |
|---|---|
| `poster=1` | Send the video's poster still (`image/jpeg`) instead of the file. |
| `download=1` | Send `Content-Disposition: attachment`, so the browser saves the file instead of showing it. |

Both can be combined. Any value other than `1` is ignored.

Response: the bytes, with these headers:

| Header | Value |
|---|---|
| `Content-Type` | The asset's `mime`, or `image/jpeg` for a poster. |
| `Content-Disposition` | `inline` (or `attachment` with `download=1`), file name `parallax-<10 characters of the id>.<ext>`. |
| `Accept-Ranges` | `bytes`. A `Range: bytes=…` request answers `206` with `Content-Range`, so video can seek. |
| `Cache-Control` | `private, max-age=31536000, immutable`. A browser may keep showing a file from its cache after it was deleted or made private. |
| `Content-Security-Policy`, `X-Content-Type-Options` | `sandbox; default-src 'none'` and `nosniff`. Stored bytes can never run as a page. |

| Status | `code` | When |
|---|---|---|
| 404 | `not_found` | Unknown id, deleted, in the trash, or private and not the caller's. "That file does not exist." |
| 404 | `not_found` | `poster=1` on an asset with no poster (`posterUrl` is `null`). "Not found." |
| 404 | `not_found` | The row exists but the file is missing on disk. "That file is gone." |
| 416 | (no body) | The requested range starts past the end of the file. |

Errors are JSON, so a broken `<img>` or `<video>` simply fails to load. Handle `onError`.

---

## Wallet

### `GET /api/wallet`

Auth: signed in (guest ok).

| Query | Values | Default |
|---|---|---|
| `limit` | 1–200, clamped: history entries to return | 50 |
| `before` | a history entry's `id`; returns only older entries | first page |

Response `200`: a `Wallet` (shape above).
```json
{
  "balance": 59800,
  "plan": { "id": "free", "name": "Free", "concurrency": 4, "monthlyCredits": 0, "priceUsd": 0 },
  "packs": [
    { "id": "pack-100", "credits": 100, "priceUsd": 5 },
    { "id": "pack-500", "credits": 500, "priceUsd": 22 },
    { "id": "pack-2000", "credits": 2000, "priceUsd": 80 }
  ],
  "demoBilling": true,
  "history": [
    { "id": 8, "kind": "charge", "amount": -200, "note": "FLUX Schnell", "jobId": "job_Qm3xT8vLp2RkZ9aB", "createdAt": 1794562400000 },
    { "id": 1, "kind": "grant", "amount": 60000, "note": "Guest starter credits", "jobId": null, "createdAt": 1794562390000 }
  ]
}
```
Only `history` is paged. Pass the `id` of the last entry as `before`; a page shorter than
`limit` is the last one. `balance`, `plan` and `packs` come with every page. This endpoint
has no errors of its own.

Remember the units: `balance` and `amount` are millicredits, `packs[].credits` and
`plan.monthlyCredits` are whole credits.

### `POST /api/wallet/topup`

Auth: signed in (guest ok). Body (JSON): `{ "packId": "pack-100" }`, an `id` from `packs`.

There is no payment step yet. The pack's credits are added for free and recorded as a
`topup` entry with the note "100 credits (demo top-up)". Label the button as a demo. When
`demoBilling` is `false` this endpoint is closed (`403`); hide the buy buttons. Demo billing is
open by default only in mock mode; a live server opens it only with `PARALLAX_DEMO_BILLING=on`.

Response `200`:
```json
{ "balance": 159800 }
```

| Status | `code` | When (message) |
|---|---|---|
| 403 | `forbidden` | Demo billing is switched off on the server. "Top-ups are not open yet." |
| 400 | `invalid_request` | `packId` missing or unknown. "Pick a credit pack." |
| 429 | `rate_limited` | More than 20 top-ups in one hour by this account. |

---

## Behaviour notes

### Paging

Jobs and assets page the same way. Each item carries a numeric `cursor`. To read on, repeat
the request with `before=<cursor of the last item>` and the same filters. Items come newest
first, so `before` always moves back in time. There is no total count and no "has more"
flag: stop when a page has fewer items than `limit`. Wallet history uses the entry's `id` in
place of `cursor`. `before=0` is the same as leaving it out.

### Polling for progress

There is no push channel and no percent field. Poll.

- **The list endpoint is enough.** Poll the same list the feed shows, without a status filter
  (`GET /api/jobs?surface=image&limit=40`). A finished job comes back in that answer with its
  `assets`, so no second request is needed. `GET /api/jobs/:id` is for a page that shows one job.
- **Do not poll with `status=active` only.** A job leaves that list the moment it finishes,
  so its results never arrive there. Use it for a "N running" badge.
- **Interval: 1.5 seconds**, only while at least one job on screen is `queued` or `running`.
  Stop when none is. The server moves jobs along once a second, so polling faster gains
  nothing. `useJobs(surface)` does exactly this.
- **What changes between polls:** `status`, `startedAt`, `finishedAt`, `assets` (empty until
  `succeeded`), `error` (null until `failed`) and sometimes `cost` (it can drop on success).
  Everything else is fixed when the job is queued.
- **Progress bar:** once `startedAt` is set, show
  `min(0.95, (Date.now() - startedAt) / (eta * 1000))`. While `queued`, show a waiting state.
  `eta` is typical, not a promise: a job can take longer and still succeed.
- A job can go `running` → `queued` → `running` when a busy model is retried (up to 6 tries,
  waiting 3 to 48 seconds between them). `startedAt` keeps its first value. Do not treat
  the step back as an error.
- A job that gets no result is failed with `timeout` after 10 minutes (30 for video), so
  polling always ends.
- **When polling stops, refresh the balance** (`GET /api/auth/me`): a failed job gave its
  credits back and a succeeded one may have been partly refunded.
- Jobs made by one press share `batchId`. Group tiles by it. For a model with
  `batch.native`, one job holds all the results instead (`count` > 1, several `assets`).

For testing: when the server runs in mock mode (`TREG_MODE=mock`, or no provider token is
set) results are made locally in a few seconds and cost no real money, and a prompt that
contains `[fail]` fails on purpose with `provider_error`.

### Credits: hold, charge, release, refund

| Moment | What happens to credits | Seen in the API |
|---|---|---|
| `POST /api/jobs` accepted | The price of each job is **held** at once. | `balance` in the answer is already lower. Wallet shows a `hold` entry per job. |
| Job `succeeded` | The hold becomes the **charge**. | The same entry now has kind `charge`. |
| Succeeded, model billed by usage and it used less | The difference is **refunded** and `job.cost` is lowered to the real price. | A `refund` entry: "Refund: the model used less than quoted". |
| Succeeded with fewer results than `count` | The share for the missing results is **refunded**. The job is still `succeeded`; `assets.length < count`. `job.cost` is not changed. | A `refund` entry: "Refund: 1 of 2 results". |
| Job `failed` (any `error.code`, including `timeout`) | The whole hold is **released**. | Balance is back. The hold disappears from the history. |
| Queued job canceled with `DELETE` | The whole hold is **released**. | `balance` in the DELETE answer is back. No history entry remains. |
| Finished job removed with `DELETE` | Nothing. A charge is never returned by removing a job. | — |

A job that fails costs nothing. There is no partial charge for a failed job.

### Showing and downloading files

- Use `asset.url` and `asset.posterUrl` as they are, in a plain `<img>`, `<video>` or
  `<audio>` tag on a page of the app. The browser sends the session cookie by itself.
- The URLs are **cookie-protected**. They do not work from another origin, in a request
  made by a server (an image optimizer, a server component fetch), or in anything that
  drops cookies. Use `<img>`, not an optimizing image component.
- Thumbnails: an image is its own thumbnail (`url`); a video uses `posterUrl` when it is not
  `null`; audio has none.
- Download link: `<a href={asset.url + "?download=1"}>`.
- The URL of an asset never changes and its bytes never change, so it is cached for a year.
  Do not add cache-busting parameters.
- A file in the library trash answers 404 on its normal URL until it is restored
  (`library.md` has a separate preview URL for the trash).

### From upload to job input

1. Make sure there is a session (`POST /api/auth/guest` when signed out).
2. For each file: `POST /api/assets` with `file` and `accept = slot.accept.join(",")`.
   Keep the returned `asset` (show `asset.url` or `asset.posterUrl` as the chip).
3. On Generate send `inputs: { [slot.id]: [asset.id, …] }`, with only the slots that hold
   files. The order of the ids is the order the model receives them.
4. Any file the person already owns works the same way: take ids from `GET /api/assets` or
   from a job's `assets`. No new upload is needed.

Check `slot.min`, `slot.max` and `slot.accept` in the UI first; the server checks them again
and answers 400 with a message that names the slot. If a referenced file is deleted before
the job starts, the job fails with `error.code: "invalid_request"` and the credits return.

---

## Typical flow

A first-time visitor generates two images with `flux-schnell` (a model with `batch.native`,
so one job returns both). Ids, sizes and times are examples. The price is what the current
catalog gives (200 millicredits for two images).

**1. Is anyone signed in?** `GET /api/auth/me`
```json
{ "user": null, "balance": 0 }
```

**2. No: make a guest.** `POST /api/auth/guest` (no body). The cookie is set.
```json
{
  "user": { "id": "usr_Zp6dW3nHx0CgY7eM", "email": null, "handle": "guest-3fa91c", "name": "Guest",
            "isGuest": true, "plan": "free", "avatarUrl": null, "bio": "", "createdAt": 1794562390000 },
  "balance": 60000
}
```

**3. Generate.** `POST /api/jobs`
```json
{
  "modelId": "flux-schnell",
  "prompt": "a red fox in snow, soft morning light",
  "values": { "aspect": "16:9" },
  "inputs": {},
  "count": 2,
  "surface": "image"
}
```
Answer:
```json
{
  "jobs": [
    {
      "id": "job_Qm3xT8vLp2RkZ9aB", "kind": "image", "surface": "image",
      "modelId": "flux-schnell", "modelName": "FLUX Schnell", "status": "queued",
      "prompt": "a red fox in snow, soft morning light",
      "params": { "aspect": "16:9" }, "inputs": {}, "count": 2, "cost": 200,
      "error": null, "batchId": null, "meta": {}, "output": "image", "eta": 4,
      "createdAt": 1794562400000, "startedAt": null, "finishedAt": null,
      "assets": [], "cursor": 57
    }
  ],
  "balance": 59800
}
```
Show the tile and the new balance at once.

**4. Poll.** `GET /api/jobs?surface=image&limit=40` every 1.5 s. First the job is running:
```json
{ "jobs": [ { "id": "job_Qm3xT8vLp2RkZ9aB", "status": "running", "startedAt": 1794562400040,
              "finishedAt": null, "assets": [], "error": null, "eta": 4, "…": "…" } ] }
```
Then it is done (here in mock mode, which makes PNG files):
```json
{
  "jobs": [
    {
      "id": "job_Qm3xT8vLp2RkZ9aB", "kind": "image", "surface": "image",
      "modelId": "flux-schnell", "modelName": "FLUX Schnell", "status": "succeeded",
      "prompt": "a red fox in snow, soft morning light",
      "params": { "aspect": "16:9" }, "inputs": {}, "count": 2, "cost": 200,
      "error": null, "batchId": null, "meta": {}, "output": "image", "eta": 4,
      "createdAt": 1794562400000, "startedAt": 1794562400040, "finishedAt": 1794562403100,
      "assets": [
        {
          "id": "ast_h4NwE7cJx1UyD6sG", "kind": "image", "source": "generated", "mime": "image/png",
          "bytes": 81234, "width": 1024, "height": 576, "duration": null,
          "url": "/api/assets/ast_h4NwE7cJx1UyD6sG/file", "posterUrl": null,
          "title": "", "prompt": "a red fox in snow, soft morning light",
          "modelId": "flux-schnell", "params": { "aspect": "16:9" },
          "favorite": false, "folderId": null, "isPublic": false,
          "jobId": "job_Qm3xT8vLp2RkZ9aB", "createdAt": 1794562403050, "cursor": 112
        },
        {
          "id": "ast_b9KfA2mVt5XqL8rP", "kind": "image", "source": "generated", "mime": "image/png",
          "bytes": 79872, "width": 1024, "height": 576, "duration": null,
          "url": "/api/assets/ast_b9KfA2mVt5XqL8rP/file", "posterUrl": null,
          "title": "", "prompt": "a red fox in snow, soft morning light",
          "modelId": "flux-schnell", "params": { "aspect": "16:9" },
          "favorite": false, "folderId": null, "isPublic": false,
          "jobId": "job_Qm3xT8vLp2RkZ9aB", "createdAt": 1794562403080, "cursor": 113
        }
      ],
      "cursor": 57
    }
  ]
}
```
No job is `queued` or `running` any more, so stop polling.

**5. Show the results.**
```html
<img src="/api/assets/ast_h4NwE7cJx1UyD6sG/file" width="1024" height="576" alt="">
<a href="/api/assets/ast_h4NwE7cJx1UyD6sG/file?download=1">Download</a>
```

**6. Refresh the balance.** `GET /api/auth/me` → `{ "user": { … }, "balance": 59800 }`

**Had it failed**, step 4 would end with the job below, and step 6 would show `60000` again:
```json
{ "id": "job_Qm3xT8vLp2RkZ9aB", "status": "failed", "assets": [],
  "error": { "code": "provider_error", "message": "The model returned no result." },
  "finishedAt": 1794562403100, "…": "…" }
```

**With reference images** the only differences are an upload first and a filled `inputs`.
`nano-banana-2-lite` takes up to 3 images in its `refs` slot and queues one job per result:

`POST /api/assets` (multipart: `file`, `accept=image`) → `{ "asset": { "id": "ast_h4NwE7cJx1UyD6sG", … } }`

`POST /api/jobs`
```json
{
  "modelId": "nano-banana-2-lite",
  "prompt": "the same fox, now at night under northern lights",
  "values": { "aspect": "16:9", "resolution": "1K" },
  "inputs": { "refs": ["ast_h4NwE7cJx1UyD6sG"] },
  "count": 2,
  "surface": "image"
}
```
The answer holds **two** jobs, each with `count: 1`, `inputs: { "refs": ["ast_h4NwE7cJx1UyD6sG"] }`
and the same `batchId` (`"bat_…"`). Each has its own `cost`, and `balance` has dropped by both.
