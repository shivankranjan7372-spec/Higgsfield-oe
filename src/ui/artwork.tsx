import { media } from "@/content/media";
import { cn } from "./cn";

/** A steady number from a name, so a slot looks the same on the server, in the browser and tomorrow. */
function hash(name: string) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * A picture slot. Use it wherever the design shows a decorative or sample picture: a hero,
 * a card cover, a preset tile, a banner.
 *
 *   <Artwork name="home/hero-1" className="aspect-video w-full rounded-2xl" />
 *
 * Name the slot `<your feature>/<what it is>`. If src/content/media.ts has a picture for
 * that name it is shown, cropped to fill the box. If not, the slot is a soft dark gradient
 * picked from the name, so every slot is different and none is empty. Pictures are added
 * to media.ts later, by name; your page does not change.
 *
 * It has no size of its own: give it one with `className` (a width and an aspect ratio, or
 * `size-full` inside a sized box). Leave `alt` out when the picture is decoration. This is
 * not for a member's own files; those come from the API and are drawn with a plain <img>.
 */
export function Artwork({ name, alt = "", className }: { name: string; alt?: string; className?: string }) {
  const src = media[name];
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} loading="lazy" decoding="async" data-artwork={name} className={cn("object-cover", className)} />;
  }
  const h = hash(name);
  const hue = h % 360;
  const x = 15 + ((h >>> 9) % 70);
  const y = 10 + ((h >>> 17) % 60);
  return (
    <div
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      data-artwork={name}
      className={className}
      style={{
        backgroundColor: "#1C1E21",
        backgroundImage: [
          `radial-gradient(120% 90% at ${x}% ${y}%, hsl(${hue} 46% 34% / 0.55), transparent 62%)`,
          `linear-gradient(140deg, hsl(${(hue + 40) % 360} 34% 18%), hsl(${(hue + 300) % 360} 30% 9%))`,
        ].join(", "),
      }}
    />
  );
}
