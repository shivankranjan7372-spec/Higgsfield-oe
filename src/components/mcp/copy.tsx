"use client";

import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/ui";

/** Writes text to the clipboard, falling back to a hidden textarea where the API is missing. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the old way */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Copy state for one control: "idle", "copied" for two seconds, or "failed". */
export function useCopy() {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  const copy = useCallback(async (text: string) => {
    const ok = await copyText(text);
    setState(ok ? "copied" : "failed");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2000);
    return ok;
  }, []);
  return { state, copy };
}

/** A small "Copy" button for a code block or a secret. */
export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
  className,
  tone = "soft",
  name,
}: {
  /** What is copied, for screen readers ("Copy server address"). Defaults to `label`. */
  name?: string;
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  tone?: "soft" | "lime";
}) {
  const { state, copy } = useCopy();
  return (
    <button
      type="button"
      onClick={() => copy(text)}
      aria-label={state === "copied" ? copiedLabel : (name ?? label)}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-[6px] rounded-md px-3 text-xs leading-4 font-medium transition-colors duration-150",
        tone === "lime"
          ? "bg-brand text-text-inverse hover:bg-brand-glow"
          : "bg-border-default text-text-primary hover:bg-border-strong",
        className,
      )}
    >
      {state === "copied" ? <Check className="size-4" strokeWidth={1.5} aria-hidden /> : <Copy className="size-4" strokeWidth={1.5} aria-hidden />}
      <span aria-live="polite">{state === "copied" ? copiedLabel : state === "failed" ? "Copy failed" : label}</span>
    </button>
  );
}

/** A dark block of code with its name and a copy button above it. */
export function CodeBlock({ code, label, className }: { code: string; label: string; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col rounded-xl border border-border-subtle bg-surface-sunken", className)}>
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border-subtle py-1 pr-1 pl-4">
        <span className="min-w-0 truncate text-xs leading-4 font-medium text-text-secondary">{label}</span>
        <CopyButton text={code} name={`Copy ${label}`} />
      </div>
      <pre aria-label={label} tabIndex={0} className="scroll-quiet overflow-x-auto p-4 font-mono text-xs leading-5 whitespace-pre text-text-soft">
        <code>{code}</code>
      </pre>
    </div>
  );
}
