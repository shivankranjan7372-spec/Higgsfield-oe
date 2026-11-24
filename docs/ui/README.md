# Building screens for Parallax

This page is for people and agents building or changing a screen. Read it before you write
code, together with `AGENTS.md` (this is Next.js 16 and it differs from older versions) and the
worked example: the Image page (`src/app/image/page.tsx`, `src/components/image/`).

A screen has three sources. Each answers one question.

| Question | Source |
|---|---|
| How does it look? | The design system in `src/app/globals.css` and the screens that already exist. |
| What data does it show and change? | `docs/api/core.md` and the feature's page in `docs/api/`. |
| How do I write it here? | This guide and the shared code it names. |

## 1. The design

Parallax was built from a design file that is not part of this repository. What it defined
lives in the code: the tokens in `src/app/globals.css` (section 3), the shared controls in
`src/ui/`, and the finished screens. A new screen should look like it was drawn with the rest.

- Take sizes, gaps, radii, colours and type from the tokens and from a neighbouring screen.
  Do not invent a second scale.
- Lay pages out with flex and grid so they work at any width. Keep `absolute` for things that
  truly overlap (a badge on a tile, a glow behind a hero).
- Run the app and put your screen next to an existing one before you call it done.

### Content is always our own

Parallax is its own product. Whatever you use as a reference, it gives you layout and
style, never content:

| Never copy | Use instead |
|---|---|
| Another product's product, feature or plan names | `routes`, `navPrimary`, `navStudios` in `@/content/site`, `brand.name` in `@/config/brand` |
| Another product's logo or wordmark | `Logo`, `LogoMark` from `@/components/brand/logo` |
| Model makers' logos | `VendorGlyph` from the same file |
| Headlines, body copy, button labels, FAQ text | Your own words, in `src/content/<feature>.ts` |
| Prices, credit amounts, discounts, counters | Real values from the API or `@/config/economy`. Never an invented number. |
| Photos, posters, thumbnails, illustrations | An `Artwork` slot (section 5) or real files from the API |
| People's names, handles, faces, comments | Real data from the API. If there is none yet, show the empty state. |
| Icons | The closest `lucide-react` icon, `strokeWidth={1.5}` |

Keep wording short and plain.

## 2. The page pattern

Every page is a small server file that renders one client component inside the shell:

```tsx
// src/app/video/page.tsx
import type { Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";
import { VideoStudio } from "@/components/video/video-studio";

export const metadata: Metadata = { title: "Video" };

export default function VideoPage() {
  return (
    <AppShell active="video" fixed>
      <VideoStudio />
    </AppShell>
  );
}
```

- `AppShell({ active, fixed, nav, footer, children })` draws the promo strip and the top nav, then
  your page in a `<main>` that is a flex column. `active` is the nav item to light up (a `NavId`
  from `@/content/site`). `fixed` makes the page exactly one screen tall, for a studio that
  scrolls inside itself; leave it out for a page that scrolls as a whole. `nav="full"` asks for
  the taller 52-pixel bar used on the home and pricing pages; the default is the 36-pixel
  compact bar. `footer` adds the site footer under a scrolling page. Do not draw your own top
  nav or footer; they live in `src/components/shell/`.
- The app is built with `cacheComponents`. The page file is prerendered, so it must not read
  the clock, the address bar, cookies or random numbers. Do those in the client component:
  - the time: `useNow()` from `@/lib/browser` (seconds, `null` until the page is live);
  - a query value: `useQueryParam("tab")` from `@/lib/browser`, not `useSearchParams`;
  - anything else that only exists in the browser: check `useLive()` first.
  Avoid `usePathname`; pass what you need as a prop.
- A dynamic folder (`src/app/apps/[id]/page.tsx`) gets `params` as a Promise. Read the matching
  guide under `node_modules/next/dist/docs/01-app/` before you write one, and keep the page file
  to a thin shell that passes the id to a client component.
- Do not export `runtime` or `dynamic`. Do not add `typedRoutes`.
- Data comes from the app's own API with SWR, in client components. No server-side data
  fetching in pages, and never import from `@/server/*` in a screen except as a type.

Put your components in `src/components/<your feature>/`, your words in
`src/content/<your feature>.ts`, and keep page files tiny.

## 3. Tokens

All in `src/app/globals.css`. Use the token classes, not raw values, wherever a token has the
value you need. A value with no token is written as an arbitrary class (`w-[394px]`,
`gap-[10px]`, `bg-[#FFFFFF14]`).

**Colour** (`bg-*`, `text-*`, `border-*`):

| Token | Value | Token | Value |
|---|---|---|---|
| `page` | #0F1113 | `text-primary` | #FFFFFF |
| `surface-primary` | #131416 | `text-nav` | #A8A8A8 |
| `surface-secondary` | #1C1E21 | `text-secondary` | #828282 |
| `surface-secondary-strong` | #23262A | `text-tertiary` | #626262 |
| `surface-tertiary` | #2A2D32 | `text-inverse` | #1A1A1A |
| `surface-elevated` | #383E46 | `text-muted` | #898A8B |
| `surface-shell` | #131517 | `text-soft` | #F7F7F8 |
| `surface-menu` | #1C1E20 | `text-idle` | #FFFFFF4C |
| `surface-field` | #27292C | `text-tab` | #FFFFFF80 |
| `surface-glass` | #23262ABF | `border-subtle` | #FFFFFF0D |
| `surface-sunken` | #18191C | `border-default` | #FFFFFF1A |
| `toggle-track` | #484E56 | `border-strong` | #FFFFFF33 |
| `brand` | #D1FE17 | `brand-pressed` | #B2D814 |
| `brand-tint` | #D1FE1726 | `brand-chip` | #D1FE173D |
| `brand-shadow` | #829B19 | `brand-glow` | #CDFF00 |
| `promo` | #FF005B | `promo-soft` | #ED1572 |
| `danger` | #FF6B6B | `ink` | #131517 |
| `scrim` | #000000CC | | |

So white text is `text-text-primary`, and a hairline is `border border-border-default`.

**Type size** (`text-*`): `2xs` 10, `xs` 12, `sm` 14, `base` 16, `lg` 18, `xl` 20, `2xl` 24,
`3xl` 28, `4xl` 36, `5xl` 48 pixels. Always set a line height
(`leading-5`, `leading-[18px]`).

**Radius** (`rounded-*`): `xs` 4, `sm` 6, `md` 8, `lg` 10, `xl` 12, `2xl` 16, `3xl` 20, `4xl` 24,
`full`. These differ from stock Tailwind.

**Spacing**: the stock scale, 1 unit = 4 pixels (`gap-3` is 12 pixels).

**Fonts**: `font-sans` Inter (the default), `font-display` Space Grotesk (uppercase display
lines), `font-mono` IBM Plex Mono (code, counters), `font-racing` and `font-space-mono` (a few
headlines).

**Other**: breakpoint `desktop:` at 1440 pixels. Shadows `shadow-composer`, `shadow-menu`,
`shadow-lime`, `shadow-lime-deep`, `shadow-pill`, `shadow-inset-soft`. Motion `animate-fade-in`,
`animate-rise-in`, `animate-shimmer`, easing `ease-out-soft`. Utilities `scroll-quiet` (thin
scrollbar), `scroll-none` (no scrollbar), `shimmer` (loading sweep; the element needs its own
background colour), `text-chrome` (the silver gradient text).

Add a token to `globals.css` only when more than one screen needs it. If a value repeats
across one screen, make a constant in that screen's component.

## 4. The shared building blocks

Read the source of a block before you use it; each file is short and commented.

**`@/ui`** (basic controls)

| Name | Use |
|---|---|
| `Button`, `ButtonLink`, `buttonClass(variant, size)` | Variants `lime`, `tint`, `white`, `outline`, `soft`, `ghost`. Sizes `xs` (24 high), `sm` (32), `pill` (38), `pill-xs` (24), `md` (40). `ButtonLink` takes `href`. |
| `Chip` | The 32-pixel grey chip in a composer; lights up while its menu is open. |
| `Tag` | The tiny label after a name. Tones `brand`, `neutral`, `solid`. |
| `IconButton`, `iconButtonClass(size, tone)` | Sizes 24, 28, 32, 38. Tones `plain`, `soft`, `dim`, `lime`, `quiet`. Always give it `aria-label`. |
| `Popover`, `PopoverTrigger`, `PopoverAnchor`, `PopoverClose`, `PopoverContent` | Menus and pickers. `PopoverContent` takes `look="glass"` or `"panel"`, `align`, `sideOffset`. |
| `MenuLabel`, `MenuItem({ icon, selected, hint })` | Rows inside a popover. |
| `Dialog`, `DialogTrigger`, `DialogClose`, `DialogContent({ title, hideTitle, closeButton })` | Modals. `title` is required, for screen readers. |
| `Switch`, `Spinner` | A toggle; a loading ring. |
| `Artwork` | A picture slot. Section 5. |
| `cn(...)` | Joins class names. It does **not** resolve conflicts. |

There is no class merging in this app. If a block sets `h-8` and you pass `h-10`, both land on
the element and the result is luck. Never pass a class that fights one the block already
sets. Pick the right variant or size, wrap the block, or build your own element.

For anything else interactive (tabs, tooltips, sliders, selects, accordions), import the
primitive from `radix-ui` (`import { Tabs } from "radix-ui"`) and style it in your own
component, the way `src/ui/popover.tsx` does. Avoid new npm packages.

**`@/components/studio`** (the shared composer)

`Composer({ studio, placeholder?, extra? })`, `ComposerDock`, and its parts `ModelPicker`,
`ControlChip`, `ControlField`, `MoreChip`, `CountChip`, `GenerateButton({ studio, label? })`,
`PromptField`, `ReferenceChip`, `AttachedStrip`, `AssetThumb`, `AspectGlyph`. They draw
themselves from the chosen model's registry entry, so they work for any model. A create page
with a floating prompt bar uses `Composer` whole. A create page with a side form builds its
own layout from the parts and from `studio` directly.

**`@/lib/studio`** (state for a create page)

- `useStudio(surface)` returns everything a create form needs: `models`, `model`, `pickModel`,
  `prompt`, `setPrompt`, `values`, `setValue`, `controls` (`main` and `advanced`), `slots`,
  `attached`, `attach`, `attachAssets`, `detach`, `drop(files)`, `uploading`, `count`,
  `setCount`, `maxCount`, `quote` (the live price), `blocker` (why Generate is disabled, or
  null), `busy`, `error`, `errorCode`, `clearError`, `generate()`, `load(job)` (use a past job's
  settings again).
- `useJobs(surface)` returns `{ jobs, working, loading }` and keeps polling while work is
  running. `isActive(job)` says whether a job is still queued or running.
- `surface` is a short name. The model registry knows these: `image`, `video`, `avatar`,
  `speech`, `music`. There is no `audio` surface: an audio page offers `speech` and `music`.
  `useStudio` lists the models of that surface; `useJobs` lists the jobs submitted from it.

**`@/lib/api`** (talking to the server)

```ts
import useSWR from "swr";
import { api, errorMessage, fetcher, type Asset, type Job } from "@/lib/api";

const { data, error, isLoading, mutate } = useSWR<{ folders: Folder[] }>("/api/folders", fetcher);
await api("/api/folders", { method: "POST", body: { name } });   // a plain object is sent as JSON
await api("/api/assets", { method: "POST", body: formData });     // FormData is an upload
catch (e) { setProblem(errorMessage(e)); }                         // the server's own sentence
```

Errors arrive as `ApiError` with `status`, `code` and a `message` written for the member; show
the message as it is. `Job`, `Asset` and `SessionUser` are the types of what the core API
returns. For your feature's shapes, write types in your own files from the API page.

**`@/lib/session`** (who is here)

- `useSession()` returns `{ user, member, balance, loading }`. `user` is null for a visitor who
  has done nothing yet. A guest is a `user` who is not a `member`. `balance` is in millicredits.
- Before a visitor's first write (a generation, an upload, a like), call `await ensureSession()`.
  It makes a guest account if there is none. `useStudio` already does this for generating.
- `signUp`, `logIn`, `logOut`, `refreshSession`. After a call that changes the balance, call
  `setBalance(newBalance)` if the response carries it, or `refreshSession()`.
- To send someone to sign in, either link to `routes.login` or `routes.join` with
  `?next=<the path to come back to>`, or open the shared window in place:
  `<LoginDialog open={open} onOpenChange={setOpen} mode="join" />` from
  `@/components/entry/login-dialog`. Do not build your own sign-in form.
- Search has a shared window too: `SearchDialog({ open, onOpenChange })` from
  `@/components/entry/search-dialog`, and the page `routes.search` (it reads `?q=`).
- Some actions need a member, not a guest (the API answers 401 or 403 with a clear message).
  Show that message with a "Create account" button.

**Other**

- `@/content/site`: `routes` (every page address), `navPrimary`, `navStudios`, `NavId`, `promo`,
  `pricingBadge`. Link with `routes.library`, never a typed-out string. For a page under yours,
  build on it: `` `${routes.apps}/${app.id}` ``.
- Addresses of other features' pages. Link to them in exactly this form:
  - one public post: `` `${routes.post}/${post.id}` ``
  - a member's public page: `` `${routes.profile}/${handle}` ``
  - one contest: `` `${routes.contests}/${contest.slug}` ``
  - a create page with a model and a prompt filled in:
    `` `${routes.image}?model=${model.id}&prompt=${encodeURIComponent(text)}` `` (the same two
    parameters work on every create page that uses `useStudio`). Use it for "Recreate", "Try this
    prompt" and "Open in the studio" buttons.
- `@/config/economy`: `formatCredits(millicredits)` for every credit amount on screen.
- `@/registry`: `models`, `getModel`, `modelsFor(surface)`, `defaultModel(surface)`, the
  `ModelDef` type. Model names, makers and options come from here, never from the design.
- `@/lib/closable`: for a banner or tip that stays closed once closed. `closeForGood(name)`
  on the close button and `data-closable="<name>"` on the element. Only the names listed in
  that file work; add yours there.
- `@/lib/browser`: `useNow`, `useQueryParam`, `useLive`.
- `@/lib/live`: live streams (server-sent events). Never open an `EventSource` yourself: a
  browser allows six connections to a site, and streams left open make every other request
  wait. `liveStream(url, events)` makes one shared connection per tab, closed while the tab is
  hidden; `useLiveStream(stream, onEvent, enabled)` listens. `notificationStream` is ready made.
  On `ready` (every new connection) catch up on what you missed; `STREAM_DOWN` means it dropped.

## 5. Pictures and media

- **A member's files** come from the API as `Asset` objects. Draw them with a plain `<img>` or
  `<video>` and the asset's own addresses: `asset.posterUrl ?? asset.url` for a still,
  `asset.url` to play, `` `${asset.url}?download=1` `` to download. They are protected by the
  session cookie, so `next/image` cannot load them:

  ```tsx
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img src={asset.posterUrl ?? asset.url} alt={job.prompt} loading="lazy" className="size-full object-cover" />
  ```

  `src/components/image/results.tsx` shows the whole pattern: finished, pending and failed tiles.
- **Decorative and sample pictures** (heroes, covers, preset tiles, banners) are `Artwork` slots:

  ```tsx
  import { Artwork } from "@/ui";
  <Artwork name="video/hero" className="aspect-video w-full rounded-2xl" />
  ```

  Name each slot `<your feature>/<what it is>` and give it a size with `className`. Until a
  picture exists for the name, the slot is a soft gradient that is different for each name.
  A picture is added by name in `src/content/media.ts`, with its file under `public/media/`.
  Every file there must be your own work or made with Parallax.
- Do not load pictures, video or fonts from another site. Never hotlink. A page must look
  finished with gradient slots.

## 6. Every state, not only the resting one

A screen is more than its resting state at 1440 wide. These are part of the job, not extras.

- **Hover**: one step lighter surface (`surface-secondary` → `surface-secondary-strong` →
  `surface-tertiary`). Nav and tab text goes `text-text-idle` → `text-text-tab` on hover →
  white or lime when active. Transitions are `transition-colors duration-150`.
- **Focus**: a 2-pixel lime ring is already set globally on `:focus-visible`. Do not remove it.
  Everything clickable must be reachable with Tab and work with Enter or Space; Escape closes
  menus and dialogs and returns focus (the Radix-based blocks do this for you).
- **Loading**: a quiet skeleton in the shape of what is coming (`shimmer` on a block with a
  background), not a spinner in the middle of the page.
- **Empty**: one line on what belongs here and one button to make the first thing.
- **Error**: the server's message, close to where it happened, with a way to try again.
- **Signed out and guest**: every page must open for a visitor who is not signed in. Show
  what the page is for and invite them in; never show a blank page or a raw error.
- **Small screens**: the page must work at 390 pixels wide with no sideways scrolling. Side
  panels stack or become a sheet, grids drop columns, wide rows scroll inside themselves
  (`overflow-x-auto scroll-none`).
- **Names for controls**: every icon-only button has `aria-label`; every input has a label;
  pictures that carry meaning have `alt`.
- **Long content**: truncate with `truncate` or `line-clamp-2`; set `min-w-0` on flex children
  that hold text.
- **Time and money**: times through `useNow()` and `Intl`; credits through `formatCredits`.
- A job that answers 404 while you are polling it was canceled or removed. Drop it quietly.
- A control the server cannot back yet (see the feature's API page) is left out, not faked.
  Do not draw a button that does nothing.

## 7. Where a screen's files go

- `src/app/<its pages>/`: thin page files
- `src/components/<feature>/`: its components
- `src/content/<feature>.ts`: every word it shows
- `tests/ui/<feature>.mjs`: its browser walk-through

Shared code (`src/ui/`, `src/lib/`, `src/components/{studio,brand,shell,entry}/`,
`src/content/site.ts`, `src/app/globals.css`) is used by every screen. Change it in its own
pull request, and say which screens you checked. Do not link to a page by guessing its
address; use `routes`.

## 8. Checking your work

Develop against the real app in mock mode. It needs no key and spends nothing:

```bash
TREG_MODE=mock AGENT_MODE=mock PARALLAX_DEMO_BILLING=1 PARALLAX_DATA_DIR=/tmp/px-dev npm run dev -- -p 3200
```

In mock mode every model answers with a sample file after a short delay, and a prompt that
contains `[fail]` fails, so you can see every state.

Write or extend `tests/ui/<your feature>.mjs`: a browser walk-through of your screen, in the style of
`tests/ui/image.mjs`. It uses `tests/ui/browser.mjs`, a small headless-Chrome driver with its
own throwaway profile (read its header for the calls). The walk-through should open each of
your pages, check that the main things are there, use the main controls the way a member
would, check that nothing scrolls sideways, and save a screenshot at each step.

```bash
npm run typecheck      # must pass
npm run lint           # must pass
npm run build          # must pass (stop your dev server first)
python3 tests/run.py tests/core_e2e.py tests/ui/<your feature>.mjs        # must pass
UI_SIZE="390 844" python3 tests/run.py tests/ui/<your feature>.mjs        # must pass at phone size
```

Screenshots land in `ui-shots/<your feature>/` (and `ui-shots/<your feature>-390/`). Open them
and look: position, size, colour, type. Fix what is off and run again. The browser log printed
at the end of a run must have no errors that come from your pages.

Only ever start a browser through `tests/ui/browser.mjs`. Do not use any browser that is
already running on the machine, and do not connect to a debugging port you did not open.
