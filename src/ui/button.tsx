import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./cn";

const base =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap select-none transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40";

/** The button looks the designs draw. Hover and pressed states are ours: one step lighter or darker. */
const variants = {
  /** The lime call to action ("Get started"). */
  lime: "bg-brand text-text-inverse hover:bg-brand-glow active:bg-brand-pressed",
  /** Lime text on a lime wash ("Login"). */
  tint: "bg-brand-tint text-brand shadow-inset-soft hover:bg-brand-chip",
  /** The white pill ("Learn now", the banner button). */
  white: "bg-text-primary text-text-inverse shadow-pill hover:bg-text-soft",
  /** A hairline box ("View", "Filter"). */
  outline: "border border-border-default text-text-primary hover:bg-border-subtle",
  /** The quiet grey used by chips and menu rows. */
  soft: "bg-border-subtle text-text-primary hover:bg-border-default",
  ghost: "text-text-primary hover:bg-border-subtle",
} as const;

const sizes = {
  /** 24 high: the nav buttons. */
  xs: "h-6 rounded-md px-[10px] text-sm leading-5 font-semibold",
  /** 32 high: toolbar buttons and chips. */
  sm: "h-8 gap-1 rounded-md px-3 text-sm leading-4 font-medium",
  /** 38 high pill. */
  pill: "h-[38px] rounded-full px-[13px] text-xs leading-4 font-semibold",
  /** 24 high pill: the banner button. */
  "pill-xs": "h-6 rounded-full px-3 text-xs leading-4 font-semibold",
  /** 40 high: forms and dialogs. */
  md: "h-10 gap-2 rounded-lg px-4 text-sm leading-5 font-semibold",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export function buttonClass(variant: ButtonVariant = "soft", size: ButtonSize = "sm", className?: string): string {
  return cn(base, variants[variant], sizes[size], className);
}

interface Look {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant, size, className, type = "button", ...rest }: Look & ComponentProps<"button">) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}

/** The same looks on a link. */
export function ButtonLink({ variant, size, className, ...rest }: Look & ComponentProps<typeof Link>) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}
