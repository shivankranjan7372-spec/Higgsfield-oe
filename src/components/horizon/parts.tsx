import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/ui";

/** The soft white-to-grey fill on every display headline on this page. */
export const headlineFill: CSSProperties = {
  backgroundImage: "linear-gradient(180deg, #FFFFFF 0%, #FFFFFFB2 156.25%)",
};

/** The hero headline fades a little further. */
export const heroFill: CSSProperties = {
  backgroundImage: "linear-gradient(180deg, #FFFFFF 20%, #FFFFFF80 100%)",
};

/** The faint glow behind every second "closer look" row. */
export const rowGlow: CSSProperties = {
  backgroundImage:
    "radial-gradient(circle farthest-corner at 50% 50%, #FFFFFF0A 0%, #00000000 100%), radial-gradient(circle farthest-corner at 50% 100%, #FFFFFF0A 0%, #00000000 100%)",
};

/** Big uppercase display line (40/48 at 1440). */
export function Display({ lines, as: Tag = "h2", className }: { lines: readonly string[]; as?: "h1" | "h2" | "h3"; className?: string }) {
  return (
    <Tag className={cn("flex flex-col font-display font-bold tracking-[-0.04em] uppercase", className)}>
      {lines.map((line) => (
        <span key={line} className="bg-clip-text text-transparent" style={headlineFill}>
          {line}
        </span>
      ))}
    </Tag>
  );
}

/** A small rounded pill row, as drawn for tabs on pictures. */
export function PillRow({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex items-center rounded-full", className)}>
      {children}
    </div>
  );
}

/** Arrow keys move between the buttons of a tablist and pick the one they land on. */
export function onTabKeys(e: React.KeyboardEvent<HTMLElement>, index: number, count: number, pick: (i: number) => void) {
  let next = -1;
  if (e.key === "ArrowRight") next = (index + 1) % count;
  else if (e.key === "ArrowLeft") next = (index - 1 + count) % count;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = count - 1;
  if (next < 0) return;
  e.preventDefault();
  pick(next);
  const list = e.currentTarget.parentElement;
  const target = list?.querySelectorAll<HTMLElement>('[role="tab"]')[next];
  target?.focus();
}
