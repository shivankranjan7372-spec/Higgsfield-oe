import type { ComponentProps } from "react";
import { cn } from "./cn";

/**
 * The 32px grey chip in every composer: an icon, a value, and usually a menu behind it.
 * It stays lit while its menu is open.
 */
export function Chip({ className, type = "button", ...rest }: ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-md bg-border-subtle px-3 text-sm leading-4 font-medium whitespace-nowrap text-text-primary transition-colors duration-150 hover:bg-border-default disabled:pointer-events-none disabled:opacity-40 data-[state=open]:bg-border-default",
        className,
      )}
      {...rest}
    />
  );
}

/** The 16px label that sits beside a nav link or a model name. */
export function Tag({ tone = "brand", className, ...rest }: { tone?: "brand" | "neutral" | "solid" } & ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex h-4 shrink-0 items-center whitespace-nowrap",
        tone === "brand" && "rounded-sm bg-brand-chip px-[6px] text-2xs leading-3 font-medium text-brand",
        tone === "neutral" && "rounded-sm bg-surface-secondary-strong px-[6px] text-2xs leading-3 font-medium text-text-muted",
        tone === "solid" && "rounded-xs bg-brand px-[5px] font-display text-2xs leading-4 font-bold text-ink uppercase",
        className,
      )}
      {...rest}
    />
  );
}

const iconSizes = { 24: "size-6 rounded-lg", 28: "size-7 rounded-md", 32: "size-8 rounded-md", 38: "size-[38px] rounded-full" } as const;

const iconTones = {
  /** White icon, no plate. */
  plain: "text-text-primary hover:bg-border-subtle",
  /** White icon on the grey plate. */
  soft: "bg-border-subtle text-text-primary hover:bg-border-default",
  /** The dim icons at the right of the nav. */
  dim: "text-text-idle hover:bg-border-subtle hover:text-text-tab",
  /** A lime icon, no plate. */
  lime: "text-brand hover:bg-border-subtle",
  /** The grey close circle on hint pills. */
  quiet: "bg-border-subtle text-text-secondary hover:bg-border-default hover:text-text-primary",
} as const;

/** How an icon button looks. Use it on a link that should look like one. */
export function iconButtonClass(size: keyof typeof iconSizes = 24, tone: keyof typeof iconTones = "plain", className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40",
    iconSizes[size],
    iconTones[tone],
    className,
  );
}

/** A square button that holds one icon. Always pass `aria-label`. */
export function IconButton({
  size = 24,
  tone = "plain",
  className,
  type = "button",
  ...rest
}: { size?: keyof typeof iconSizes; tone?: keyof typeof iconTones } & ComponentProps<"button">) {
  return <button type={type} className={iconButtonClass(size, tone, className)} {...rest} />;
}
