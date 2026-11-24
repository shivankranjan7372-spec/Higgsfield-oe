# Notifications and search API

Two services that every screen uses:

- **Notifications**: an inbox per member, an unread badge, a live event stream, per-kind
  preferences and a "What's new" feed.
- **Search**: one box over models, the member's files, generations and folders, and public
  posts. It also covers recent searches, empty-state suggestions and a command palette list.

Everything here is JSON over HTTP, same origin, using the session cookie the auth routes set.
Guest accounts count as members. Times are Unix milliseconds.

## Conventions

**Errors** always look like this. `message` is written for the member and can be shown as is.

```json
{ "error": { "code": "not_found", "message": "That notification does not exist." } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `invalid_request` | A parameter or body field is missing, the wrong type, or too long |
| 401 | `unauthorized` | The route needs a signed-in member (guests count) |
| 403 | `forbidden` | A write (POST, PUT, PATCH, DELETE) came from another site |
| 404 | `not_found` | The id does not exist, **or belongs to someone else** (never 403) |
| 413 | `invalid_request` | Body too large |
| 500 | `server_error` | Our fault |

**Writes** send `Content-Type: application/json` with a JSON object body.

**Paging** uses cursors. Each list item has a `cursor`; the list response has `nextCursor`
(`null` on the last page). Pass it back as `before=<nextCursor>`.

## Route summary

| Method | Path | Signed out? | What |
|---|---|---|---|
| GET | `/api/notifications` | 401 | List notices, newest first |
| GET | `/api/notifications/unread` | 401 | Unread count for the badge |
| POST | `/api/notifications/read` | 401 | Mark some or all read |
| PATCH | `/api/notifications/:id` | 401 | Mark one read or unread |
| DELETE | `/api/notifications/:id` | 401 | Remove one notice |
| GET | `/api/notifications/preferences` | 401 | Per-kind on/off |
| PUT | `/api/notifications/preferences` | 401 | Change some kinds |
| GET | `/api/notifications/stream` | 401 | Server-sent events |
| GET | `/api/notifications/whats-new` | yes | Product news with "seen" flags |
| POST | `/api/notifications/whats-new/seen` | 401 | Mark news seen |
| GET | `/api/search` | yes | Grouped search results |
| GET | `/api/search/suggestions` | yes | Empty-state content for the search box |
| GET | `/api/search/recent` | 401 | Recent searches |
| POST | `/api/search/recent` | 401 | Save a search |
| DELETE | `/api/search/recent` | 401 | Clear all recent searches |
| DELETE | `/api/search/recent/:id` | 401 | Remove one recent search |
| GET | `/api/search/commands` | yes | Command palette entries |

---

# Notifications

## The Notice object

```json
{
  "id": "ntc_Qxlc5gJzetOGlR8e",
  "kind": "generation_done",
  "title": "Your image is ready",
  "body": "a lighthouse on a cliff at dusk",
  "link": "/library?job=job_V4SXxW6H1pUFopMf",
  "data": { "jobId": "job_V4SXxW6H1pUFopMf", "batchId": "bat_...", "kind": "image", "surface": "image", "modelId": "flux-schnell", "modelName": "FLUX Schnell" },
  "read": false,
  "readAt": null,
  "createdAt": 1794562737473,
  "cursor": 12
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | `ntc_...` |
| `kind` | string | One of the kinds below. Pick the icon from this. |
| `title` | string | Up to 140 characters. Plain text. |
| `body` | string | Up to 1000 characters. Plain text, may be empty. |
| `link` | string \| null | An in-app path starting with `/`. Navigate there on click. Never an outside URL. |
| `data` | object | Extra fields per kind (below). Use for thumbnails or grouping. |
| `read` | boolean | |
| `readAt` | number \| null | |
| `createdAt` | number | |
| `cursor` | number | For paging |

### Kinds

| `kind` | Group | Can mute | Made by | `data` |
|---|---|---|---|---|
| `generation_done` | activity | yes | this feature, from the jobs table | `jobId, batchId, kind, surface, modelId, modelName` |
| `generation_failed` | activity | yes | this feature, from the jobs table | same as above |
| `credits_low` | account | yes | this feature, from the balance | `balance` (millicredits), `threshold`, `level` (1 = under 20 credits, 2 = under 5) |
| `plan` | account | no | billing feature, via `notify()` | up to the caller |
| `like` | social | yes | social feature, via `notify()` | up to the caller |
| `comment` | social | yes | social feature, via `notify()` | up to the caller |
| `follow` | social | yes | social feature, via `notify()` | up to the caller |
| `announcement` | news | yes | via `notify()` | up to the caller |
| `system` | account | no | via `notify()` | up to the caller |

Links this feature produces: `/library?job=<jobId>` (done), `/image|/video|/audio?job=<jobId>`
(failed, back to the studio), `/wallet` (credits low).

**How job and credit notices appear.** The job worker has no event hooks yet, so these are
created the moment a member's notices are read (list, unread count, or an open stream, which
re-checks every 3 seconds). Each job gets at most one notice, ever, even if it is deleted.
"Credits low" fires once when the balance drops under 20 credits and once more under 5; it
re-arms after the balance goes back above 20.

## GET /api/notifications

Query parameters:

| Name | Default | Notes |
|---|---|---|
| `unread` | off | `1` or `true`: unread only |
| `kind` | all | Comma list of kinds, e.g. `like,comment,follow` for a "Social" tab |
| `limit` | 30 | 1 to 100 |
| `before` | | A `nextCursor` from the previous page |

Response `200`:

```json
{ "notices": [ /* Notice */ ], "unread": 2, "nextCursor": 11 }
```

`unread` is the total unread count (ignores the filters). Errors: 400 unknown kind, 401.

```bash
curl -b jar 'http://localhost:3000/api/notifications?unread=1&limit=20'
```

## GET /api/notifications/unread

Response `200`: `{ "unread": 3 }`. Cheap; fine to poll every 30 to 60 seconds if a screen
does not hold a stream open. Errors: 401.

## POST /api/notifications/read

Body, one of:

```json
{ "all": true }
{ "ids": ["ntc_a", "ntc_b"] }
```

`ids`: up to 200 strings. Ids that are not the member's, or already read, are skipped silently.

Response `200`: `{ "changed": 2, "unread": 0 }`. Errors: 400 bad body, 401, 403 cross-site.

## PATCH /api/notifications/:id

Body: `{ "read": true }` or `{ "read": false }` (mark unread).

Response `200`: `{ "notice": Notice, "unread": 1 }`. Errors: 400 `read` not boolean, 401,
404 not found or not yours.

## DELETE /api/notifications/:id

Response `200`: `{ "ok": true, "unread": 0 }`. Errors: 401, 404. Deleted notices never come back.

## GET /api/notifications/preferences

Response `200`:

```json
{ "preferences": [
  { "kind": "generation_done", "label": "A generation is ready", "group": "activity", "canMute": true, "enabled": true },
  { "kind": "system", "label": "Account and safety messages", "group": "account", "canMute": false, "enabled": true }
] }
```

Always lists every kind, in a stable order. Groups: `activity`, `account`, `social`, `news`.
Show kinds with `canMute: false` as locked on. A muted kind is simply not created; nothing is
queued for later.

## PUT /api/notifications/preferences

Body: only the kinds you change.

```json
{ "kinds": { "like": false, "follow": false } }
```

Response `200`: `{ "preferences": [ ... ] }` (the full list, as GET). Errors: 400 unknown kind,
a value that is not boolean, empty `kinds`, or trying to turn off a kind with `canMute: false`.

## GET /api/notifications/stream

Server-sent events for the signed-in member. Use `EventSource`; it sends the cookie and
reconnects by itself.

```js
const es = new EventSource("/api/notifications/stream");
es.addEventListener("ready",  (e) => setBadge(JSON.parse(e.data).unread));
es.addEventListener("notice", (e) => { const { notice, unread } = JSON.parse(e.data); toast(notice); setBadge(unread); });
es.addEventListener("unread", (e) => setBadge(JSON.parse(e.data).unread));
```

Query parameters (optional): `heartbeat` seconds between heartbeats (1 to 60, default 15),
`timeout` seconds before the server closes the stream (1 to 900, default 300).

| Event | `data` | When |
|---|---|---|
| `ready` | `{ "unread": 3 }` | Once, right after connecting |
| `notice` | `{ "notice": Notice, "unread": 4 }` | A new notice was created (any kind) |
| `unread` | `{ "unread": 0 }` | The count changed because of read, unread or delete (also from another tab) |
| `bye` | `{ "reconnect": true }` | The server is closing the stream after `timeout`. `EventSource` reconnects after 3 s. |
| `: ping <ms>` | (comment line) | Heartbeat. `EventSource` ignores it; it keeps proxies from cutting the connection. |

The stream starts with `retry: 3000`. It closes cleanly when the browser disconnects or at
`timeout`. Signed out: plain `401` JSON error (EventSource reports it as `error`; stop retrying
and fall back to no badge).

## GET /api/notifications/whats-new

Works signed out (everything is unseen then).

```json
{ "items": [
  { "id": "2026-11-search", "title": "Find anything from one box", "body": "Search now looks through...", "link": null, "tag": "new", "publishedAt": 1794528000000, "seen": false }
], "unseen": 3 }
```

`tag` is `new`, `improved` or `fixed`. Newest first. Show a dot on the "What's new" entry
while `unseen > 0`.

## POST /api/notifications/whats-new/seen

Body: `{ "all": true }` or `{ "ids": ["2026-11-search"] }` (up to 100; unknown ids are ignored).
Response `200`: same shape as GET. Errors: 400, 401.

---

# Search

## GET /api/search

Works signed out: then only `models` and `posts` are searched, other groups are left out.

| Name | Default | Notes |
|---|---|---|
| `q` | required | 1 to 100 characters after trimming. Matching is case-insensitive. `%` and `_` are literal characters. |
| `types` | all | Comma list of `models, files, generations, folders, posts`. Groups come back in that fixed order. |
| `limit` | 5 | Items per group, 1 to 20. Use 5 for the "All" tab, 20 for a single-type tab. |

Response `200`:

```json
{
  "query": "lighthouse",
  "groups": [
    { "type": "models", "label": "Models", "items": [], "more": false },
    { "type": "files", "label": "Your files", "more": true, "items": [
      { "type": "files", "id": "ast_...", "title": "Lighthouse study", "subtitle": "a lighthouse on a cliff at dusk",
        "href": "/library?asset=ast_...", "thumbUrl": "/api/assets/ast_.../file", "createdAt": 1794562700000,
        "match": "prefix", "extra": { "kind": "image", "source": "generated", "folderId": null, "modelId": "flux-schnell", "url": "/api/assets/ast_.../file", "isPublic": false } }
    ] }
  ],
  "total": 1,
  "engine": "fts5",
  "tookMs": 1.4
}
```

Every group is returned even when empty (for the requested and allowed types), so tabs can
show "No results". `more: true` means there were more matches than `limit`.

### Result item

| Field | Notes |
|---|---|
| `type` | Group type |
| `id` | Model id, asset id, job id or folder id |
| `title` | Main line. For files without a title it is the start of the prompt, or "Untitled". |
| `subtitle` | Second line (tagline, prompt, model and status, file count) |
| `href` | Where a click goes |
| `thumbUrl` | Image or video poster, or `null` (models, folders, audio) |
| `createdAt` | Newest-first tiebreaker. For posts, when it was published. `null` for models. |
| `match` | `prefix` (title starts with the query), `word` (a word in the title does), `contains` (title contains it), `detail` (only prompt, description or capability matched). Use it to bold or not. |
| `extra` | Per type, below |

| `type` | `href` | `extra` |
|---|---|---|
| `models` | `/image?model=<id>`, `/video?model=<id>`, `/audio?model=<id>` | `maker`, `kind` (image, video, audio, music), `status` (available, offline, soon), `badges[]`, `featured`, `capabilities[]` e.g. `["text to video", "image to video"]` |
| `files` | `/library?asset=<id>` | `kind`, `source` (generated, upload), `folderId`, `modelId`, `url`, `isPublic` |
| `generations` | `/library?job=<id>` | `kind`, `modelId`, `status` |
| `folders` | `/library?folder=<id>` | `fileCount` |
| `posts` | `/community/post/<postId>` (the item's `id` is still the file's id) | `kind`, `modelId`, `url`, `ownerHandle` |

**Ranking** inside each group: `prefix`, then `word`, then `contains`, then `detail`; ties go
to the newest. Models tie-break featured first, then catalogue order. Models match on name,
id, maker, tagline, badges and capability words, so "text to video" or a maker's name works.

Searching does **not** save a recent search. Call `POST /api/search/recent` when the member
presses Enter or opens a result.

Errors: 400 empty or too-long `q`, or unknown type.

```bash
curl 'http://localhost:3000/api/search?q=flux&types=models&limit=10'
```

## GET /api/search/suggestions

The empty state of the search box. Works signed out (then only `popularModels`).

```json
{
  "popularModels": [ /* model result items, as in search, match "prefix" */ ],
  "recentItems": [ { "type": "files", "id": "ast_...", "title": "...", "subtitle": "image", "href": "/library?asset=ast_...", "thumbUrl": "...", "createdAt": 0, "extra": { "kind": "image", "source": "generated", "url": "..." } } ],
  "recentSearches": [ { "id": "rsq_...", "query": "lighthouse", "createdAt": 0 } ]
}
```

`popularModels`: up to 6 available models, most used across Parallax in the last 30 days, then
featured ones. `recentItems`: the member's 6 newest files. `recentSearches`: up to 8.

## GET /api/search/recent

`?limit=` 1 to 20, default 10. Response: `{ "searches": [ { "id", "query", "createdAt" } ] }`,
newest first.

## POST /api/search/recent

Body: `{ "query": "neon city" }` (1 to 100 characters, spaces collapsed). Saving a query that is
already there moves it to the top. The 20 newest are kept.
Response: `{ "search": { "id", "query", "createdAt" } }`. Errors: 400, 401.

## DELETE /api/search/recent

Clears all. Response: `{ "ok": true, "removed": 4 }`.

## DELETE /api/search/recent/:id

Response: `{ "ok": true }`. Errors: 401, 404 (not found or not yours).

## GET /api/search/commands

Entries for a command palette (for example on Ctrl/Cmd-K). Already filtered for the visitor:
members see member entries, signed-out visitors see "Sign in" and "Try without an account".
Optional `?q=` filters and ranks them the same way as search (label, then hint and keywords).

```json
{ "commands": [
  { "id": "go-explore", "type": "go", "group": "Go to", "label": "Explore", "hint": "What people are making right now",
    "href": "/explore", "api": null, "keywords": [], "shortcut": "G 1", "audience": "all" },
  { "id": "mark-all-read", "type": "action", "group": "Actions", "label": "Mark all notifications read", "hint": "Clear the unread badge",
    "href": null, "api": { "method": "POST", "path": "/api/notifications/read", "body": { "all": true } },
    "keywords": ["clear", "dismiss"], "shortcut": null, "audience": "member" }
] }
```

- `type: "go"`: navigate to `href`.
- `type: "action"`: if `api` is set, `fetch(api.path, { method: api.method, body: JSON.stringify(api.body) })`
  (send no body when `body` is null), then navigate to `href` if set. If `api` is null, just navigate.
- `group`: `Go to`, `Library`, `Account`, `Actions`. Show them in that order.
- `shortcut`: a suggestion for display only; nothing binds it.

The "Go to" entries come from `primaryNav` in `src/config/brand.ts`, so they follow the nav.
Some `href`s point at pages that other features own: `/notifications`,
`/settings/notifications`, `/wallet`, `/whats-new`, `/login`, `/library?...`.

---

# For other features: `notify()`

```ts
import { notify } from "@/server/notify";

notify(ownerId, "comment", {
  title: `${commenter.name} commented on your post`,
  body: text.slice(0, 200),
  link: `/community/post/${postId}`,
  data: { postId, commentId, fromUserId: commenter.id },
  dedupeKey: `comment:${commentId}`,
});
```

- Returns the `Notice`, or `null` when the member muted that kind, the `dedupeKey` was used
  before (even if that notice was deleted), or the user does not exist. It never throws for
  those, so it is safe to call after your own write.
- Throws only on programmer error: unknown kind, empty title.
- `link` must be an in-app path starting with `/`; anything else is stored as `null`.
- `data` over 8 KB is dropped (stored as `{}`).
- Pushes a `notice` event to the member's open streams in the same process.
- Synchronous; runs inside your `tx()` if you are in one.

Also exported: `unreadCount`, `listNotices`, `markRead`, `syncNotices`, `NOTICE_KINDS`,
`search`, `commands`, `suggestions`.

---

# Tables (`migrations/090_notify.sql`)

| Table | What |
|---|---|
| `notify_notices` | One row per notice. `dedupe_key` is unique per member. Deleted notices keep a `deleted_at` tombstone so the key stays used. The 500 newest per member are kept. |
| `notify_prefs` | `(user_id, kind) -> enabled`. No row means on. |
| `notify_state` | Per member: how far the lazy job scan got (`jobs_after`), the last announced low-credit level and its re-arm counter. |
| `notify_seen` | `(user_id, announcement_id)` for "What's new". |
| `notify_recent_searches` | Up to 20 per member, unique per query. |
| `notify_search_state` | Bookkeeping for the search index. |

At run time, if this SQLite build has FTS5 with the trigram tokenizer, the search module also
creates `notify_assets_fts`, an external-content FTS5 index over `assets(title, prompt)`. It
is not in the migration because the migration has to run on builds without FTS5. The index
only narrows candidates; each hit is re-checked against the live `assets` row (owner,
`deleted_at`, `is_public`), so a stale index can delay a match but never leak one. New files
are added on the next search; edits and deletions are picked up by a full rebuild at most once
a minute. Queries under 3 characters, and every other group, use `LIKE` with `%`, `_` and `\`
escaped. The response field `engine` says which was used.

All member tables reference `users(id) ON DELETE CASCADE`. No core table is altered.

---

# Open improvements

1. **Job hooks.** Please call a hook when a job reaches `succeeded` or `failed` (in
   `src/server/worker.ts`, where the status is written), for example
   `onJobFinished(job: JobRow)`, so notices arrive at once instead of on the next read or
   stream tick (up to 3 s). The notify side would be:
   `notify(job.user_id, job.status === "succeeded" ? "generation_done" : "generation_failed", { ..., dedupeKey: \`job:${job.id}:${job.status === "succeeded" ? "done" : "failed"}\` })`.
   The dedupe keys match the lazy scan, so both can run side by side safely.
2. **Ledger hook.** A hook after any ledger write in `src/server/credits.ts`
   (`onBalanceChanged(userId)`) so "credits low" fires as soon as a charge lands.
3. **Plan changes.** When billing exists, call `notify(userId, "plan", ...)` on upgrade,
   downgrade, renewal and failed payment.
4. **Asset change hook (optional).** A hook on asset title edits, publish and delete would let
   the search index update at once instead of within a minute. Alternatively, allow this
   feature to add `AFTER INSERT/UPDATE/DELETE` triggers on `assets` that maintain
   `notify_assets_fts` (not done, because it attaches behaviour to a core table).
5. **Multi-process.** The live stream fans out in one Node process. If Parallax ever runs
   several app servers, it needs a shared channel; until then streams on other processes still
   catch up through the 3 s re-check, only for job and credit notices.
