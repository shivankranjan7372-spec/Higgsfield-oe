"use client";

import { Check } from "lucide-react";
import { Popover as P } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export const PopoverClose = P.Close;

/**
 * The two floating panels the designs draw.
 *  - `glass`: the small option menu (aspect ratio, quality). 12px corners, blurred grey glass.
 *  - `panel`: the large picker (models, search). 16px corners, near-black glass.
 */
const looks = {
  glass:
    "rounded-xl bg-surface-glass p-2 [box-shadow:#FFFFFF0D_0px_0px_0px_1px,#0000004C_0px_20px_25px_-5px,#0000004C_0px_8px_10px_-6px] backdrop-blur-[40px]",
  panel: "rounded-2xl border border-[#D9D9D90A] bg-[#1C1E20F2] shadow-menu backdrop-blur-[32px]",
} as const;

export function PopoverContent({
  look = "glass",
  className,
  sideOffset = 8,
  align = "start",
  collisionPadding = 8,
  ...rest
}: { look?: keyof typeof looks } & ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={collisionPadding}
        className={cn("z-50 animate-rise-in overflow-clip text-text-primary outline-none", looks[look], className)}
        {...rest}
      />
    </P.Portal>
  );
}

/** The small grey heading at the top of an option menu. */
export function MenuLabel({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cn("flex h-8 items-center px-2 text-xs leading-4 font-medium text-text-tab", className)} {...rest} />;
}

/** One 36px row in an option menu. The chosen row is lit and carries a check. */
export function MenuItem({
  icon,
  selected,
  hint,
  className,
  children,
  type = "button",
  ...rest
}: { icon?: ReactNode; selected?: boolean; hint?: ReactNode } & ComponentProps<"button">) {
  return (
    <button
      type={type}
      role="menuitemradio"
      aria-checked={selected}
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm leading-5 font-medium text-text-primary transition-colors duration-150 hover:bg-border-subtle disabled:pointer-events-none disabled:opacity-40",
        selected && "bg-border-subtle",
        className,
      )}
      {...rest}
    >
      {icon ? <span className="flex size-5 shrink-0 items-center justify-center">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint ? <span className="shrink-0 text-xs leading-4 font-normal text-text-secondary">{hint}</span> : null}
      {selected ? <Check className="size-4 shrink-0" strokeWidth={1.5} aria-hidden /> : null}
    </button>
  );
}
