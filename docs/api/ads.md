# Ads studio API

Make ads for a product: describe the brand and the product once, pick formats, get variations.

The building blocks:

- **Brand kit**: name, colours, fonts, tone of voice, logo, words to use and words to avoid.
- **Product**: name, description, key benefits, audience, price, link, product images.
- **Ad format**: a fixed recipe from the catalog (hero shot, unboxing clip, spokesperson...). Each one
  runs on one model with fixed settings, so its price is known up front.
- **Campaign**: one product, an optional brand kit, the chosen formats and a number of variations
  (1 to 4). Price it, then run it. Each run makes one **ad** (an "item") per format and variation.
- **Ad copy**: a headline, a caption and a call to action for every ad, plus scripts for spoken ads.
  **The copy writer is template-based.** There is no language model in Parallax yet: the wording is
  filled in from the product and brand fields using fixed templates. It is predictable and on-topic,
  but not creative. Say so in the UI (for example, "Starter copy, edit before posting").

Every route below needs a signed-in member (guests count) unless it says "public". Every response is
JSON. Times are Unix milliseconds. Money is **millicredits** (1 credit = 1000; show `cost / 1000`).

## Errors

All errors have one shape. `message` is written for the member and can be shown as is.

```json
{ "error": { "code": "invalid_request", "message": "Add a product name." } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `invalid_request` | A field is missing, the wrong type or too long. The message names it. |
| 401 | `unauthorized` | Not signed in. |
| 402 | `insufficient_credits` | The run costs more than the balance. |
| 403 | `forbidden` | Cross-site write. |
| 404 | `not_found` | The thing does not exist, or belongs to someone else. |
| 409 | `price_changed` | `expectedCost` did not match the price now. Show the new quote. |
| 409 | `already_ran` | The campaign already ran. Re-run a format or duplicate it. |
| 409 | `invalid_request` | E.g. marking an unfinished ad as a winner; running without a product. |
| 409 | `model_unavailable` | A format's model is offline right now. |
| 413 | `invalid_request` | Body too large. |

## Shapes

### Image reference

```json
{ "assetId": "ast_…", "url": "/api/assets/ast_…/file" }
```

Images (logo, product images, presenter photo) are the member's own assets. Upload them first with
`POST /api/assets` (core API) or pick from the library, then pass the `assetId`.

### BrandKit

```json
{
  "id": "abk_…",
  "name": "Oak & Ember",
  "colors": [{ "name": "Ember", "hex": "#C2410C" }, { "name": "", "hex": "#1F2937" }],
  "fonts": { "heading": "Fraunces", "body": "Inter" },
  "tone": "Warm and playful",
  "wordsToUse": ["handmade", "small batch"],
  "wordsToAvoid": ["cheap"],
  "logo": { "assetId": "ast_…", "url": "/api/assets/ast_…/file" },
  "createdAt": 1794560000000,
  "updatedAt": 1794560000000
}
```

`logo` is `null` when there is none or the image was deleted. Fonts are names only; nothing is loaded.

### Product

```json
{
  "id": "apr_…",
  "brandKitId": "abk_…",
  "name": "Ember Candle",
  "description": "A soy candle that smells like a campfire",
  "benefits": ["burns for 60 hours", "clean soy wax"],
  "audience": "people who love slow evenings",
  "price": "$24",
  "link": "https://example.com/candle",
  "images": [{ "assetId": "ast_…", "url": "/api/assets/ast_…/file" }],
  "createdAt": 1794560000000,
  "updatedAt": 1794560000000
}
```

`price` is free text, as the member writes it. Deleted images drop out of `images` on their own.

### Format (from the catalog)

```json
{
  "id": "hero-shot",
  "name": "Product hero shot",
  "description": "The product alone, lit like a studio photo, ready for a feed post.",
  "output": "image",
  "group": "image",
  "platform": { "label": "Square feed post", "aspect": "1:1", "seconds": null },
  "modelId": "gpt-image-2",
  "modelName": "…",
  "speechModelId": null,
  "values": { "aspect": "1:1", "quality": "medium", "background": "auto" },
  "slots": [{ "slot": "refs", "from": "product-images", "max": 4, "required": false, "label": "…" }],
  "needsPresenter": false,
  "usesProductImages": true,
  "spoken": false,
  "available": true,
  "pricePerAd": 1400
}
```

- `output`: `image` | `video` | `audio`. `group`: `image` | `video` | `spoken` (for tabs or filters).
- `platform.aspect` is `null` for audio; `platform.seconds` is `null` for images.
- `slots[].from` says where the files come from: `product-images` (the product's images, first `max`
  of them), `presenter` (the campaign's presenter photo), `speech` (made by the format's speech step).
- `needsPresenter`: the campaign must have `presenterAssetId` to use this format.
- `spoken`: the format reads a script (the campaign's `script`, or one the copy writer drafts).
- `pricePerAd`: millicredits for one ad. For spoken formats it is a typical price for a script of the
  format's length; the campaign quote is exact.
- `available: false` means the model is offline; hide or disable the format. `pricePerAd` is then `null`.

The catalog today:

| id | name | output | platform | model |
|---|---|---|---|---|
| `hero-shot` | Product hero shot | image | 1:1 feed post | gpt-image-2 |
| `lifestyle-scene` | Lifestyle scene | image | 3:4 feed post | gpt-image-2 |
| `before-after` | Before and after | image | 3:2 feed post | gpt-image-2 |
| `web-banner` | Wide web banner | image | 16:9 banner | gpt-image-2 |
| `story-still` | Vertical story still | image | 9:16 story | gpt-image-2 |
| `unboxing` | Unboxing clip | video | 9:16, 6 s, with sound | veo-3.1-lite |
| `handheld-review` | Hand-held review | video | 9:16, 5 s | kling-3-std |
| `product-motion` | Product in motion | video | 1:1, 5 s | seedance-1-lite |
| `vertical-story` | Vertical story video | video | 9:16, 5 s | wan-2.6 |
| `spokesperson` | Spokesperson | video | 9:16, 15 s talking video | minimax-speech-2.8-turbo, then heygen-avatar-iv |
| `voiceover` | Audio spot | audio | audio ad | minimax-speech-2.8-turbo |

Read the list from the API, not from this table.

### Campaign

```json
{
  "id": "acm_…",
  "name": "Autumn launch",
  "product": { "id": "apr_…", "name": "Ember Candle" },
  "brandKit": { "id": "abk_…", "name": "Oak & Ember" },
  "formats": ["hero-shot", "unboxing", "voiceover", "spokesperson"],
  "variations": 2,
  "script": "",
  "presenter": { "assetId": "ast_…", "url": "/api/assets/ast_…/file" },
  "copiedFrom": null,
  "createdAt": 1794560000000,
  "updatedAt": 1794560000000,
  "status": "running",
  "counts": { "waiting": 3, "running": 4, "succeeded": 1, "failed": 0, "canceled": 0, "winners": 0 },
  "groups": [
    { "format": { "id": "hero-shot", "name": "Product hero shot", "output": "image", "group": "image", "platform": { … } },
      "items": [ /* Ad, newest round first, then by variation */ ] }
  ]
}
```

- `status`: `draft` (never run) | `running` (some ads waiting or running) | `done`.
- `product` / `brandKit` are `null` if not set or since deleted. A campaign without a product cannot run.
- `script`: the words for spoken formats. Empty means each variation gets a script from the copy writer.
- `groups`: one per format, in the campaign's format order. Present only on single-campaign responses.
  In the list, each campaign has `cover` instead (see below).

### Ad (an item in a group)

```json
{
  "id": "adi_…",
  "campaignId": "acm_…",
  "formatId": "hero-shot",
  "round": 1,
  "variation": 2,
  "status": "succeeded",
  "winner": false,
  "prompt": "Commercial product photograph of …",
  "script": "",
  "copy": { "headline": "…", "caption": "…", "cta": "Shop now" },
  "cost": 1400,
  "error": null,
  "job": { /* core Job, see the jobs API: status, assets, eta, startedAt… */ },
  "speechJob": null,
  "assets": [{ "id": "ast_…", "kind": "image", "url": "/api/assets/ast_…/file", "posterUrl": null, … }],
  "createdAt": 1794560000000,
  "finishedAt": 1794560009000
}
```

- `status`: `waiting` (queued here, not yet sent; it starts when a job slot frees up) → `running` →
  `succeeded` | `failed` | `canceled`. Show `waiting` as "In line".
- `round`: 1 for the first run; each re-run of a format adds a round. Older rounds stay.
- `error` is `{ code, message }` when `failed`; show `message`.
- `job` is `null` until the ad's main job is sent. Use `job.status`, `job.eta` and `job.startedAt` for a
  progress bar. `assets` is a shortcut for `job.assets` (the results).
- `speechJob`: only for `spokesperson`: the speech step that runs first. While it runs, the ad is
  `running` and `job` is still `null`.
- `cost`: the quoted millicredits for this ad. Credits are held when each job is sent and given back
  if it fails.

## Routes

### Formats

#### `GET /api/ads/formats` (public)

```json
{ "formats": [Format, …], "copyWriter": "template" }
```

### Brand kits

#### `GET /api/ads/brands`
`{ "brandKits": [BrandKit, …] }`, newest first.

#### `POST /api/ads/brands`

| Field | Type | Rules |
|---|---|---|
| `name` | string | required, ≤ 80 |
| `colors` | array | ≤ 12; each `"#RRGGBB"` or `{ "name": "Main", "hex": "#RRGGBB" }` (name ≤ 40) |
| `fonts` | object | `{ "heading": string ≤ 60, "body": string ≤ 60 }` |
| `tone` | string | ≤ 300. Words like "playful", "bold", "calm", "premium" steer the calls to action. |
| `logoAssetId` | string \| null | one of the member's images |
| `wordsToUse` | string[] | ≤ 30, each ≤ 40. Added to captions as hashtags. |
| `wordsToAvoid` | string[] | ≤ 30, each ≤ 40. Kept out of copy and scripts. |

```bash
curl -X POST /api/ads/brands -d '{"name":"Oak & Ember","colors":[{"name":"Ember","hex":"#C2410C"}],"tone":"Warm and playful"}'
```
→ `{ "brandKit": BrandKit }`. Errors: 400 (fields), 404 (logo not found). Up to 50 kits per member.

#### `GET /api/ads/brands/:id` → `{ "brandKit": BrandKit }` · 404
#### `PATCH /api/ads/brands/:id`
Same fields as POST, all optional. Only the fields sent change; send `null` to clear the logo.
→ `{ "brandKit": BrandKit }`
#### `DELETE /api/ads/brands/:id` → `{ "ok": true }`
Products and campaigns that used the kit keep working without one.

### Products

#### `GET /api/ads/products?brandKitId=abk_…`
`{ "products": [Product, …] }`, newest first. `brandKitId` is an optional filter.

#### `POST /api/ads/products`

| Field | Type | Rules |
|---|---|---|
| `name` | string | required, ≤ 80 |
| `description` | string | ≤ 600 |
| `benefits` | string[] | ≤ 8, each ≤ 120. Each variation leads with a different one. |
| `audience` | string | ≤ 200 |
| `price` | string | ≤ 40, free text |
| `link` | string | full `http(s)://` link, ≤ 500 |
| `imageIds` | string[] | ≤ 8 of the member's images. The first 4 guide image formats; the first one starts video formats. |
| `brandKitId` | string \| null | one of the member's kits |

```bash
curl -X POST /api/ads/products -d '{"name":"Ember Candle","benefits":["burns for 60 hours"],"imageIds":["ast_…"]}'
```
→ `{ "product": Product }`. Errors: 400, 404 (image or kit not found). Up to 200 products.

#### `GET /api/ads/products/:id` → `{ "product": Product }`
#### `PATCH /api/ads/products/:id` — partial, like brand kits → `{ "product": Product }`
#### `DELETE /api/ads/products/:id` → `{ "ok": true }`
Campaigns using it keep their results but show `product: null` and can no longer run.

### Ad copy

#### `POST /api/ads/copy`

| Field | Type | Rules |
|---|---|---|
| `productId` | string | required |
| `brandKitId` | string | optional; defaults to the product's kit |
| `count` | integer | 1–10, default 3 |
| `seconds` | number | 5–60, default 15: target length of the script |

```json
{
  "writer": "template",
  "copy": [{ "headline": "Burns for 60 hours. Meet Ember Candle.", "caption": "…", "cta": "Shop now" }],
  "script": "Okay, I have to tell you about Ember Candle. …"
}
```

Use it to prefill the campaign `script` field or to show copy ideas. Campaign ads get their own copy
automatically. Same input gives the same output.

### Campaigns

#### `GET /api/ads/campaigns`

```json
{ "campaigns": [ { …Campaign without groups, "cover": { "assetId": "ast_…", "kind": "image", "url": "…" } | null } ] }
```

`cover` is the first winner's result, else the first finished ad's result.

#### `POST /api/ads/campaigns` — create a draft

| Field | Type | Rules |
|---|---|---|
| `productId` | string | required |
| `formats` | string[] | required, ≥ 1 format ids from the catalog, duplicates dropped |
| `variations` | integer | 1–4, default 1 |
| `brandKitId` | string \| null | optional |
| `name` | string | ≤ 80; default "Campaign YYYY-MM-DD" |
| `script` | string | ≤ 1200, line breaks kept. For spoken formats. |
| `presenterAssetId` | string \| null | an image of a person; required by `spokesperson` at quote/run time |

→ `{ "campaign": Campaign }` (status `draft`). Errors: 400, 404 (product, kit or image not found).

#### `GET /api/ads/campaigns/:id`
→ `{ "campaign": Campaign }` with `groups`. **Poll this every 2–3 s while `status` is `running`.**

#### `PATCH /api/ads/campaigns/:id`
Same fields as POST, all optional; only what is sent changes. Changing a campaign after it ran
affects later re-runs only. → `{ "campaign": Campaign }`

#### `DELETE /api/ads/campaigns/:id` → `{ "ok": true }`
Ads not yet sent are dropped, queued jobs are canceled and their credits returned. Results already
made stay in the member's library.

#### `GET /api/ads/campaigns/:id/quote?formatId=`
Exact price of running the campaign, or, with `formatId`, of re-running that one format.

```json
{ "quote": {
  "total": 62600, "ads": 8, "balance": 559900, "enough": true,
  "formats": [{ "formatId": "hero-shot", "formatName": "Product hero shot", "ads": 2, "subtotal": 2800 }]
} }
```

Errors: 400 (e.g. "Add a presenter photo for the Spokesperson format.", script too long),
409 (no product), 409 `model_unavailable`.

#### `POST /api/ads/campaigns/:id/run`  `{ "expectedCost"?: number }`
Runs the campaign once. Pass the `total` from the quote you showed as `expectedCost`; if the price
moved, you get 409 `price_changed` and should show the new quote.

→ `{ "campaign": Campaign, "balance": number }`. Errors: 402 `insufficient_credits`, 409 `already_ran`,
409 `price_changed`, plus the quote errors.

How it runs: every ad starts as `waiting`. The server sends one job per ad (surface `ads`) while the
member has free job slots (their plan's limit on jobs at once, shared with the rest of the studio)
and feeds in the rest as jobs finish. Credits are held per job as it is sent, so the balance drops
gradually. If the balance runs out midway, the remaining ads fail with `insufficient_credits`.

#### `POST /api/ads/campaigns/:id/rerun`  `{ "formatId": string, "expectedCost"?: number }`
Makes a new round of `variations` ads for one format, with new angles. Earlier rounds and winners
stay. The format must be in the campaign (or have run in it before).
→ `{ "campaign": Campaign, "balance": number }`. Errors as for run (except `already_ran`), 400 if the
format is not in the campaign.

#### `POST /api/ads/campaigns/:id/duplicate`
A new draft with the same product, kit, formats, variations, script and presenter. Name gets
" (copy)". → `{ "campaign": Campaign }` (status `draft`, `copiedFrom` set).

### Ads

#### `PATCH /api/ads/items/:id`  `{ "winner": boolean }`
Mark or unmark a winner. Only `succeeded` ads can be winners (409 otherwise).
→ `{ "item": Ad }`

Results can also be removed through the core API (`DELETE /api/jobs/:jobId`); the ad then shows as
`canceled` or keeps no assets.

## Generated jobs

Every job made by this feature has `surface: "ads"` and
`meta: { campaignId, itemId, formatId, variation, round, step }`, where `step` is `speech` or `main`.
So `GET /api/jobs?surface=ads` lists them, and the library can link a result back to its campaign.

## Tables (`migrations/070_ads.sql`)

| Table | What |
|---|---|
| `ad_brand_kits` | One brand kit. Lists are JSON. `logo_asset_id` points at `assets`. |
| `ad_products` | One product. `image_ids` is a JSON list of asset ids. `brand_kit_id` optional. |
| `ad_campaigns` | Settings of a campaign: product, kit, `formats` (JSON ids), `variations`, `script`, `presenter_asset_id`, `copied_from`. |
| `ad_items` | One ad: campaign, format, round, variation, status, prompt, script, copy (JSON), inputs (JSON), quoted cost, `speech_job_id`, `job_id`, `winner`, error. Deleted with its campaign. |

All rows carry `user_id`; every query filters by it.

## Open improvements

1. **A job-finished hook.** The ads feeder notices finished jobs by polling: a 1.5 s timer in the
   server process, started by the first ads request, plus a check on every ads read. A call such as
   `onJobFinished(surface, fn)` in `src/server/worker.ts` would let features advance their queues the
   moment a job ends, and would survive a restart without waiting for an ads request.
   (After a restart, waiting ads resume as soon as anyone calls an ads route.)
2. **Export `activeCount(userId)` from `src/server/jobs.ts`.** The feeder repeats that query to know
   how many slots are free.
3. **A text model in the registry.** Ad copy is template-based because there is none. With one, a
   `CopyWriter` backed by it can replace `templateWriter` in `src/server/ads/copy.ts` with no API change.
