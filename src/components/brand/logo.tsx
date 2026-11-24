import { brand } from "@/config/brand";
import { cn } from "@/ui";

/**
 * The Parallax mark: two slanted bars, the near one solid and the far one faint, on a white
 * tile. It is our own drawing. `size` is the tile's side in pixels (20 in the nav, 18 inline).
 */
export function LogoMark({ size = 20, className, title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn("shrink-0", className)}
    >
      <rect width="20" height="20" rx="6" fill="#FFFFFF" />
      <path d="M4.5 14.5 8.4 5.5h3.1l-3.9 9z" fill="#131517" />
      <path d="M10.4 14.5l3.9-9h1.9l-3.9 9z" fill="#131517" fillOpacity="0.45" />
    </svg>
  );
}

/** The mark with the name beside it, for footers and dialogs. */
export function Logo({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={size} />
      <span className="font-display text-base leading-5 font-bold tracking-[-0.01em] text-text-primary">{brand.name}</span>
    </span>
  );
}

/** A model maker's badge: the first letter of the maker's name. We ship no third-party logos. */
export function VendorGlyph({ vendor, className }: { vendor: string; className?: string }) {
  return (
    <span aria-hidden className={cn("font-display text-xs leading-4 font-bold text-text-primary uppercase", className)}>
      {vendor.trim().charAt(0) || "·"}
    </span>
  );
}
