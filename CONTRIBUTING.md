# Contributing to Parallax

Parallax is an open-source AI image, video and audio studio. This page is for people and
agents changing it. Read it before you write code. Also read `AGENTS.md`: this is
Next.js 16, and it differs from older versions.

This page covers the server side: tables, logic, API routes. **If you are building a
screen, your guide is `docs/ui/README.md`.**

## How to send a change

1. Open an issue first for anything larger than a small fix, so the approach can be agreed.
2. Work on a branch. Keep one change per pull request.
3. Run the checks at the bottom of this page. They must pass.
4. Say in the pull request what you changed, why, and what you tested.

Looking for somewhere to start? Each page in `docs/api/` ends with an "Open improvements"
section: known gaps, written down by the people who built that feature.

## How the app is laid out

| Path | What it is |
|---|---|
| `migrations/001_core.sql` | Core tables: users, sessions, ledger, jobs, folders, assets |
| `src/server/*.ts` | The core: database, auth, credits, jobs, worker, assets, provider gateway |
| `src/registry/` | Every model: its controls, media slots, price and request builder |
| `src/config/` | Brand, plans, credit prices |
| `src/app/api/{auth,jobs,assets,wallet}/` | Core API routes |
| `src/server/<feature>/` | A feature's server code |
| `src/app/api/<feature>/` | A feature's API routes |
| `migrations/<NNN>_<feature>.sql` | A feature's tables |
| `tests/<feature>.py` | A feature's API test |
| `docs/api/<feature>.md` | A feature's API reference |
| `src/ui/`, `src/lib/`, `src/components/{brand,studio,shell,entry}/`, `src/content/{site,media}.ts`, `src/app/{layout.tsx,globals.css}` | Shared screen code: controls, hooks, composer, nav, tokens |
| `src/app/<page>/`, `src/components/<feature>/`, `src/content/<feature>.ts`, `tests/ui/<feature>.mjs` | A feature's screens (see `docs/ui/README.md`) |

Keep a feature inside its own paths. A change to the core or to shared screen code touches
every feature, so send it as its own pull request and say what you checked.

Avoid new npm dependencies. If you truly need one, say why in the pull request.

## Rules that are easy to get wrong

**Routes.** Every route goes through `route()` (signed-in member, guests count) or
`publicRoute()` (works signed out, `ctx.user` may be null) from `@/server/http`. They read
the session, refuse cross-site writes, and turn a thrown `ApiError` into one error shape:

```json
{ "error": { "code": "not_found", "message": "That folder does not exist." } }
```

`message` is shown to the member as written. Write it for them: short, plain, no jargon.
Do not export `runtime` or `dynamic` from a route file. `context.params` is a Promise;
the wrappers already await it and hand you `ctx.params`. Read JSON bodies with
`readJson(req)`. Never trust a body: check every field's type and length yourself.

```ts
import { badRequest, notFound, readJson, route } from "@/server/http";

/** PATCH /api/folders/:id  { name } */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  const body = await readJson(req);
  if (typeof body.name !== "string" || !body.name.trim()) throw badRequest("Give the folder a name.");
  return { folder: renameFolder(user.id, params.id, body.name.trim().slice(0, 80)) };
});
```

**Database.** Use `get`, `all`, `run`, `tx`, `newId`, `parseJson` from `@/server/db`.
Always pass values as parameters, never build SQL from input. Every query that touches a
member's data filters by `user_id`. Asking for someone else's row answers 404, not 403.
Times are Unix milliseconds. Credit amounts are millicredits (1 credit = 1000). Ids come
from `newId("<short prefix>")`.

**Migrations.** One new file, `migrations/<NNN>_<feature>.sql`, with the next free
number. It runs once, in a transaction, when the server first opens the database. Prefer
your own tables that point at core rows (`asset_id`, `user_id`, `job_id`). Do not `ALTER`
a core table. Never edit a migration that already exists.

**Generating media.** There is exactly one way to start a generation, and it handles
validation, price, credits, limits and the worker for you:

```ts
import { submitJobs } from "@/server/jobs";
const jobs = submitJobs(user, { modelId, prompt, values, inputs, count, surface: "your-surface", meta: { yourId } });
```

Never call the provider gateway yourself, never write to `jobs` or `ledger` directly, and
never move credits except through `@/server/credits`. Read jobs with `getJob` and
`listJobs`. The `meta` you pass comes back on the job. Models live in `@/registry`
(`models`, `getModel`, `modelsFor`, `quoteJob`); only use model ids that exist there.

**Files.** Media lives in the assets table and on disk. Use `@/server/assets`
(`saveAsset`, `ownedAsset`, `visibleAsset`, `listAssets`, `toAsset`, `fileResponse`).
Never build a file path from input. Never send a provider's link to the browser; members
only ever get `/api/assets/<id>/file` links.

**Secrets and privacy.** No secrets in code, logs, error messages or test output. A member
must never be able to read, change or use another member's private data. Test that.

**Clean room.** Parallax is its own product. Do not copy another product's text, names,
images or brand. Write your own wording.

**Style.** TypeScript, strict. Small files, plain names, comments that say why. Match the
style around you; read two or three core files before you start.

## Mock mode and tests

`TREG_MODE=mock` makes every model answer with a built-in sample file after a short delay.
It needs no key and spends nothing. A prompt containing `[fail]` makes the mock model fail,
so you can test failure paths. Always develop and test in mock mode.

```bash
npm ci
npm run typecheck          # must pass
npm run check:registry     # must pass
npm run build              # must pass
python3 tests/run.py tests/core_e2e.py tests/<feature>.py    # must pass
```

`tests/run.py` starts the built app in mock mode on an empty database, runs each test file
as `python3 <file> <base-url>`, and stops the app. It removes every `*_API_KEY` and `*_TOKEN`
variable from the app's environment, so a test can never reach a real service. Write `tests/<feature>.py` in the same
style as `tests/core_e2e.py`: Python standard library only, one `check(name, ok, detail)`
line per behaviour, exit code 0 only when every check passes. Cover the happy path, bad
input, signed-out access, and one member trying to reach another member's data.

## What a feature change includes

1. The code, inside the feature's paths.
2. `tests/<feature>.py`, passing, and `tests/core_e2e.py` still passing.
3. `docs/api/<feature>.md` kept true: every route with method, path, request, response and
   errors, a short example for each, and the tables it uses.
