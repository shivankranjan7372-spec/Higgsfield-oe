# Account, plans and billing API

Everything about a member's own account: profile, sign-in details, sessions, plans, receipts,
usage numbers, promo codes, invites and preferences. This page is written for the people
building the screens. You should not need the code.

## Ground rules

- All routes are JSON. All routes except `GET /api/billing/plans` need a signed-in member
  (guest accounts count). Signed out you get `401 unauthorized`.
- Writes from another site are refused with `403 forbidden`.
- Errors always look like this. Show `message` to the member as written; switch on `code`.

  ```json
  { "error": { "code": "handle_taken", "message": "That handle is taken. Try another." } }
  ```

- Times are Unix milliseconds. **Credits are millicredits** (1 credit = 1000): show
  `formatCredits(n)` from `@/config/economy`. **Money is US cents** (`1900` = $19.00).
- Every read of the account, plans, subscription or receipts first brings the plan up to date:
  it renews a finished period, ends a cancelled plan, and grants the month's credits (once).
  So after any of these reads the `balance` you get is current.
- Common error codes: `invalid_request` (400, bad input), `unauthorized` (401),
  `forbidden` (403), `wrong_password` (403), `not_found` (404), `rate_limited` (429),
  `billing_closed` (503). Codes specific to a route are listed with it.

## Shared shapes

**User** (same as `/api/auth/me`):

```json
{ "id": "usr_…", "email": "ada@example.com", "handle": "ada", "name": "Ada Maker", "isGuest": false,
  "plan": "plus", "avatarUrl": "/api/assets/ast_…/file", "bio": "I make short films.", "createdAt": 1794562307000 }
```

`email` is `null` for guests. `avatarUrl` is `null` when there is no picture.

**PlanCard**:

```json
{ "id": "plus", "name": "Plus", "tagline": "For steady weekly making.", "rank": 1,
  "priceMonthCents": 1900, "priceYearCents": 19000, "priceYearPerMonthCents": 1583, "yearlySavingPercent": 17,
  "monthlyCredits": 400, "concurrency": 6,
  "features": ["Fresh credits every month", "More jobs running at once", "Commercial use", "Top up any time"],
  "highlight": null }
```

- `rank`: 0 is Free, higher is a bigger plan. Use it to label buttons (see "Which button").
- `priceYearCents` is charged once a year. `priceYearPerMonthCents` is for "$15.83 / month, billed yearly".
- `monthlyCredits` is in **whole credits** (not millicredits) and is the same on both intervals:
  a yearly plan still gets its credits month by month.
- `concurrency`: jobs that may be queued or running at once.
- `highlight`: a short badge ("Most chosen") or `null`.

**Subscription**:

```json
{
  "planId": "pro",
  "plan": { "...": "PlanCard" },
  "interval": "year",
  "status": "active",
  "currentPeriodStart": 1794562600000,
  "currentPeriodEnd": 1826098600000,
  "renewsAt": 1826098600000,
  "nextChargeCents": 19000,
  "pendingChange": { "planId": "plus", "planName": "Plus", "interval": "year", "startsAt": 1826098600000 },
  "monthlyCredits": { "amount": 1200000, "windowStart": 1794562600000, "windowEnd": 1797154600000, "nextGrantAt": 1797154600000 },
  "demoBilling": true
}
```

- `status`: `free` (no paid plan; `interval`, periods, `renewsAt`, `nextChargeCents`,
  `pendingChange`, `monthlyCredits` are all `null`), `active` (renews), or `canceling`
  (keeps the plan until `currentPeriodEnd`, then Free; `renewsAt` and `nextChargeCents` are `null`).
- `pendingChange`: a smaller plan or a switch to monthly that starts at `startsAt`. `null` if none.
  "Your plan changes to Plus on 13 Nov 2027."
- `nextChargeCents`: what the next renewal will cost, taking `pendingChange` into account.
- `monthlyCredits.amount` is millicredits granted for the current month window.
  `nextGrantAt` is when the next month's credits arrive (`null` if the plan ends first).
- `demoBilling`: `true` means no money is ever taken. Show a clear "Demo: no payment is taken"
  note next to every price and button.

## Profile

### `GET /api/account`

Everything a settings screen needs, in one read.

```json
{ "user": { "...": "User" }, "balance": 549900, "subscription": { "...": "Subscription" },
  "preferences": { "...": "Preferences" }, "hasPassword": true }
```

`hasPassword` is `false` for guests: hide the password and email forms and show "Create an
account" instead.

### `GET /api/account/profile`

`{ "user": User }`

### `PATCH /api/account/profile`

Send only the fields that change.

| Field | Type | Rules |
|---|---|---|
| `name` | string | 1 to 60 characters after trimming; runs of spaces become one |
| `handle` | string | 3 to 30 characters: `a-z 0-9 - _`, starts and ends with a letter or number, no `--`/`__`. A leading `@` is dropped, upper case is lowered. Some words are reserved. |
| `bio` | string | up to 300 characters, may contain line breaks |
| `avatarAssetId` | string or `null` | one of the member's own **image** assets (from the library); `null` removes the picture |

```http
PATCH /api/account/profile
{ "name": "Ada Maker", "handle": "ada", "bio": "I make short films." }
→ 200 { "user": { …User } }
```

Errors: `400 invalid_request` (bad field), `409 handle_taken` (taken or reserved),
`404 not_found` (avatar asset is not the member's or does not exist).

### `GET /api/account/handle?handle=ada`

Live check while typing. Never errors on a bad handle; it tells you why.

```json
{ "handle": "ada", "available": false, "message": "That handle is taken. Try another." }
```

The member's own current handle counts as available.

## Sign-in details

### `POST /api/account/email`

`{ "email": "new@example.com", "password": "current password" }` → `200 { "user": User }`

Errors: `400` invalid email or missing password, `403 wrong_password`, `409 email_taken`,
`409 already_current`, `409 guest_account` (guests must create an account first),
`429 rate_limited` (10 an hour). There is no email verification step (there is no mail sender).

### `POST /api/account/password`

`{ "currentPassword": "…", "newPassword": "…" }` → `200 { "changed": true, "signedOut": 1 }`

The new password needs 8 to 200 characters and must differ from the current one. Changing the
password signs out every **other** session; `signedOut` says how many. This device stays signed in.

Errors: `400` (too short / same as before / missing), `403 wrong_password`,
`409 guest_account`, `429 rate_limited`.

## Sessions

### `GET /api/account/sessions`

```json
{ "sessions": [
  { "id": "ses_5913bcbdb1fd754c91a8", "current": false, "createdAt": 1794562709126, "expiresAt": 1797154709126,
    "device": "Safari on iOS", "lastSeenAt": 1794570001200 },
  { "id": "ses_49166b70cfd3189fe4ba", "current": true,  "createdAt": 1794562704600, "expiresAt": 1797154704600,
    "device": "Chrome on macOS", "lastSeenAt": 1794571234000 }
] }
```

Newest first. `current` marks this device. `device` is a short name read from the browser
("Chrome on macOS"); it is `""` when the browser did not say, so show "Unknown device" then.
`lastSeenAt` is when that session last made a request, to the minute. No address or place is
kept.

### `DELETE /api/account/sessions/:id`

Signs out one other session. → `200 { "revoked": true }`.
Errors: `404 not_found` (not one of this member's sessions), `400` (this is the current session:
use `POST /api/auth/logout` instead).

### `DELETE /api/account/sessions`

Signs out every session except this one. → `200 { "signedOut": 2 }`.

## Delete the account

### `DELETE /api/account`

```json
{ "confirm": "DELETE", "password": "current password" }
```

Guests send only `confirm`. Have the member type `DELETE` into a box and send what they typed.
→ `200 { "deleted": true }` and the session cookie is cleared. Then send them to the home page.

Removes the member and all their data: sessions, credits and history, jobs, folders, library
files (rows and files on disk), subscription, receipts, codes, invites and preferences.
Credits are not refunded. This cannot be undone; say so on the screen.

Errors: `400` (no `DELETE`), `400`/`403 wrong_password`, `500 delete_failed` (nothing was removed),
`429 rate_limited`.

## Plans and subscription

There is **no real payment**. Billing goes through a `BillingProvider`; the only one is `demo`,
which approves at once and writes a receipt. It is on by default in mock mode only. A live
server (one with a gateway key) turns it on only with `PARALLAX_DEMO_BILLING=on`, and
`PARALLAX_DEMO_BILLING=off` closes it everywhere. When it is off, every plan change answers
`503 billing_closed` "Plan changes are not open yet…"; reading plans, cancel and resume still work.
There is no card form and none should be built.

### Which button to show

For a card `target` and the member's `subscription` (`current = subscription.plan`):

| Situation | Label | What happens |
|---|---|---|
| `target.id == current.id` and interval is the same, no pending change, not canceling | "Current plan" (disabled) | — |
| `target.rank > current.rank`, or same plan monthly → yearly | "Upgrade" / "Switch to yearly" | starts **now**: new period, charge, the month's credits |
| `target.rank < current.rank` (paid), or same plan yearly → monthly | "Downgrade" / "Switch to monthly" | starts at `currentPeriodEnd` |
| target is `free` while on a paid plan | "Cancel plan" | same as cancel |
| on Free, target is paid | "Choose plan" | starts now |

There is no proration: an upgrade charges the full price of the new plan and starts a fresh period.

### `GET /api/billing/plans`

Works signed out. `current` is `null` when signed out.

```json
{ "plans": [ PlanCard, … ], "current": Subscription | null, "demoBilling": true, "currency": "usd" }
```

Plans come cheapest first: `free`, `plus`, `pro`, `studio`.

### `GET /api/billing/subscription`

`{ "subscription": Subscription, "balance": 549900 }`

### `POST /api/billing/subscription`

Change plan, interval, or both.

```json
{ "planId": "pro", "interval": "year" }
```

- `planId`: `free | plus | pro | studio`. Leave it out to keep the current plan (to switch interval only).
- `interval`: `month | year`. Leave it out to keep the current one (`month` when on Free).
- Choosing the plan and interval you already have, while a change or a cancel is pending,
  drops that pending change / cancel (answers `effective: "now"`, no charge).

```json
{ "effective": "now", "receiptId": "rcp_…", "subscription": Subscription, "balance": 1749900 }
```

`effective`: `now` (active already; `receiptId` set when something was charged) or
`period_end` (scheduled: see `subscription.pendingChange`, or `status: "canceling"` when
`planId` was `free`).

Errors: `400` (unknown plan, bad interval), `409 already_current`, `503 billing_closed`,
`402 payment_failed` (not possible with the demo provider), `429 rate_limited` (30 an hour).

### `POST /api/billing/subscription/cancel`

No body. The plan stays until `currentPeriodEnd`, then the member is on Free. Cancelling
also drops any pending change. → `{ "subscription": Subscription }` with `status: "canceling"`.

Errors: `409 no_subscription` (on Free), `409 already_canceling`.

### `POST /api/billing/subscription/resume`

No body. Undoes a cancel before the period ends. → `{ "subscription": Subscription }`.

Errors: `409 no_subscription` (the plan already ended: pick a plan again), `409 not_canceling`.

### `POST /api/billing/demo/end-period`  (demo only)

Ends the current period now, as if the month or year had passed: the plan renews (with a
demo receipt and the new month's credits), a pending change starts, or a cancelled plan ends.
For demos and tests. Answers `503 billing_closed` when demo billing is off, `409 no_subscription`
on Free. → `{ "subscription": Subscription, "balance": 2149900 }`.
Show it only in a clearly marked demo/developer area, if at all.

### Monthly credits

A paid plan grants `plan.monthlyCredits` once per month window, starting at the period start,
on both monthly and yearly billing. The grant happens on the first account or billing read in
each window and never twice (a database key guards it). It shows in the wallet history as
`grant` with a note like "Pro plan: monthly credits". Credits do not expire and unused credits
stay in the balance. A month in which the member never opens the app is not paid out later.

## Receipts

### `GET /api/billing/receipts?limit=25&before=`

Newest first. `limit` 1 to 100 (default 25). For the next page pass `before` = the last
receipt's `createdAt`.

```json
{ "receipts": [ {
  "id": "rcp_…", "number": "PX-THD0XJGX", "provider": "demo", "demo": true,
  "planId": "plus", "planName": "Plus", "interval": "month",
  "amountCents": 1900, "currency": "usd",
  "description": "Plus plan, monthly (demo, no money taken)", "status": "paid",
  "periodStart": 1794562600000, "periodEnd": 1797154600000, "createdAt": 1794562600000
} ] }
```

Renewals have descriptions starting with "Renewal:". There are no downloadable invoices.

## Usage

### `GET /api/billing/usage?days=30&tz=60`

- `days`: 1 to 366 (default 30), counting today.
- `tz`: the member's offset from UTC in minutes, east positive (`-new Date().getTimezoneOffset()`),
  so days break at their midnight. Default 0.

```json
{ "usage": {
  "from": 1794009600000, "to": 1794562708985, "days": 7, "tzOffsetMinutes": 0,
  "totals": { "spent": 100, "granted": 2150000, "toppedUp": 0, "generations": 1, "failed": 0 },
  "perDay":   [ { "date": "2026-11-07", "spent": 0, "generations": 0 }, … ],
  "perKind":  [ { "kind": "image", "spent": 100, "generations": 1 } ],
  "perModel": [ { "modelId": "flux-schnell", "name": "FLUX Schnell", "kind": "image", "spent": 100, "generations": 1 } ]
} }
```

- All amounts are millicredits. `spent` counts finished, charged jobs only (running jobs and
  failed or cancelled ones are not spend).
- `perDay` has exactly `days` entries, oldest first, with zero days filled in. `date` is
  `YYYY-MM-DD` in the member's time zone. Good for a bar chart.
- `perKind` (`image | video | audio | music`) and `perModel` are sorted by `spent`, largest
  first. Good for a stacked bar or a list with percentages.
- `totals.generations` counts succeeded jobs, `totals.failed` failed jobs, in the range.
  `granted` covers sign-up, plan, promo and invite credits; `toppedUp` covers wallet top-ups.

## Promo codes

### `POST /api/billing/promo`

`{ "code": "hello-parallax" }` (case and surrounding spaces do not matter)
→ `200 { "code": "HELLO-PARALLAX", "credits": 25000, "balance": 2174900 }`

Each code works once per member. Errors: `400` (empty), `404 invalid_code`,
`409 already_redeemed`, `410 code_expired`, `410 code_used_up`, `429 rate_limited` (20 an hour).

Codes that exist out of the box: `HELLO-PARALLAX` (25 credits, no limit) and `STUDIO-100`
(100 credits, first 1000 members). New codes are rows in `account_promo_codes`; there is no
admin API for them yet.

## Invites

### `GET /api/account/referral`

```json
{ "code": "55TWHHDK", "path": "/join?ref=55TWHHDK", "creditsEach": 50000,
  "invited": 1, "creditsEarned": 50000, "limit": 50, "claimedInvite": null }
```

- `code` is made on first request and never changes. `path` is a suggestion for the share link:
  build the full link with the site origin. The screen that reads `?ref=` must call claim after
  the invited person has created an account.
- `creditsEach`: what both sides get (millicredits). `invited`: members who claimed this code.
  The inviter is paid for at most `limit` invites.
- `claimedInvite`: `{ "claimedAt": … }` if this member already used someone's invite, else `null`.
  Hide the "Have an invite code?" box when set.

### `POST /api/account/referral/claim`

`{ "code": "55TWHHDK" }` → `200 { "credits": 50000, "balance": 225000 }`. Both members get
`creditsEach`, once. A member can use one invite ever.

Errors: `409 guest_account` (create an account first), `400` (own code), `404 invalid_code`,
`409 already_redeemed`, `429 rate_limited`.

## Preferences

### `GET /api/account/preferences`

```json
{ "preferences": {
    "defaultPrivacy": "private", "language": "en", "theme": "system",
    "notices": { "jobFinished": true, "jobFailed": true, "lowCredits": true, "billing": true, "productNews": false, "tips": true }
  },
  "defaults": { "…": "same shape" },
  "options": { "languages": ["en","es","fr","de","it","pt","nl","pl","tr","ja","ko","zh"],
               "notices": ["jobFinished","jobFailed","lowCredits","billing","productNews","tips"] } }
```

| Key | Values |
|---|---|
| `defaultPrivacy` | `private` or `public`: the default for new generations (other features read it) |
| `language` | one of `options.languages` |
| `theme` | `system`, `dark`, `light` |
| `notices` | on/off per notice in `options.notices` |

### `PATCH /api/account/preferences`

Send any subset. `notices` merges, so `{ "notices": { "tips": false } }` flips one switch.
→ `{ "preferences": Preferences }`. Unknown keys or values are `400`.

Other features may read these server-side with `getPreferences(userId)` from
`@/server/account/prefs`.

## Tables (migration `030_account.sql`)

| Table | What it holds |
|---|---|
| `account_subscriptions` | one row per member who ever had a paid plan: plan, interval, `status` (`active`/`ended`), period, cancel flag, pending change |
| `account_receipts` | one row per demo charge (provider, amount in cents, period) |
| `account_credit_grants` | one row per granted monthly credit window; its primary key `(user_id, window_start)` makes the grant happen once |
| `account_promo_codes` | promo codes, credits, use limits, expiry; seeded with two demo codes |
| `account_promo_redemptions` | who used which code; primary key makes it once per member |
| `account_referral_codes` | each member's invite code |
| `account_referrals` | one row per invited member (`invitee_id` primary key = once) |
| `account_prefs` | per-member key/value settings, value as JSON |

All rows are removed with the member (`ON DELETE CASCADE`), except `account_referrals.inviter_id`,
which has no foreign key so an invitee cannot be invited twice after their inviter leaves.

The module also updates these core `users` columns: `name`, `handle`, `bio`,
`avatar_asset_id`, `email`, `password_hash`, `plan`.

## Open improvements

All five are settled.

1. **Session details: done.** `sessions` has `user_agent` and `last_seen_at` (migration `110_sessions`).
   `startSession()` fills them and `userFromToken()` touches "last active" at most once a minute.
   The sessions list answers `device` and `lastSeenAt`. No address or place is kept, on purpose.
2. **Sync plans on `/api/auth/me`: done.** `GET /api/auth/me` and `GET /api/wallet` call
   `syncSubscription()`, so a renewal and its monthly credits show up without a visit to settings.
3. **Export `hashToken`: done.** It lives in `@/server/auth`; `profile.ts` uses that one.
4. **Account deletion and feature tables: checked.** Every table that points at `users(id)` has an
   `ON DELETE` rule.
5. **Running jobs at deletion: done.** The worker drops a result whose job row is gone or already
   ended, instead of trying to save files for it.
