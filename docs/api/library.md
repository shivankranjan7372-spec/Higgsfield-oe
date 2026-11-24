# Library and reference sets API

The member's own files, organised: a richer library listing, folders, bulk actions, a trash,
and **elements** (named sets of reference images that drop straight into a model's
reference slot).

Everything here needs a signed-in member (guest accounts count). Signed out, every route
answers `401 unauthorized`. A member only ever sees their own rows: asking for someone
else's folder, file or element answers `404 not_found`, exactly as if it did not exist.
Writes from another site answer `403 forbidden`.

## Conventions

- **Errors** always look like this. Show `message` to the member as written.
  ```json
  { "error": { "code": "not_found", "message": "That folder does not exist." } }
  ```
  Codes used here: `invalid_request` (400, or 413 for a body over 256 KB), `unauthorized` (401),
  `forbidden` (403), `not_found` (404), `name_taken` (409), `limit_reached` (409),
  `no_reference_slot` (409), `element_empty` (409), `server_error` (500).
- **Times** are Unix milliseconds. **Sizes** are bytes.
- **Asset** objects are the core asset shape (same as `GET /api/assets`):
  ```json
  {
    "id": "ast_...", "kind": "image", "source": "generated", "mime": "image/png",
    "bytes": 81234, "width": 1024, "height": 576, "duration": null,
    "url": "/api/assets/ast_.../file", "posterUrl": null,
    "title": "", "prompt": "a red fox in snow", "modelId": "flux-schnell", "params": {},
    "favorite": false, "folderId": null, "isPublic": false, "jobId": "job_...",
    "createdAt": 1794562400000, "cursor": 12
  }
  ```
  `kind` is `image | video | audio`, `source` is `generated | upload`. Use `posterUrl` as the
  thumbnail for videos. Ignore `cursor` here; library paging uses `nextCursor` (below).
- **Bulk and multi-file calls are all or nothing.** If any id is not the member's own file in
  the right state, nothing changes and the call answers 404 (or 400 for bad input).
- **Limits:** 200 files per call; 500 folders; folder names up to 80 characters, unique per
  member ignoring case; 500 elements; element names up to 60 characters, descriptions up to
  1,000, up to 10 tags of up to 30 characters, 1 to 12 images.

## Screens this supports

| Screen | Calls |
|---|---|
| Sidebar counts (All, Images, Video, Audio, Favourites, Uploads, Folders, Reference sets, Trash) and storage meter | `GET /api/library/summary` |
| Grid with kind tabs, filters, search, sort, infinite scroll | `GET /api/library` |
| Model filter list | `summary.models` (only models the member has used) |
| Folder list, "Add to folder" menu | `GET /api/folders`, `POST /api/folders` |
| Multi-select bar: favourite, move, delete, restore | `POST /api/library/bulk` |
| Trash page: list, restore, restore all, delete for good, empty | `/api/library/trash*`, bulk |
| Reference sets page and picker | `/api/elements*` |
| Composer: "use this element" | `POST /api/elements/:id/resolve`, then `POST /api/jobs` |

---

## Library listing

### `GET /api/library`

The member's files that are not in the trash.

| Query | Values | Default |
|---|---|---|
| `kind` | `image`, `video`, `audio`, `all` | all kinds |
| `source` | `generated`, `upload`, `all` | both |
| `favorite` | `1` or `true` = favourites only | off |
| `folder` | a folder id, or `none` for files in no folder | any folder |
| `model` | one model id, or several joined with commas (up to 50) | any model |
| `from` | created at or after this time (ms) | — |
| `to` | created before this time (ms) | — |
| `q` | text (up to 200 chars), matched anywhere in the title or prompt, ignoring case for A–Z. `%` and `_` are plain characters. | — |
| `sort` | `newest`, `oldest`, `largest`, `smallest`, `title` (A→Z) | `newest` |
| `limit` | 1–200 | 60 |
| `cursor` | `nextCursor` from the previous page | first page |

For date presets compute `from`/`to` on the client: "Today" = local midnight, "Last 7 days" =
now − 7 days, and so on. An unknown `kind`, `source` or `sort`, a bad time, or a stale cursor
is a 400.

Response:
```json
{
  "assets": [ /* Asset, ... */ ],
  "nextCursor": "WzEyLDEyXQ",
  "counts": { "all": 7, "image": 7, "video": 0, "audio": 0 }
}
```
- `nextCursor` is `null` on the last page. Keep every other query value the same when you
  pass it, or the page will not line up.
- `counts` is how many files match **every filter except `kind`**: use it for the kind tabs
  so they show what a click would give.

Example: `GET /api/library?kind=image&favorite=1&q=fox&sort=newest&limit=40`

### `GET /api/library/summary`

Sidebar numbers and the storage meter. Also deletes trash older than 30 days first.

```json
{
  "counts": {
    "all": 7, "image": 7, "video": 0, "audio": 0,
    "favorites": 2, "generated": 6, "uploads": 1, "unfiled": 3,
    "trash": 0, "folders": 1, "elements": 2
  },
  "storage": {
    "totalBytes": 568000,
    "byKind": { "image": 568000, "video": 0, "audio": 0 },
    "trashBytes": 0
  },
  "models": [ { "id": "flux-schnell", "name": "FLUX Schnell", "count": 6 } ],
  "trashRetentionDays": 30
}
```
`counts.all` and `storage` leave out the trash. `models` is ordered by count, most first.
There is no storage quota; show the total as information only.

---

## Folders

A file sits in at most one folder. Folder object:
```json
{ "id": "fld_...", "name": "Fox shots", "count": 4, "bytes": 320000, "createdAt": 1794562400000 }
```
`count` and `bytes` leave out files in the trash.

### `GET /api/folders`
```json
{ "folders": [ /* Folder, ordered by name A→Z */ ], "unfiled": 3 }
```
`unfiled` = files in no folder.

### `POST /api/folders`  `{ "name": "Fox shots" }`
Creates a folder. Spaces at the ends are trimmed, runs of spaces become one.
Response `{ "folder": Folder }`.
Errors: 400 empty or longer than 80 characters; 409 `name_taken` (same name, ignoring case);
409 `limit_reached` (500 folders).

### `GET /api/folders/:id`
`{ "folder": Folder }`, or 404.

### `PATCH /api/folders/:id`  `{ "name": "New name" }`
Renames. Same rules and errors as create. Response `{ "folder": Folder }`.

### `DELETE /api/folders/:id`
Deletes the folder. Its files are kept and go back to "no folder" (this includes files in the
trash, so restoring them later puts them in no folder).
Response `{ "ok": true, "moved": 4 }`.

### `POST /api/folders/:id/assets`  `{ "ids": ["ast_...", ...] }`
Moves up to 200 files into the folder (from wherever they were). Use the literal id `none`
(`POST /api/folders/none/assets`) to take files out of any folder. All or nothing.
Response `{ "ok": true, "moved": 2 }`. Errors: 400 no ids or more than 200; 404 unknown folder,
or a file that is not the member's own or is in the trash.

The same move is available as a bulk action (`action: "move"`).

---

## Bulk actions

### `POST /api/library/bulk`

```json
{ "action": "favorite", "ids": ["ast_a", "ast_b"], "favorite": true }
```

| `action` | Extra fields | Works on | Effect |
|---|---|---|---|
| `favorite` | `favorite`: `true` or `false` (required) | files not in the trash | sets or clears the favourite mark |
| `move` | `folderId`: folder id, or `null` for no folder (required) | files not in the trash | moves into the folder |
| `trash` | — | files not in the trash | moves to the trash (also unpublishes them) |
| `restore` | — | files in the trash | brings them back, into their old folder if it still exists |
| `delete` | — | files in or out of the trash | deletes for good: the file is removed from disk and cannot come back |

`ids`: 1–200 file ids; repeats are ignored. Response:
```json
{ "ok": true, "action": "favorite", "count": 2 }
```
Errors: 400 unknown action, missing `favorite`/`folderId`, no ids, more than 200 ids;
404 if any id is not the member's own file in the state the action needs. On any error
nothing changes.

Single-file actions use this same call with one id. Ask before `delete`; it cannot be undone.

---

## Trash

Deleting from the library moves a file to the trash. The file vanishes from the library,
from folders, from elements, from job results and from the generator, but stays on disk.
Thirty days after it was trashed it is deleted for good. This happens lazily the next time
the member's trash or summary is read, so a trashed file may live a little past 30 days
if no one looks; `expiresAt` is the promised time.

Trashed file object = Asset plus:
```json
{
  "trashedAt": 1794562500000,
  "expiresAt": 1797154500000,
  "trashUrl": "/api/library/trash/ast_.../file",
  "trashPosterUrl": null
}
```
**Use `trashUrl` / `trashPosterUrl` for thumbnails in the trash.** The normal `url` answers 404
while the file is in the trash.

### `GET /api/library/trash?limit=60&cursor=`
Most recently trashed first. `limit` 1–200, default 60.
```json
{ "assets": [ /* TrashedAsset */ ], "nextCursor": null, "count": 2, "bytes": 160000, "retentionDays": 30 }
```
`count` and `bytes` are for the whole trash, not just this page.

### `GET /api/library/trash/:id/file[?poster=1]`
The file (or video poster) of a trashed file. Owner only; supports `Range`. 404 if the file is
not in this member's trash.

### `POST /api/library/trash/restore`
`{ "ids": ["ast_...", ...] }` restores those files (all or nothing; 404 if one is not in the
trash), or `{ "all": true }` restores everything. Response `{ "ok": true, "restored": 2 }`.

### `DELETE /api/library/trash`
Empties the trash: every file in it is deleted for good. Response `{ "ok": true, "deleted": 5 }`.
To delete only some files for good, use bulk `delete`.

---

## Reference sets (`/api/elements`)

A named, reusable set of the member's own images: a **character**, an **object**, a **style**
or a **place**. Use it to keep a person, product or look the same across generations.

Element object:
```json
{
  "id": "elm_...",
  "type": "character",
  "name": "Rusty",
  "description": "A red fox with a white tail tip.",
  "tags": ["fox", "red"],
  "cover": { /* Asset: the first image */ },
  "assets": [ /* Asset, in order */ ],
  "assetIds": ["ast_...", "ast_..."],
  "useCount": 3,
  "lastUsedAt": 1794562600000,
  "createdAt": 1794562400000,
  "updatedAt": 1794562500000
}
```
- Images only (no video or audio), 1–12 of them, all the member's own. The first is the cover.
- Images in the trash are left out of `assets`/`assetIds` (and `cover` may be `null` if all of
  them are). Restoring a file puts it back in its old place. A file deleted for good leaves the
  element for good.
- Tags are stored lower-case, trimmed, without repeats.
- `useCount` / `lastUsedAt` count calls to `resolve` (not dry runs). `lastUsedAt` is `null` until
  first use. Use them for "Used 3 times · last used 2 hours ago".

### `GET /api/elements`

| Query | Values | Default |
|---|---|---|
| `type` | `character`, `object`, `style`, `place`, `all` | all |
| `q` | text (≤200), matched in name, description and tags | — |
| `tag` | one exact tag | — |
| `sort` | `recent` (last edited), `created` (newest), `name` (A→Z), `used` (last used first, never-used last), `popular` (most used) | `recent` |
| `limit` | 1–200 | 60 |
| `offset` | 0+ | 0 |

```json
{
  "elements": [ /* Element */ ],
  "total": 2,
  "counts": { "all": 2, "character": 1, "object": 0, "style": 0, "place": 1 }
}
```
`counts` follow `q` and `tag` but not `type` (for the type tabs); `total` is the count for the
current `type`, for paging with `offset`.

### `POST /api/elements`
```json
{ "type": "character", "name": "Rusty", "description": "optional", "tags": ["fox"], "assetIds": ["ast_a", "ast_b"] }
```
`type`, `name` and `assetIds` are required. Response `{ "element": Element }`.
Errors: 400 bad type, empty or long name, long description, bad tags, no images, more than 12
images, a file that is not an image; 404 a file that is not the member's own or is in the trash;
409 `limit_reached`.

Example "Create element from this file": `POST /api/elements` with `assetIds: [thatFileId]`.

### `GET /api/elements/:id`
`{ "element": Element }`, or 404.

### `PATCH /api/elements/:id`
Any of `type`, `name`, `description`, `tags`, `assetIds`. `tags` and `assetIds` replace the whole
list; `assetIds` also sets the order (first = cover). To "add this file to an element", send the
current `assetIds` plus the new id. Same rules and errors as create.
Response `{ "element": Element }`.

### `DELETE /api/elements/:id`
Deletes the element. Its images stay in the library. Response `{ "ok": true }`.

### `POST /api/elements/:id/resolve`
Turns the element into file ids for one model's reference slot, cut to that slot's maximum.

```json
{ "modelId": "nano-banana-2-lite", "slot": "refs", "dryRun": false }
```
- `modelId` (required): a model id from the registry (`@/registry`, the same list the composer uses).
- `slot` (optional): a slot id of that model that takes images. Without it, the model's `refs`
  slot is used, or else its first slot that takes images.
- `dryRun` (optional): `true` to preview without counting a use.

Response:
```json
{
  "modelId": "nano-banana-2-lite",
  "slot": { "id": "refs", "label": "References", "min": 0, "max": 3 },
  "assetIds": ["ast_c", "ast_b", "ast_a"],
  "inputs": { "refs": ["ast_c", "ast_b", "ast_a"] },
  "dropped": ["ast_d"],
  "element": { /* Element, with the new useCount and lastUsedAt */ }
}
```
Pass `inputs` (merged with any other slots) as `inputs` to `POST /api/jobs`. If `dropped` is not
empty, tell the member that the model takes only `slot.max` images and the rest were left out.
Errors: 400 unknown model, unknown slot, slot that does not take images; 404 unknown element;
409 `no_reference_slot` (the model takes no images); 409 `element_empty` (all images are in the
trash).

---

## Tables added (`migrations/010_library.sql`)

| Table | Columns | Purpose |
|---|---|---|
| `library_trash` | `asset_id` PK, `user_id`, `trashed_at` | Files in the trash. Their `assets` row has `deleted_at` set but the files stay on disk. |
| `elements` | `id`, `user_id`, `type`, `name`, `description`, `tags` (JSON), `use_count`, `last_used_at`, `created_at`, `updated_at` | Elements. |
| `element_assets` | `element_id`, `asset_id`, `position` (PK element+asset) | Ordered images of an element. |

Core rows read and written: `folders` (create, rename, delete) and `assets.folder_id`,
`assets.favorite`, `assets.deleted_at`, `assets.is_public`, `assets.remote_url`. No core table
is altered.

How states map onto core rows:

| State | `assets.deleted_at` | `library_trash` row | Files on disk |
|---|---|---|---|
| In the library | null | no | yes |
| In the trash | set | yes | yes |
| Deleted for good | set | no | no |

## Open improvements

1. **Core delete should go to the trash.** `removeAsset` in `src/server/assets.ts` (used by
   `DELETE /api/assets/:id`) removes the files at once, so a delete from any core screen skips
   the trash. Please change `DELETE /api/assets/:id` to call `trashAssets(userId, [id])` from
   `@/server/library/trash` (or move that logic into `assets.ts`). Until then, screens should
   delete through `POST /api/library/bulk` with `action: "trash"`.
2. **Indexes for the listing.** Filters by `kind`, `folder_id`, `favorite` and `model_id` scan the
   member's rows via `assets_user`. Fine at today's sizes; for large libraries please add
   `CREATE INDEX assets_user_kind ON assets(user_id, kind, seq)` and
   `CREATE INDEX assets_user_folder ON assets(user_id, folder_id, seq)` in a core migration. (Not
   done here because feature migrations should not change core tables.)
3. **Purge hook for other features.** When a file is deleted for good, this feature removes it
   from `element_assets`. Other features that point at assets (projects, boards) may want the
   same signal. A small `onAssetPurged(cb)` hook in `assets.ts` would let each feature clean up.
4. **A file route that can serve trashed files.** `assetById` hides any row with `deleted_at`,
   so the trash has its own preview route (`/api/library/trash/:id/file`). If the core gained a
   trash state, `url` could keep working and the separate route could go.
