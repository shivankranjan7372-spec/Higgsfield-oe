"use client";

import { LoaderCircle } from "lucide-react";
import { Switch as S } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "./cn";

/** The 36 by 20 switch. Off is drawn in the designs; on (lime) is ours. Give it an `aria-label`. */
export function Switch({ className, ...rest }: ComponentProps<typeof S.Root>) {
  return (
    <S.Root
      className={cn(
        "inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-toggle-track px-[2px] transition-colors duration-150 disabled:opacity-40 data-[state=checked]:bg-brand",
        className,
      )}
      {...rest}
    >
      <S.Thumb className="size-4 rounded-full bg-text-primary transition-transform duration-150 data-[state=checked]:translate-x-4 data-[state=checked]:bg-ink" />
    </S.Root>
  );
}

/** A spinning ring for anything that is waiting. */
export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return <LoaderCircle role="status" aria-label={label} className={cn("size-4 animate-spin", className)} strokeWidth={1.5} />;
}
