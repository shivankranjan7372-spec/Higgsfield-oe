# Explore and Community API

Members share generated files in public; anyone can browse them. This page is enough to build
the Explore, post, profile, saved and contest screens without reading the server code.

- All paths are under the app origin. Bodies are JSON. Times are Unix milliseconds.
- **Reading works signed out.** Every write needs a session (a guest account counts as signed in).
- **Guests** (`user.isGuest`) may like, save, record views and hide members. They may **not**
  publish, comment, follow, report, enter contests or vote. Those answer `403 account_required`;
  show a "create a free account" prompt.
- Errors always look like this. Show `message` to the member as written.

```json
{ "error": { "code": "not_found", "message": "That post does not exist." } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `invalid_request` | Bad field, bad filter, bad cursor |
| 401 | `unauthorized` | Write while signed out; `following` tab signed out |
| 403 | `account_required` | A guest tried a members-only action |
| 403 | `forbidden` | Cross-site write; deleting a comment you may not delete |
| 403 | `recreate_off` | Recreate asked on a post whose author keeps settings private |
| 404 | `not_found` | Unknown id/handle/slug, or another member's private thing |
| 409 | `already_published`, `already_entered`, `contest_closed`, `model_unavailable` | See each route |
| 429 | `rate_limited` | An abuse limit (table at the end) |

## Paging

Lists answer `{ <items>, nextCursor }`. `nextCursor` is an opaque string, or `null` on the last
page. Pass it back as `?cursor=` for the next page. Do not build or parse it. `limit` is clamped to
the range given per route. A cursor that cannot be read answers 400 ("reload the list").

## Shapes

### Post

```json
{
  "id": "pst_orKrYNRp7mClPTFF",
  "kind": "image",
  "media": {
    "assetId": "ast_NIph30HmrH2inAtq",
    "url": "/api/assets/ast_NIph30HmrH2inAtq/file",
    "posterUrl": null,
    "mime": "image/png",
    "width": 1024, "height": 576, "duration": null
  },
  "title": "Harbour",
  "description": "First light.",
  "tags": ["night-city", "rain"],
  "author": { "id": "usr_…", "handle": "alice", "name": "Alice", "avatarUrl": null },
  "model": { "id": "flux-schnell", "name": "FLUX Schnell" },
  "allowRecreate": true,
  "prompt": "a quiet harbour at dawn",
  "counts": { "likes": 1, "saves": 0, "comments": 1, "views": 2 },
  "viewer": { "liked": true, "saved": false, "followingAuthor": false, "isAuthor": false },
  "publishedAt": 1794562726880,
  "updatedAt": 1794562726880
}
```

- `kind` is `image`, `video` or `audio`. For video, show `posterUrl` (may be null) until it plays.
  `width`/`height` give the aspect for masonry; `duration` is seconds for video and audio.
- `prompt` is `null` unless `allowRecreate` is true **or** the viewer is the author.
  Show a "Recreate" button only when `allowRecreate` (or `viewer.isAuthor`).
- `model` may be `null` (rare: a file with no model), and `model.name` falls back to the id if a
  model has been removed from Parallax.
- `viewer` is `null` when signed out.
- `author.avatarUrl` is a file link or `null`; draw initials when null. The link works for every
  viewer for as long as the file is that member's profile picture.

### Author (also used for member lists)

`{ "id", "handle", "name", "avatarUrl" }`. Link to the profile with `handle`.

### Comment

```json
{ "id": "cmt_…", "postId": "pst_…", "body": "Lovely light.", "author": { …Author }, "createdAt": 1794562730000, "canDelete": true }
```

`body` is plain text (newlines allowed, render as text, never as HTML). `canDelete` is true for the
comment's author and the post's owner.

### Profile

```json
{
  "id": "usr_…", "handle": "alice", "name": "Alice", "bio": "", "avatarUrl": null, "joinedAt": 1794562726880,
  "counts": { "posts": 3, "followers": 1, "following": 0, "likes": 1, "views": 2 },
  "viewer": { "isSelf": false, "following": true, "followsYou": false, "hidden": false }
}
```

`counts.likes` and `counts.views` are totals received across the member's public posts. `viewer`
is `null` signed out. No email, plan or other private field is ever included.

### Contest

```json
{
  "id": "cst_quietcities", "slug": "quiet-cities", "title": "Quiet Cities",
  "summary": "Empty streets, still water, the hour before everyone wakes.",
  "brief": "Show a city with nobody in it. …",
  "rules": ["One entry per member.", "…"],
  "kind": "image",
  "prize": "2,000 credits for first place, 1,000 for second, 500 for third",
  "phase": "open", "canEnter": true, "canVote": true,
  "opensAt": 1794303526000, "closesAt": 1795513126000, "endsAt": 1795772326000,
  "entries": 1,
  "viewer": { "entryPostId": "pst_…" }
}
```

- `kind`: the only file kind accepted, or `null` for any.
- `phase`: `upcoming` (before `opensAt`) → `open` (enter and vote, until `closesAt`) →
  `voting` (vote only, until `endsAt`) → `ended` (leaderboard final). Use the dates for countdowns.
- `viewer.entryPostId`: the viewer's own entry or `null`; `viewer` is `null` signed out.

### Entry (leaderboard row)

```json
{ "rank": 1, "votes": 2, "enteredAt": 1794562735680, "viewer": { "voted": true }, "post": { …Post } }
```

`rank` is the place on the vote leaderboard (most votes; the earlier entry wins a tie), on both sorts.

---

## Explore

### GET /api/explore

The public feed. Works signed out, except `tab=following`.

| Query | Values | Default |
|---|---|---|
| `tab` | `trending`, `new`, `top`, `following` | `trending` |
| `period` | `day`, `week`, `month`, `all` (only used by `top`) | `week` |
| `kind` | `image`, `video`, `audio` | any |
| `model` | a model id from `/api/explore/models` (any registry id is accepted) | any |
| `tag` | a tag, with or without `#`; normalised like tags on publish | any |
| `limit` | 1–60 | 24 |
| `cursor` | from `nextCursor` | |

Answer: `{ "posts": [Post], "nextCursor": "…" | null }`.

- `new`: newest published first. `following`: same order, only members the viewer follows
  (`401` signed out; empty list when following nobody).
- `top`: most likes among posts published inside `period` (`all` = ever); ties newest first.
- `trending`: ranked by a score with time decay (below). The first page fixes the clock, so later
  pages of the same list stay consistent.
- A signed-in viewer never sees posts from members they hid, nor posts they reported.

**Trending formula**

```
score = (1 + likes + 2·saves + 3·comments + views/20) / (ageHours + 2) ^ 1.5
```

`ageHours` is hours since publishing. Saves and comments count more than likes because they take
more intent; views count little because they are cheap. The `+2` stops a brand-new post from
dividing by almost nothing; the 1.5 power makes a day-old post need roughly 5× the engagement of a
3-hour-old one to rank level.

Errors: `400` for an unknown `tab`, `period`, `kind`, `model`, `tag` or a bad cursor. `401` for
`following` signed out.

```
GET /api/explore?tab=top&period=week&kind=image&limit=24
→ 200 { "posts": [ … ], "nextCursor": "eyJvIjoyNCwidCI6MTc5NDU2Mjc0MDAwMH0" }
```

### GET /api/explore/tags

`?limit=` 1–100 (default 20). Most used tags on public posts, for filter chips.
`→ 200 { "tags": [ { "tag": "rain", "posts": 12 } ] }`

### GET /api/explore/models

Models that have at least one public post, most posts first, for the model filter.
`→ 200 { "models": [ { "id": "flux-schnell", "name": "FLUX Schnell", "posts": 3 } ] }`

---

## Posts

### POST /api/community/posts — publish

Full members only. Publishes one of the member's own **generated** files (uploads are refused).

```json
{ "assetId": "ast_…", "title": "Harbour", "description": "First light.", "tags": ["Night City", "#rain"], "allowRecreate": true }
```

| Field | Rules |
|---|---|
| `assetId` | required; the member's own generated file (the `id` from `/api/assets` or a job's `assets`) |
| `title` | optional text ≤ 120; defaults to the file's library title |
| `description` | optional text ≤ 2000 |
| `tags` | optional list of ≤ 8 strings; each is lower-cased, `#` and punctuation removed, spaces become `-`, max 30 chars; duplicates and empties dropped |
| `allowRecreate` | optional boolean, default `false` |

Answer: `200 { "post": Post }`. The file becomes public (`assets.isPublic` true), so its
`/api/assets/<id>/file` link now works for everyone.

Errors: `401`; `403 account_required` (guest); `400` bad field or an uploaded file;
`404` file not found or not the member's; `409 already_published`; `429`.

### GET /api/community/posts/:id

Works signed out. `200 { "post": Post }`. `404` if unknown or unpublished, or if the author deleted
the file or made it private from the library.

### PATCH /api/community/posts/:id — edit

Author only. Any of `title`, `description`, `tags` (replaces the whole list), `allowRecreate`, same
rules as publish. `200 { "post": Post }`. `404` for someone else's post.

### DELETE /api/community/posts/:id — unpublish

Author only. Removes the post with its likes, saves, comments, views, reports and contest entries.
The file stays in the author's library and becomes private again. It can be published again later
(as a new post, counts start at zero). `200 { "ok": true }`. `404` for someone else's post.

### GET /api/community/posts/:id/recreate

Works signed out (but `POST /api/jobs` needs a session).

```json
{ "modelId": "flux-schnell", "prompt": "a quiet harbour at dawn", "values": { "aspect": "16:9" }, "droppedInputs": false }
```

Send `modelId`, `prompt` and `values` unchanged to `POST /api/jobs` (open the composer pre-filled
with them, and let the member press Generate; the price is shown there). If `droppedInputs` is true,
the original used reference files that belong to the author; they are not shared, so tell the
member to add their own.

Errors: `403 recreate_off` when the author did not allow recreate (the author themself is always
allowed); `404`; `409 model_unavailable` when the model is gone or offline.

### POST /api/community/posts/:id/like · DELETE (unlike)

Members and guests. Idempotent. `200 { "liked": true, "likes": 4 }`. `404`, `429`.

### POST /api/community/posts/:id/save · DELETE (unsave)

Members and guests. Idempotent. `200 { "saved": true, "saves": 2 }`. `404`, `429`.

### POST /api/community/posts/:id/view

Works signed out. Call once when the post page or modal opens. Counted once per viewer per post per
UTC day (signed-out visitors are told apart by a one-way hash of address and browser, never stored
raw). `200 { "views": 17 }`.

### GET /api/community/posts/:id/comments

Works signed out. `?limit=` 1–100 (default 30), `?cursor=`. Oldest first.
`200 { "comments": [Comment], "nextCursor": null }`.

### POST /api/community/posts/:id/comments

Full members only. `{ "body": "Lovely light." }` — text, 1–1000 characters after trimming; runs
of blank lines are squeezed. `200 { "comment": Comment }`.
Errors: `400` empty or too long; `401`; `403 account_required`; `404`; `429`.

### DELETE /api/community/comments/:id

The comment's author or the post's owner. `200 { "ok": true }`. `403 forbidden` for anyone else;
`404` unknown comment.

### POST /api/community/posts/:id/report

Full members only. `{ "reason": "spam", "note": "optional, ≤ 500 chars" }`.
`reason` is one of `spam`, `nudity`, `violence`, `hate`, `harassment`, `copyright`, `other`.
Stored for a moderator (status `open`). Reporting the same post again updates the reason.
The post also disappears from the reporter's own feeds. `200 { "reported": true }`.
Errors: `400` bad reason or own post; `401`; `403 account_required`; `404`; `429`.

### GET /api/community/saved

Signed in. The viewer's saved posts, most recently saved first. `?limit=` 1–60, `?cursor=`.
`200 { "posts": [Post], "nextCursor": null }`.

### GET /api/community/hidden

Signed in. Members whose posts the viewer hid, for a "Hidden members" settings list with an Unhide
button (`DELETE /api/profiles/:handle/hide`). `200 { "members": [Author] }`.

---

## Profiles

Handles are case-insensitive and may be passed with a leading `@`. Guest accounts have no public
profile (`404`).

### GET /api/profiles/:handle

Works signed out. `200 { "profile": Profile }`. `404` unknown member.

### GET /api/profiles/:handle/posts

The profile grid. `?sort=new|top` (default `new`; `top` = most liked), `?kind=`, `?limit=` 1–60,
`?cursor=`. `200 { "posts": [Post], "nextCursor": null }`. (Hidden/reported filters do not apply
on a profile you opened on purpose.)

### GET /api/profiles/:handle/followers · GET /api/profiles/:handle/following

`?limit=` 1–100 (default 30), `?cursor=`. Newest first. `200 { "members": [Author], "nextCursor": null }`.

### POST /api/profiles/:handle/follow · DELETE (unfollow)

Full members only. Idempotent. `200 { "following": true, "followers": 12 }`.
Errors: `400` yourself; `401`; `403 account_required`; `404`; `429`.

### POST /api/profiles/:handle/hide · DELETE (show again)

Members and guests. Hides that member's posts from the viewer's Explore tabs. Nobody else is told.
`200 { "hidden": true }`. Errors: `400` yourself; `404`; `429`.

---

## Contests

Three contests are seeded by the migration, dated relative to when the database was created:
`quiet-cities` (images, open now), `tiny-loops` (videos, opens in a week) and `first-light` (any
kind, ended). There is no admin screen for contests yet.

### GET /api/community/contests

Works signed out. `200 { "contests": [Contest] }`, ordered: open, voting, upcoming, ended.

### GET /api/community/contests/:slug

`200 { "contest": Contest }`. `404` unknown slug.

### GET /api/community/contests/:slug/entries

Works signed out. `?sort=top|new` (default `top` = leaderboard), `?limit=` 1–60, `?cursor=`.
`200 { "entries": [Entry], "nextCursor": null }`.

### POST /api/community/contests/:slug/entries — enter

Full members only. `{ "postId": "pst_…" }` — one of the member's own published posts, of the
contest's `kind`. One entry per member per contest. `200 { "contest": Contest }`.
Errors: `400` wrong kind; `403 account_required`; `404` post not found or not yours;
`409 contest_closed` (not open: upcoming, voting or ended); `409 already_entered`; `429`.

### DELETE /api/community/contests/:slug/entries/:postId — withdraw

The entrant only, while the phase is `open`. Votes on it are removed. `200 { "ok": true }`.
`404` not your entry; `409 contest_closed`.

### POST /api/community/contests/:slug/entries/:postId/vote · DELETE (take back)

Full members only, during `open` or `voting`. One vote per member per entry; voting again changes
nothing. Members may vote for several different entries. `200 { "voted": true, "votes": 8 }`.
Errors: `400` own entry; `401`; `403 account_required`; `404` unknown entry; `409 contest_closed`; `429`.

---

## Abuse limits

Per member (per visitor hash for views), in memory on one server.

| Action | Limit |
|---|---|
| Publish | 30 / hour |
| Like, unlike | 120 / minute |
| Save, unsave | 120 / minute |
| Comment | 10 / minute and 200 / day |
| Follow, unfollow | 60 / hour |
| Hide, unhide | 60 / hour |
| Report | 20 / day |
| Enter contest | 20 / hour |
| Vote, unvote | 120 / hour |
| View | 300 / minute |

Over the limit: `429 rate_limited` with a member-facing message. Undo actions (unlike, unfollow)
count against the same budget, so toggling fast cannot dodge it.

## Tables (`migrations/020_community.sql`)

| Table | What |
|---|---|
| `community_posts` | One row per published file: `asset_id` (unique), `user_id`, `kind`, `model_id`, `title`, `description`, `allow_recreate`, denormalised `like_count`/`save_count`/`comment_count`/`view_count`, `published_at`, `updated_at`. |
| `community_post_tags` | `(post_id, tag)` |
| `community_likes`, `community_saves` | `(post_id, user_id, created_at)` |
| `community_views` | `(post_id, viewer, day)` — dedupes views per day |
| `community_comments` | `id, post_id, user_id, body, created_at` |
| `community_follows` | `(follower_id, followee_id, created_at)` |
| `community_hides` | `(user_id, hidden_user_id, created_at)` |
| `community_reports` | `id, post_id, reporter_id, reason, note, status (open/dismissed/actioned), created_at`; unique per reporter and post |
| `community_contests` | `slug, title, summary, brief, rules (JSON list), kind, prize, opens_at, closes_at, ends_at`; three seeded rows |
| `community_contest_entries` | `(contest_id, post_id)`, `user_id` (unique per contest), `vote_count` |
| `community_contest_votes` | `(contest_id, post_id, user_id)` |

From the core schema, publishing sets `assets.is_public = 1` and `assets.published_at`; unpublishing
clears both. Nothing else in core tables is written. A post is only shown while its asset is still
public and not deleted, so the library's own delete and "make private" also hide the post.

## Open improvements

Status: 1 and 2 are done. Profile editing is `PATCH /api/account/profile` (see `account.md`), and
`/api/assets/<id>/file` now serves a member's current profile picture to everyone. 3 and 4 are open.

1. **Profile editing.** `users.name`, `bio` and `avatar_asset_id` exist but no route changes them,
   and this feature may not write core tables. Request: `PATCH /api/auth/me { name?, bio?, avatarAssetId? }`
   in the core auth routes (name ≤ 60, bio ≤ 300, avatar must be the member's own image).
2. **Avatars visible to others.** `avatarUrl` points at `/api/assets/<id>/file`, which only serves
   the owner or public files, so other people get a 404 for a private avatar. Request: let
   `visibleAsset()` also allow any asset that is some user's `avatar_asset_id`, or have the avatar
   route set `is_public` on the chosen file. Until then, screens should fall back to initials when
   the image fails to load.
3. **Moderator role.** Reports are stored but there is no moderator flag on `users`. Request: a
   `role` column (or an `admins` table) plus a moderation surface that can list
   `community_reports WHERE status = 'open'` and take a post down.
4. **Shared rate limiting.** `rateLimit()` is in memory per process; with several app servers each
   has its own budget. Fine for one node.
