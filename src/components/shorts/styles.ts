/** Class strings this page repeats. Values are the design's own. */

/** The lime "Start generating" button: 40 high, the inset lip and the long drop shadow, as drawn. */
export const LIME_BUTTON =
  "inline-flex h-10 items-center justify-center rounded-lg bg-brand bg-[linear-gradient(180deg,#FFFF1400_0%,#FFFF14_100%)] px-4 pb-[3px] text-sm leading-4 font-semibold text-text-inverse [box-shadow:#829B19_0px_-3px_0px_inset,#00000040_0px_6px_4px,#00000026_0px_32px_24px] transition-[filter] duration-150 hover:brightness-105 active:brightness-95";

/** One vertical tile, 238 × 424 at 1440, as drawn. */
export const TILE =
  "group relative block aspect-[238/424] w-full overflow-clip rounded-2xl border border-border-subtle bg-surface-secondary text-left";

/** The darkening toward the bottom of a tile. */
export const TILE_SHADE = "pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#00000000_39.24%,#131416CC_87.22%)]";

/** The soft inner glow along the tile's edge. */
export const TILE_GLOW = "pointer-events-none absolute inset-0 rounded-2xl [box-shadow:#FFFFFF1A_0px_-8px_36px_inset]";

/** The page's grid of tiles: five across at 1440, fewer on smaller screens. */
export const TILE_GRID = "grid w-full grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
