"use client";

import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "./cn";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

/**
 * A centred modal over the dark scrim. Always give it a `title`; pass `hideTitle` when the
 * design shows its own heading, so screen readers still get one.
 */
export function DialogContent({
  title,
  hideTitle,
  closeButton = true,
  className,
  children,
  ...rest
}: { title: string; hideTitle?: boolean; closeButton?: boolean } & ComponentProps<typeof D.Content>) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 animate-fade-in bg-scrim" />
      <D.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 animate-fade-in overflow-y-auto rounded-3xl bg-surface-secondary text-text-primary shadow-menu outline-none scroll-quiet",
          className,
        )}
        {...rest}
      >
        <D.Title className={hideTitle ? "sr-only" : "px-6 pt-6 text-xl leading-7 font-semibold"}>{title}</D.Title>
        {children}
        {closeButton ? (
          <D.Close
            aria-label="Close"
            className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-full bg-border-subtle text-text-secondary transition-colors duration-150 hover:bg-border-default hover:text-text-primary"
          >
            <X className="size-4" strokeWidth={1.5} aria-hidden />
          </D.Close>
        ) : null}
      </D.Content>
    </D.Portal>
  );
}
