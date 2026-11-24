# Shot Planner API (`/cinema`)

A film-making workspace. A member plans a **project** as ordered **scenes**, each holding
ordered **shots**. A project also has **elements**: characters, locations and props, each
with a description and reference images. Each shot is described like a director would
(size, angle, movement, lens, depth of field, lighting, mood, duration, sound note, cast,
location). The **composer** turns a shot into one prompt plus reference images, and
**takes** are generations of that shot: a still (image), an animated still (video that
starts from a still), or video from text. The **storyboard** reads the whole project at once.

All routes are under `/api/cinema`. Everything except `GET /api/cinema/catalog` needs a
signed-in member (guests count); signed out answers `401 unauthorized`.

Conventions (same as the rest of Parallax):

- Bodies are JSON objects. Unknown fields are ignored. Writes from another site answer `403 forbidden`.
- Errors: `{ "error": { "code": "...", "message": "..." } }`. Show `message` to the member as written.
  Common codes: `invalid_request` (400), `unauthorized` (401), `not_found` (404),
  `insufficient_credits` (402), `too_many_jobs` (429), `model_unavailable` (409), `limit_reached` (409).
- Anything that belongs to another member answers `404 not_found`, exactly as if it did not exist.
- Times are Unix milliseconds. Prices and balances are **millicredits** (1 credit = 1000).
  Format them with `formatCredits` from `@/config/economy`.
- Ids: projects `cpr_…`, scenes `csc_…`, shots `csh_…`, elements `cel_…`, takes `ctk_…`, batches `cbt_…`.
- Files are only ever linked as `/api/assets/<id>/file` (poster: `?poster=1`).

## Objects

### Project

```json
{
  "id": "cpr_…", "title": "The Lighthouse Keeper", "logline": "A keeper waits for a ship.",
  "aspect": "16:9",
  "look": { "filmStock": "35mm-color", "grade": "cold-steel", "lensFamily": "anamorphic", "lighting": "blue-hour" },
  "stillModelId": "nano-banana-2", "videoModelId": "veo-3.1-lite",
  "createdAt": 0, "updatedAt": 0
}
```

`aspect` is one of `16:9`, `21:9`, `4:3`, `1:1`, `9:16`. Every `look` field is a preset id
from the catalog or `""` (no preference). The list endpoint adds `sceneCount` and `shotCount`.

### Scene

```json
{ "id": "csc_…", "projectId": "cpr_…", "position": 0, "title": "Scene 1", "notes": "", "createdAt": 0 }
```

`position` starts at 0. The storyboard adds `number` (1-based), `plannedSeconds` and `shots`.

### Element (cast, place, prop)

```json
{
  "id": "cel_…", "projectId": "cpr_…", "kind": "character",
  "name": "Ada", "description": "an old keeper in a wool coat",
  "refAssetIds": ["ast_…"], "refs": [{ "assetId": "ast_…", "url": "/api/assets/ast_…/file" }],
  "createdAt": 0
}
```

`kind` is `character`, `location` or `prop`. Up to 8 reference images, each an **image** the
member owns (upload it with `POST /api/assets`, or use any generated image).

### Shot

```json
{
  "id": "csh_…", "projectId": "cpr_…", "sceneId": "csc_…", "position": 0,
  "action": "Ada wipes the great lens and looks out to sea",
  "size": "close-up", "angle": "low", "movement": "push-in", "lens": "85mm", "focus": "shallow",
  "lighting": "", "mood": "melancholy", "duration": 6, "sound": "Wind against glass",
  "castIds": ["cel_ada", "cel_scope"], "locationId": "cel_lamp",
  "selectedTakeId": null,
  "createdAt": 0, "updatedAt": 0,

  "status": "ready", "hasStill": true, "hasVideo": false,
  "selectedTake": { "…Take…" }, "selectedBy": "auto",
  "takes": [ "…Take…" ]
}
```

| Field | Type | Rules |
|---|---|---|
| `action` | string | ≤ 2000 chars. What happens in the shot. |
| `size`, `angle`, `movement`, `lens`, `focus`, `lighting`, `mood` | string | A preset id from the catalog list of the same name, or `""`. `focus` is depth of field. Empty `lighting` falls back to the project look's lighting. |
| `duration` | number | Seconds, 1 to 60, one decimal. Default 5. |
| `sound` | string | ≤ 1000 chars. Dialogue or sound note. Used in video prompts only. |
| `castIds` | string[] | ≤ 12 element ids of kind `character` or `prop`, in billing order. |
| `locationId` | string \| null | An element id of kind `location`. |
| `selectedTakeId` | string \| null | The member's pick. Set via `PATCH`. |

Derived fields (read only):

- `status`: `empty` (no takes), `generating` (a take is queued or running), `ready` (at least
  one finished take), `failed` (the newest take failed and none finished).
- `hasStill`, `hasVideo`: a finished take of that output exists.
- `selectedTake`: the member's pick if it finished; otherwise the newest finished video take;
  otherwise the newest finished still; otherwise `null`. `selectedBy` is `member`, `auto` or `null`.
- `takes`: every take, oldest first (only on single-shot reads, not in the storyboard).
- In the storyboard only: `number` (`"2.3"` = scene 2, shot 3), `takeCount`, `prompt` (the composed video prompt).

### Take

```json
{
  "id": "ctk_…", "shotId": "csh_…", "mode": "animate", "output": "video",
  "sourceTakeId": "ctk_still…", "jobId": "job_…",
  "status": "succeeded", "modelId": "veo-3.1-lite", "prompt": "…", "cost": 5600,
  "error": null,
  "asset": { "id": "ast_…", "kind": "video", "url": "/api/assets/ast_…/file", "posterUrl": "…?poster=1", "duration": 4, "width": 1280, "height": 720, "…": "…" },
  "createdAt": 0
}
```

- `mode`: `still` (image), `animate` (video starting from a still of this shot), `text` (video from words only).
- `status` comes from the job: `queued`, `running`, `succeeded`, `failed`, `canceled`, or
  `removed` (the member deleted the job from their history).
- `error` is `{ code, message }` when failed. `asset` is the finished file (the core `Asset` shape) or `null`.
- To follow progress, poll `GET /api/cinema/shots/:id` (every 1-2 s while `status` is `generating`),
  or the job itself with `GET /api/jobs/:jobId`. The job's `eta` gives typical seconds.

## Catalog

### `GET /api/cinema/catalog` (works signed out)

```json
{
  "presets": {
    "look": { "filmStock": [Preset], "grade": [Preset], "lensFamily": [Preset], "lighting": [Preset] },
    "shot": { "size": [Preset], "angle": [Preset], "movement": [Preset], "lens": [Preset], "focus": [Preset], "lighting": [Preset], "mood": [Preset] },
    "aspects": ["16:9", "21:9", "4:3", "1:1", "9:16"]
  },
  "models": {
    "still": [{ "id": "nano-banana-2", "name": "…", "vendor": "…", "tagline": "…", "aspects": ["1:1", "16:9", "…"], "refSlots": 6, "canAnimate": false, "canTextToVideo": false }],
    "video": [{ "id": "veo-3.1-lite", "…": "…", "refSlots": 0, "canAnimate": true, "canTextToVideo": true }]
  },
  "defaults": { "stillModelId": "nano-banana-2", "videoModelId": "veo-3.1-lite", "aspect": "16:9", "shotDuration": 5 }
}
```

A `Preset` is `{ "id", "label", "phrase" }`. Show `label`; store `id`; `phrase` is what the
composer writes. `refSlots` is how many reference images a still model takes (0 = none).
Only models that can run are listed. A video model with `canAnimate: false` can only be
used for `text` takes, and one with `canTextToVideo: false` only for `animate` takes.

## Projects

### `GET /api/cinema/projects`
→ `{ "projects": [Project + sceneCount + shotCount] }`, most recently changed first.

### `POST /api/cinema/projects`
Body: `{ "title": string (required, ≤120), "logline"?: string (≤600), "aspect"?: string, "look"?: { …preset ids }, "stillModelId"?: string, "videoModelId"?: string }`
→ `{ "project": Project }`. A new project starts with one empty scene, "Scene 1".

Errors: 400 empty title, unknown aspect, unknown look preset, `stillModelId` not an image
model, `videoModelId` not a usable video model. 409 `limit_reached` past 200 projects.

```bash
curl -X POST /api/cinema/projects -d '{"title":"The Lighthouse Keeper","aspect":"21:9","look":{"grade":"cold-steel"}}'
```

### `GET /api/cinema/projects/:id` — the storyboard

```json
{
  "project": Project,
  "elements": [Element],
  "scenes": [{ …Scene, "number": 1, "plannedSeconds": 13, "shots": [Shot (storyboard form)] }],
  "summary": {
    "sceneCount": 2, "shotCount": 8,
    "plannedSeconds": 23,
    "cutSeconds": 8,
    "shotsWithStill": 1, "shotsWithVideo": 2, "generating": 0
  }
}
```

`plannedSeconds` sums the shots' planned `duration`. `cutSeconds` is the running time of
the selected video takes (what `render` would produce). 404 if not yours.

### `PATCH /api/cinema/projects/:id`
Any of the `POST` fields. `look` may be partial: only the given keys change; `""` clears one.
→ `{ "project": Project }`.

### `DELETE /api/cinema/projects/:id`
→ `{ "ok": true }`. Deletes scenes, shots, elements and takes. Generated files stay in the
member's library and job history. Waiting batch items are canceled.

## Scenes

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/cinema/projects/:id/scenes` | `{ title?: ≤120, notes?: ≤2000 }` | `{ scene }`, added at the end. Default title "Scene N". Max 100 per project. |
| PATCH | `/api/cinema/scenes/:id` | `{ title?, notes? }` | `{ scene }` |
| DELETE | `/api/cinema/scenes/:id` | — | `{ ok: true }`. Deletes its shots and their takes; positions close up. |
| POST | `/api/cinema/scenes/:id/duplicate` | — | `{ scene, shots }`. Copy placed right after, titled "… (copy)". Shots are copied without takes. |
| PUT | `/api/cinema/projects/:id/scenes/order` | `{ sceneIds: [every scene id, new order] }` | The full storyboard (same as `GET /projects/:id`). 400 unless the list has every scene exactly once. |

## Shots

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/cinema/scenes/:id/shots` | shot fields (all optional) | `{ shot }`, added at the end of the scene. Max 100 per scene. |
| GET | `/api/cinema/shots/:id` | — | `{ shot }` with `takes` |
| PATCH | `/api/cinema/shots/:id` | any shot field, `selectedTakeId`, `sceneId` | `{ shot }` |
| DELETE | `/api/cinema/shots/:id` | — | `{ ok: true }` |
| POST | `/api/cinema/shots/:id/duplicate` | — | `{ shot }`, placed right after the original, no takes |
| PUT | `/api/cinema/scenes/:id/shots/order` | `{ shotIds: [every shot id of the scene, new order] }` | `{ shots: [Shot fields] }` |

`PATCH` details:
- `selectedTakeId`: a take of this shot (404 otherwise), or `null` to go back to automatic.
- `sceneId`: moves the shot to the end of another scene in the same project.
- Errors: 400 unknown preset id, duration outside 1-60, a location in `castIds`, a non-location
  as `locationId`; 404 an element from another project or member.

```bash
curl -X POST /api/cinema/scenes/csc_1/shots -d '{"action":"Ada climbs the stairs","size":"wide","movement":"follow","duration":4,"castIds":["cel_ada"]}'
```

## Cast, places and props

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/cinema/projects/:id/elements` | — | `{ elements }` |
| POST | `/api/cinema/projects/:id/elements` | `{ kind, name (≤80), description? (≤1000), refAssetIds? (≤8) }` | `{ element }` |
| GET | `/api/cinema/elements/:id` | — | `{ element }` |
| PATCH | `/api/cinema/elements/:id` | `{ name?, description?, refAssetIds? }` (kind cannot change) | `{ element }` |
| DELETE | `/api/cinema/elements/:id` | — | `{ ok: true }`. Also removed from every shot's cast or location. |

Errors: 400 bad kind, empty name, a reference that is not an image; 404 a reference file the
member does not own. Max 100 elements per project.

## The prompt composer

The composer is deterministic: the same project, shot and elements always produce the same
prompt and the same reference list. It writes these sentences in this order and skips any
part that is empty:

1. **Framing**: `<size phrase> <angle phrase>.` — e.g. `Close-up from a low angle.` (angle alone: `Shot from a low angle.`)
2. **Action**: the action text, capitalised, ending in a full stop.
3. **Cast**: `Featuring Ada (an old keeper in a wool coat); Brass telescope.` — characters and props in `castIds` order; description in brackets when present.
4. **Place**: `Location: The lamp room, glass walls, a huge lens.`
5. **Camera movement** (video only): the movement phrase, e.g. `The camera slowly pushes in.`
6. **Lens and depth of field**: `Shot with a 85mm portrait lens, shallow depth of field with a soft background.`
7. **Lighting**: `Lighting: <shot lighting, else the project's look lighting>.`
8. **Mood**: `Mood: melancholic.`
9. **Look**: `Look: <film stock>, <colour grade>, <lens family>.`
10. **Sound** (video only): `Sound: <sound note>.`

An empty result becomes `A cinematic shot.`. The prompt is cut to the model's prompt limit
(a note says so).

Model settings:
- `aspect` is the project's aspect when the model offers it; otherwise the model default, with a note.
- For video, `duration` is the shot's duration; models with fixed lengths get the nearest one (6 s on a 4/6/8 model → 6; 7 s on a 5/10 model → 5).
- Anything in `values` sent with a take overrides these (the job service still checks every value).

Reference images:
- Gathered from the cast (in `castIds` order, each element's `refAssetIds` in order), then the
  location; duplicates and deleted files are skipped.
- **Still** takes put them in the model's `refs` slot, up to the slot's size (extra ones are
  left out, with a note). Models with no `refs` slot get none, with a note.
- **Animate** takes put the chosen still in the `start` slot and use no other references.
- **Text** takes use no images (a note suggests making a still first).

### `GET /api/cinema/shots/:id/compose?mode=still|animate|text&modelId=&fromTakeId=&count=`

Shows exactly what Generate would send, and its price. Nothing is spent.
`mode` defaults to `still`; `modelId` defaults to the project's still or video model;
`count` 1-4.

```json
{
  "modelId": "nano-banana-2", "mode": "still",
  "prompt": "Close-up from a low angle. Ada wipes the great lens…",
  "values": { "aspect": "16:9", "resolution": "1K" },
  "inputs": { "refs": ["ast_…"] },
  "notes": [],
  "sourceTakeId": null,
  "price": { "total": 2100, "perTake": 2100, "takes": 1 }
}
```

Errors: 400 bad mode or wrong model for the mode; 409 `no_still` when `mode=animate` and the
shot has no finished still.

### `GET /api/cinema/compose?mode=still|text&modelId=&aspect=&duration=&count=` (works signed out)

The price of a first take, before a project or a shot exists. The page uses it to put a price
on Generate on a first visit. Nothing is spent and nothing is saved.
`mode` defaults to `still`; `modelId` defaults to the still or video model a new project gets;
`aspect` defaults to `16:9`; `duration` (seconds, 1-60) defaults to 5 and only counts for
`text`; `count` 1-4 (anything else counts as 1).

```json
{
  "modelId": "nano-banana-2", "mode": "still",
  "values": { "aspect": "16:9", "resolution": "1K" },
  "price": { "total": 2100, "perTake": 2100, "takes": 1 }
}
```

There is no prompt, no `inputs` and no `notes`: there is no shot to compose yet. The price is
for the model's settings alone, so it can change once a shot brings reference images.

Errors: 400 for `mode=animate` (a new shot has no still to animate), an unknown mode, a model
that does not fit the mode, an aspect outside the catalog, or a duration outside 1-60.

## Takes (generating)

### `POST /api/cinema/shots/:id/takes`

Body:

| Field | Default | Meaning |
|---|---|---|
| `mode` | `"still"` | `still`, `animate` or `text` |
| `modelId` | project's still model (still) or video model (animate, text) | Must suit the mode: image model for `still`, a video model with a start frame for `animate`, a video model that needs no image for `text`. |
| `count` | 1 | 1-4 takes at once |
| `fromTakeId` | selected still, else newest finished still | `animate` only: the still to start from. Must be a finished still of this shot. |
| `values` | — | Model control overrides, e.g. `{ "resolution": "1080p" }` |

→ `{ "takes": [Take], "balance": millicredits }`. One take per job. Each job is submitted with
`surface: "cinema"` and `meta: { projectId, shotId, mode, batchId? }`, so it also shows up in
the general job list.

Errors: 400 bad mode, wrong model, `count` outside 1-4; 402 `insufficient_credits`;
429 `too_many_jobs` (the plan's limit of jobs at once); 409 `no_still`; 409 `model_unavailable`.

```bash
curl -X POST /api/cinema/shots/csh_1/takes -d '{"mode":"still","count":2}'
curl -X POST /api/cinema/shots/csh_1/takes -d '{"mode":"animate","fromTakeId":"ctk_9"}'
```

### `GET /api/cinema/shots/:id/takes` → `{ "takes": [Take] }`
### `GET /api/cinema/takes/:id` → `{ "take": Take }`
### `DELETE /api/cinema/takes/:id` → `{ "ok": true }`
Takes the take off the shot (and clears it as the selection). The job and file stay in the
member's history and library; to cancel a queued job use `DELETE /api/jobs/:jobId`.

### Selecting a take
`PATCH /api/cinema/shots/:id { "selectedTakeId": "ctk_…" }` (or `null` for automatic).

## Batch: make every missing still

A shot is **missing a still** when it has no still take that finished, is queued, or is running.

### `GET /api/cinema/projects/:id/batch?modelId=`

```json
{
  "quote": {
    "modelId": "nano-banana-2",
    "shots": [{ "shotId": "csh_…", "millicredits": 2100 }],
    "count": 7, "total": 14700,
    "balance": 52000, "affordable": true,
    "concurrency": 4
  },
  "batch": Batch | null
}
```

`shots` are in storyboard order. `concurrency` is how many jobs the member's plan runs at
once. `batch` is the project's most recent batch (for showing progress after a reload).

### `POST /api/cinema/projects/:id/batch`
Body: `{ "modelId"?: string, "expectedTotal"?: millicredits }`. Send the `total` the member
saw as `expectedTotal`; if the price went up since, the call answers `409 price_changed`.
→ `{ "batch": Batch }`.

The server submits as many stills as the plan's limit allows, keeps the rest waiting, and
feeds them in as running jobs finish (checked about once a second). A shot that got a still
by other means while waiting is skipped. If credits run out, the remaining items fail with
the credit message.

Errors: 409 `nothing_to_do` (no shot is missing a still), 409 `batch_running` (one is already
running for this project), 409 `price_changed`, 402 `insufficient_credits` (for the whole total), 400 bad model.

### `GET /api/cinema/batches/:id` → `{ "batch": Batch }`

```json
{
  "id": "cbt_…", "projectId": "cpr_…", "modelId": "nano-banana-2",
  "status": "running",
  "quoted": 14700,
  "counts": { "total": 7, "waiting": 3, "submitted": 4, "finished": 2, "failed": 0, "canceled": 0 },
  "items": [{ "shotId": "csh_…", "status": "submitted", "error": null, "takeId": "ctk_…", "takeStatus": "running" }],
  "createdAt": 0, "updatedAt": 0
}
```

`status`: `running` (items still waiting), `done` (all fed in; takes may still be running —
watch `counts.finished + counts.failed` against `counts.total`), `canceled`.
Item `status`: `waiting`, `submitted`, `skipped`, `failed` (with `error`), `canceled`.
`takeStatus` is the take's status once submitted. Poll every 1-2 s while running.

### `DELETE /api/cinema/batches/:id` → `{ "batch": Batch }`
Stops feeding: waiting items become `canceled`. Already submitted takes keep running.

## Export

### `GET /api/cinema/projects/:id/export?format=json`
A download (`Content-Disposition: attachment; filename="<title>.json"`) of
`{ "format": "parallax-cinema", "version": 1, "exportedAt": ms, …storyboard }`.

### `GET /api/cinema/projects/:id/export?format=csv`
A download `<title>-shots.csv` (UTF-8, CRLF), one row per shot in storyboard order:
`Shot, Scene, Action, Size, Angle, Movement, Lens, Depth of field, Lighting, Mood, Seconds, Sound, Cast, Location, Status, Selected take, Selected file`.
Preset columns hold labels. Cells that start with `= + - @` are prefixed with `'` so
spreadsheets do not run them. 400 for any other format.

### `POST /api/cinema/projects/:id/render`
Joins the **selected video take** of every shot, in storyboard order, into one MP4
(1280 px on the long side, project aspect, 24 fps, letterboxed as needed, **no sound**) and
saves it to the member's library.

→ `{ "asset": Asset, "shotsUsed": 2, "shotsSkipped": 6 }`. Shots without a finished video take are skipped.

Errors: `501 render_unavailable` when the server has no ffmpeg (message tells the member to
download takes one by one); `409 nothing_to_render` when no shot has a video take;
`500 render_failed`. This call can take tens of seconds; show a spinner.

## Tables (`migrations/060_cinema.sql`)

| Table | What |
|---|---|
| `cinema_projects` | One per project: title, logline, aspect, look (JSON of preset ids), still and video model ids. |
| `cinema_scenes` | Scenes with `position` inside a project. |
| `cinema_elements` | Characters, locations, props; `ref_asset_ids` JSON list of the member's asset ids. |
| `cinema_shots` | Shot fields, `position` inside a scene, `cast_ids` JSON, `location_id`, `selected_take_id`. |
| `cinema_takes` | One row per job started for a shot (`job_id`, `mode`, `source_take_id`). Status and files are read from the job. |
| `cinema_batches` | A "make every missing still" run: model, status, quoted total. |
| `cinema_batch_items` | One per shot in a batch: `waiting` until fed to `submitJobs`, then `submitted` with its `take_id`. |

Every table carries `user_id`; projects cascade to scenes, shots, elements, takes and batches.

## Open improvements

1. **A job-finished hook in `src/server/worker.ts`** (e.g. `onJobSettled(fn)` called after a job
   reaches `succeeded`/`failed`/`canceled`). The batch queue now polls once a second while a
   batch runs; a hook would feed the next still the moment a slot frees up, without a timer.
2. **`activeJobCount(userId)` exported from `src/server/jobs.ts`.** The batch reads the `jobs`
   table directly (read only) to count queued and running jobs, mirroring the private
   `activeCount`. Exporting it keeps the rule in one place.
3. **A `concatVideos(files, { width, height })` helper in `src/server/media.ts`** next to
   `writePoster`, so features do not each spawn ffmpeg themselves. The cinema render does
   that today in `src/server/cinema/render.ts`.
4. **Reading several jobs at once** (`getJobs(userId, ids)`). The storyboard reads one job
   per take; fine for normal projects, slow for one with hundreds of takes.
