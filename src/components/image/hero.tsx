import Image from "next/image";
import { heroes } from "@/content/site";
import { cn } from "@/ui";

/* The fan of four tiles, as drawn: where each sits, how far it leans, and its frame. */
const TILES = [
  { place: "left-0 -rotate-[10deg]", frame: "rounded-xl border-4 border-[#FFFFFF4C]" },
  { place: "left-[126px] rotate-[4deg]", frame: "rounded-xl" },
  { place: "left-[252px]", frame: "rounded-full border-4 border-[#FFFFFF4C]" },
  { place: "left-[378px] -rotate-[4deg]", frame: "rounded-xl border-4 border-[#FFFFFF4C]" },
] as const;

function Fan({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("h-[144px] w-[522px]", className)}>
      {heroes.image.tiles.map((src, i) => {
        const tile = TILES[i % TILES.length];
        return (
          <div
            key={src}
            className={cn(
              "absolute top-0 size-[144px] overflow-clip [box-shadow:#00000008_0px_0.3px_0.3px_-0.15px,#00000008_0px_0.9px_0.9px_-0.45px]",
              tile.place,
              tile.frame,
            )}
          >
            <Image src={src} alt="" width={144} height={144} sizes="144px" className="size-full object-cover" />
          </div>
        );
      })}
    </div>
  );
}

/** What the Image page shows before the first picture: the tile fan, its glow, and two lines of welcome. */
export function ImageHero() {
  const { lineOne, lineTwo, sub } = heroes.image;
  return (
    <div className="flex flex-col items-center gap-[22px] px-4">
      {/* 522 wide as drawn; on a phone the whole fan is scaled down and its empty margin pulled in. */}
      <div className="relative h-[144px] w-[522px] max-sm:-mx-[104px] max-sm:-my-[29px] max-sm:scale-[0.6]">
        <Fan className="absolute top-0 left-0 opacity-40 blur-[32px]" />
        <Fan className="relative" />
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-display text-[26px] leading-[28px] font-bold tracking-[-0.0156em] uppercase sm:text-4xl sm:leading-[36px]">
          <span className="block text-text-primary">{lineOne}</span>
          <span className="block text-brand">{lineTwo}</span>
        </h1>
        <p className="text-sm leading-5 text-text-muted sm:text-base sm:leading-6">{sub}</p>
      </div>
    </div>
  );
}
