/* eslint-disable @next/next/no-img-element */
import { Film } from "lucide-react";
import type { Take } from "./data";

/**
 * A finished take's file. A still is an <img>; a video shows its poster, or plays when
 * `still` is false. A video with no poster falls back to the paused video element.
 */
export function TakeMedia({ take, still, className }: { take: Take; still?: boolean; className?: string }) {
  const a = take.asset;
  if (!a) return null;
  if (a.kind === "image") return <img src={a.url} alt={take.prompt} loading="lazy" className={className} />;
  if (still && a.posterUrl) return <img src={a.posterUrl} alt={take.prompt} loading="lazy" className={className} />;
  if (!a.url) return <Film className="size-6 text-text-secondary" strokeWidth={1.5} aria-hidden />;
  return (
    <video
      src={a.url}
      poster={a.posterUrl ?? undefined}
      muted
      loop
      playsInline
      controls={!still}
      preload="metadata"
      aria-label={take.prompt}
      className={className}
    />
  );
}
