"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/ui";

/** The lit glass pill the design draws under the chosen segment. */
export const glass =
  "rounded-md border border-border-subtle bg-[#23262ABF] bg-[linear-gradient(149deg,#FFFFFF0A_22.61%,#FFFFFF0F_51.26%,#FFFFFF05_79.91%)] bg-origin-border [box-shadow:#FFFFFF0D_0px_2px_3px_inset,#0000001F_0px_2px_2px]";

/**
 * A row of two or three choices with one lit. `wide` is the boxed, full-width version from the
 * form; without it the segments size to their words, as in the gallery header.
 */
export function Segmented({
  label,
  items,
  value,
  onChange,
  wide,
}: {
  label: string;
  items: { value: string; label: string; icon: LucideIcon }[];
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "flex items-center gap-1",
        wide &&
          "h-10 w-full overflow-clip rounded-xl border border-border-default bg-border-subtle p-[3px]",
      )}
    >
      {items.map((item) => {
        const on = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(item.value)}
            className={cn(
              "flex h-8 items-center justify-center gap-1 rounded-md border text-xs leading-4 font-medium transition-colors duration-150",
              wide ? "min-w-0 flex-1 px-2" : "px-2",
              on
                ? cn(glass, "text-text-primary")
                : "border-transparent text-text-tab hover:text-text-primary",
            )}
          >
            <item.icon
              className="size-4 shrink-0"
              strokeWidth={1.5}
              aria-hidden
            />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
