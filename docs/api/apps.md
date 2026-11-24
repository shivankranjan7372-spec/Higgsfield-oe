# Apps API

An **app** is a one-purpose tool: restyle a photo, put a product in a scene, add a camera move to a
still, animate between two frames. Each app runs on one registry model. The member fills a small form
(a few fields, one or two upload tiles, sometimes an aspect or length picker) and presses one button.
The server turns the form into a prompt, maps the uploads onto the model's media slots, and queues the
generation through the normal jobs pipeline. Results show up as ordinary jobs and assets.

All amounts are **millicredits** (1 credit = 1000). All times are Unix **milliseconds**. Errors use the
standard shape, and `message` is written to be shown to the member as is:

```json
{ "error": { "code": "invalid_request", "message": "Add photo first." } }
```

| Route | Who | What |
|---|---|---|
| `GET /api/apps` | anyone | The catalog, with filters, search, sort and facets |
| `GET /api/apps/:id` | anyone | One app with its form and the price of its defaults |
| `POST /api/apps/:id/price` | anyone | The price of the form as filled so far |
| `POST /api/apps/:id/run` | member | Run the app |
| `GET /api/apps/:id/runs` | member | The member's past runs of this app, with results |
| `PUT /api/apps/:id/pin` · `DELETE /api/apps/:id/pin` | member | Pin / unpin |
| `GET /api/apps/pinned` | member | Pinned apps |
| `GET /api/apps/recent` | member | Recently used apps |
| `GET /api/apps/check` | anyone | Catalog self-check (for tests and operators, not for screens) |

"Member" routes answer `401 unauthorized` when signed out. Guest accounts count as members.
Writes (`POST`, `PUT`, `DELETE`) from another site answer `403 forbidden`.

---

## Objects

### AppSummary

Returned by every list.

```json
{
  "id": "restyle",
  "name": "Restyle",
  "category": "image-tool",
  "categoryLabel": "Image tools",
  "pitch": "Redraw any photo in a new art style, keeping who and what is in it.",
  "tags": ["style", "art", "photo"],
  "status": "available",
  "note": null,
  "badge": "trending",
  "result": "image",
  "modelId": "nano-banana-2",
  "modelName": "Nano Banana 2",
  "added": "2026-10-01",
  "runs": 12,
  "price": { "millicredits": 2100, "credits": "2.1", "perResult": 2100, "count": 1 },
  "pinned": false
}
```

| Field | Meaning |
|---|---|
| `category` | `image-tool`, `video-tool`, `effect` or `template` |
| `status` | `available`: can run. `soon`: show it greyed out, it cannot run. |
| `note` | Why a `soon` app cannot run yet (show it as a tooltip). Null when available. |
| `badge` | `new`, `trending` or null. Marketing only. |
| `result` | What a run makes: `image`, `video` or `audio`. |
| `added` | `YYYY-MM-DD`, used by the "new" sort. |
| `runs` | Runs by all members. Used by the "popular" sort. |
| `price` | A **Price** for a run with the form's defaults and the fewest files. Null for `soon` apps. |
| `pinned` | Whether this member pinned it. **Null when signed out.** |
| `lastRunAt` | Only in `GET /api/apps/recent`: when this member last ran it. |

### Price

```json
{ "millicredits": 4200, "credits": "4.2", "perResult": 2100, "count": 2 }
```

`credits` is preformatted for the button ("Run · 4.2"). `count` is how many results the run makes.
The price is exact: it is the same number that is held from the balance when the app runs.

### AppDetail (`GET /api/apps/:id`)

An **AppSummary** plus `eta` (typical seconds to a result, for a progress bar) and `form`:

```json
"form": {
  "fields": [ Field, ... ],
  "inputs": [ Input, ... ],
  "controls": [ Control, ... ],
  "maxCount": 4
}
```

Draw the form in this order: inputs (upload tiles), fields, controls, then a count picker if
`maxCount > 1` (it may be hidden; the count defaults to 1).

**Field** — something the member types or picks. Four types:

| `type` | Extra keys | Draw as | Send |
|---|---|---|---|
| `text` | `required`, `default`, `placeholder?`, `maxLength`, `hint?` | text box (multi-line if `maxLength` > 200) | string |
| `choice` | `options: [{ value, label }]`, `default` | chips, or a menu for more than ~6 options | one `value` |
| `number` | `min`, `max`, `step`, `default`, `unit?` | slider | number |
| `colour` | `default` (`#rrggbb`) | colour swatch / picker | `#rrggbb` string |

Every field has `id`, `label` and optional `hint`. A missing field takes its default. Braces and
control characters are removed from text; whitespace is collapsed.

**Input** — an upload tile:

```json
{ "id": "person", "label": "Person", "hint": "A full-body or half-body photo.", "accept": ["image"], "min": 1, "max": 1 }
```

`min: 0` means optional. `max > 1` means the tile takes several files. `accept` lists the asset kinds
that fit (`image`, `video`, `audio`). Files are **asset ids** from the core assets API (upload with
`POST /api/assets`, or pick from the member's library).

**Control** — a model setting the app leaves to the member, typically `aspect` or `voice`. These are
the registry's own control objects (see `src/registry/types.ts`, read by the composer too):
`{ id, label, type: "select" | "slider" | "toggle" | "text", ... }`. A `select` has
`options: [{ value, label, hint?, when? }]` and `display` (`aspect` draws ratio glyphs, `chips`, `menu`).
`default` is already the app's own starting value. Every other model setting is fixed by the app.

### AppRun

```json
{
  "id": "arun_nG31zHTB5noqa2Tg",
  "appId": "restyle",
  "fields": { "style": "pixel", "strength": 3 },
  "values": { "aspect": "16:9" },
  "inputs": { "photo": ["ast_x..."] },
  "jobs": [ Job, ... ],
  "createdAt": 1763000000000,
  "cursor": 17
}
```

`fields`, `values` and `inputs` are what was used, so a "run again" button can refill the form.
`jobs` are standard **Job** objects from the core jobs API (`status`, `assets`, `error`, `cost`, ...).
Poll `GET /api/jobs/:id` until `status` is `succeeded` or `failed`. A `404` while polling means
the job was canceled or removed: stop polling and drop its tile. A job the member
removed is left out of `jobs`. Every app job has `surface: "app-<appId>"` and
`meta: { "appId": "...", "appRunId": "arun_..." }`, so the library and history screens can label it
("Made with Restyle") and link back to the app.

---

## GET /api/apps

Query (all optional):

| Param | Values | Default |
|---|---|---|
| `category` | `image-tool`, `video-tool`, `effect`, `template` | all |
| `tag` | one tag, e.g. `product` | none |
| `q` | search words, matched against name, pitch, tags and category | none |
| `sort` | `featured` (catalog order), `popular` (most runs), `new` (newest `added`), `name` | `featured` |
| `status` | `all`, `available`, `soon` | `all` |

`featured` and `popular` put `soon` apps last.

```
GET /api/apps?category=effect&sort=popular
200 {
  "apps": [AppSummary, ...],
  "categories": [{ "id": "image-tool", "label": "Image tools", "count": 26 }, ...],
  "tags": [{ "id": "photo", "count": 9 }, ...]
}
```

`categories` always counts the whole catalog (for tabs). `tags` counts the apps in the chosen category
(for a chip row), most used first.

Errors: `400 invalid_request` for an unknown `category`, `sort` or `status`.

## GET /api/apps/:id

```
GET /api/apps/camera-move
200 { "app": AppDetail }
```

Works for `soon` apps too (their `price` is null and `form` may be partial). Errors: `404 not_found`.

## POST /api/apps/:id/price

Prices the form as it stands, for a live price on the Run button. Required text fields may still be
empty. Inputs may be given as **file id lists or plain counts**, so the price can update before uploads
finish. Missing inputs count as their `min`.

```
POST /api/apps/camera-move/price
{ "fields": { "move": "orbit" }, "values": { "aspect": "9:16" }, "inputs": { "image": 1 }, "count": 2 }

200 { "price": { "millicredits": 6800, "credits": "6.8", "perResult": 3400, "count": 2 },
      "values": { "aspect": "9:16" } }
```

`values` echoes the open controls as they will really be used (an illegal value falls back to the
default; a value for a fixed setting is ignored). Errors: `400` for a bad field value or count,
`404` unknown app, `409 app_unavailable` for a `soon` app.

## POST /api/apps/:id/run

```
POST /api/apps/outfit-try-on/run
{
  "fields": { "fit": "Sleeves rolled up" },
  "values": {},
  "inputs": { "person": ["ast_a..."], "outfit": ["ast_b...", "ast_c..."] },
  "count": 1
}

200 { "run": AppRun, "jobs": [Job, ...], "balance": 57900 }
```

`jobs` is the same list as `run.jobs`, all `queued`. `balance` is after the hold. Credits are held at
once, charged when a job succeeds and given back when it fails.

| Status | `code` | When |
|---|---|---|
| 400 | `invalid_request` | A field is wrong ("Fill in "New background" first.", "Pick one of the options for "Style"."), an input has too few or too many files or is not a list, the file is the wrong kind, `count` is out of range, the body is not a JSON object |
| 401 | `unauthorized` | Signed out |
| 402 | `insufficient_credits` | Not enough credits; the message says how many are needed |
| 403 | `forbidden` | Cross-site request |
| 404 | `not_found` | Unknown app, or a file id that is not the member's |
| 409 | `app_unavailable` | The app is `soon` (or its model is offline) |
| 409 | `model_unavailable` | The model cannot take requests right now |
| 429 | `too_many_jobs` | The plan's limit of jobs at once is reached |

## GET /api/apps/:id/runs

`?limit=` (1–50, default 20), `?before=<cursor>` for the next page. Newest first.

```
GET /api/apps/restyle/runs?limit=10
200 { "runs": [AppRun, ...] }
```

Only the signed-in member's runs. `404` for an unknown app.

## PUT /api/apps/:id/pin, DELETE /api/apps/:id/pin

No body. Both are safe to repeat.

```
PUT /api/apps/restyle/pin      200 { "appId": "restyle", "pinned": true }
DELETE /api/apps/restyle/pin   200 { "appId": "restyle", "pinned": false }
```

`404` for an unknown app.

## GET /api/apps/pinned

```
200 { "apps": [AppSummary, ...] }   // most recently pinned first
```

## GET /api/apps/recent

`?limit=` (1–50, default 12).

```
200 { "apps": [AppSummary & { "lastRunAt": 1763000000000 }, ...] }   // most recently run first
```

## GET /api/apps/check

```
200 { "ok": true, "apps": 73, "available": 60, "problems": [] }
```

Runs the catalog check (see below) once per server process. An app with a problem is reported here
and shown as `soon`, so a bad entry can never run.

---

## The catalog

73 apps: 60 runnable and 13 marked `soon`.

| Category | Runnable | Examples |
|---|---|---|
| Image tools | 21 | Restyle, Product in a scene, Character sheet, Outfit try-on, Put me in the picture, Headshot, Relight, New angle, Expand the frame, Sketch to render, Restore old photo, New background, Remove something, Change the season, Time of day, Try a hair colour, Room makeover, Logo mockup, On a model, Mix references, Menu shot |
| Video tools | 12 | Bring a photo to life, Camera move, Frame to frame, Product turntable, Talking photo, Big reveal, Time-lapse, Weather change, Aerial flyover, Product ad, Cinemagraph, Story short |
| Effects | 17 | 12 one-tap video effects (Levitate, Melt, Turn to stone, Confetti burst, ...) and 5 image effects (Clay me, Boxed figure, Royal pet portrait, Pixel hero, Plush toy) |
| Templates | 10 | Event poster, Video thumbnail, Greeting card, Sticker pack, Comic strip, Seamless pattern, Tattoo idea, Shop listing set, Jingle (audio), Voice-over (audio) |
| Soon | 13 | Upscale, Remove background, Face swap, Paint to edit, Split into layers, Video upscale, Extend a clip, Video face swap, Lip sync, Motion transfer, Video background removal, Change aspect ratio, Smooth motion |

The `soon` apps need models the registry does not have (upscalers, matting, face identity, masks,
lip sync, anything that takes a video in).

Apps are data in `src/server/apps/catalog/*.ts`. Each one names a registry model, fixed control
values, the controls left open, a prompt template, typed fields and inputs mapped to model slots.
The template engine only replaces `{{field}}` with checked values and keeps `{{?field}}...{{/field}}`
when the field is not empty. It never evaluates anything, and member text cannot add placeholders.

**Checks** (`src/server/apps/check.ts`): the model exists and is available; the result kind matches
the model; every fixed value survives `resolveValues` unchanged; every open control exists; every
input maps to a real slot and the form can neither overfill nor underfill a slot; the template names
only real fields and uses every field; the longest possible prompt fits the model's limit; and the
price is an exact price row for the defaults and for every option of every open control, with the
fewest and the most files.

## Tables (`migrations/050_apps.sql`)

`app_runs` — one row per press of Run: `id` (`arun_...`), `user_id`, `app_id`, `fields` (JSON),
`vals` (member-set control values, JSON), `inputs` (`{ inputId: [assetId] }`, JSON), `job_ids` (JSON),
`created_at`. Feeds past runs, recently used and the popular sort.

`app_pins` — `(user_id, app_id)` primary key, `created_at`.

The catalog is not in the database. Renaming or removing an app leaves old rows that are skipped.

## Open improvements

1. **Allow `:` in job surfaces.** `submitJobs` accepts a surface only if it matches
   `^[a-z0-9-]{1,40}$`, so a surface such as `app:<id>` is silently replaced by the model's
   default surface. Apps use `app-<id>` for now. Change wanted in `src/server/jobs.ts`:
   `/^[a-z0-9:-]{1,48}$/`. After that, `surfaceOf` in `src/server/apps/service.ts` can return
   `app:<id>` (one line). Screens should match on `meta.appId`, which will not change.
2. **A `listJobs` filter by surface prefix** (`surfacePrefix: "app-"`) would let a history screen show
   "everything made with apps" without reading `app_runs`. Not needed by this API.
