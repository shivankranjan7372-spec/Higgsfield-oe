"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { common, gate } from "@/content/account";
import { routes } from "@/content/site";
import { LoginDialog } from "@/components/entry/login-dialog";
import { Button, ButtonLink, cn } from "@/ui";

/** The hairline between rows inside a card, as on the account menu's credits card. */
export const ROW_LINE = "border-t border-[#FFFFFF14]";

/** The menu panel look: 95% surface, 8% white hairline, deep shadow. */
export const PANEL = "rounded-3xl border border-[#FFFFFF14] bg-[#1C1E20F2] [box-shadow:#00000066_0px_16px_40px]";

/** Text field on a card. */
export const FIELD =
  "h-10 w-full min-w-0 rounded-lg border border-transparent bg-surface-field px-3 text-sm leading-5 text-text-primary placeholder:text-text-secondary transition-colors duration-150 hover:border-border-default focus:border-border-strong outline-none disabled:opacity-40";

/** One dotted run of the credits meter. */
export function dots(color: string) {
  return `repeating-linear-gradient(90deg, ${color} 0px, ${color} 5px, transparent 5px, transparent 7.7px)`;
}

/** A section card in the style of the credits card: 5% white, radius 16, 12 padding. */
export function Card({
  id,
  title,
  hint,
  aside,
  children,
  className,
  tone,
}: {
  id?: string;
  title: string;
  hint?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "danger";
}) {
  const head = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={head} className={cn("flex min-w-0 scroll-mt-4 flex-col rounded-2xl bg-border-subtle px-3 pt-3 pb-3", className)}>
      <div className="flex min-h-5 shrink-0 items-center gap-[6px]">
        <h2 id={head} className={cn("text-sm leading-5 font-medium", tone === "danger" ? "text-danger" : "text-text-primary")}>
          {title}
        </h2>
        <span className="grow" />
        {aside ?? (hint ? <span className="truncate text-sm leading-5 text-text-secondary">{hint}</span> : null)}
      </div>
      <div className="mt-3 flex min-w-0 flex-col">{children}</div>
    </section>
  );
}

/** A labelled row inside a card: label on the left at 1440, stacked on a phone. */
export function FieldRow({ label, htmlFor, children, help }: { label: string; htmlFor?: string; children: ReactNode; help?: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4", ROW_LINE)}>
      <label htmlFor={htmlFor} className="shrink-0 text-sm leading-5 font-medium text-text-primary sm:w-[160px] sm:pt-[10px]">
        {label}
      </label>
      <div className="flex min-w-0 grow flex-col gap-[6px]">
        {children}
        {help ? <div className="text-xs leading-4 text-text-secondary">{help}</div> : null}
      </div>
    </div>
  );
}

/** The one line under a card's form: green when saved, red with the server's sentence when not. */
export function Status({ ok, error }: { ok?: string | null; error?: string | null }) {
  if (error)
    return (
      <p role="alert" className="flex items-start gap-[6px] text-sm leading-5 text-danger">
        <AlertCircle className="mt-[2px] size-4 shrink-0" strokeWidth={1.5} aria-hidden />
        <span className="min-w-0">{error}</span>
      </p>
    );
  if (ok)
    return (
      <p role="status" className="flex items-start gap-[6px] text-sm leading-5 text-brand">
        <CheckCircle2 className="mt-[2px] size-4 shrink-0" strokeWidth={1.5} aria-hidden />
        <span className="min-w-0">{ok}</span>
      </p>
    );
  return null;
}

/** The small lime pill from the credits card ("Get"). */
export function PillButton({ className, children, ...rest }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-[23px] min-w-[41px] shrink-0 items-center justify-center rounded-full bg-brand px-[10px] text-xs leading-4 font-semibold whitespace-nowrap text-text-inverse transition-colors duration-150 hover:bg-brand-glow disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** A grey block that shimmers while its content loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("shimmer rounded-lg bg-border-subtle", className)} />;
}

export function LoadingCard({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-3 rounded-2xl bg-border-subtle p-3">
      <Skeleton className="h-5 w-32" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

/** A part that failed to load: the server's sentence and a way to try again. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl bg-border-subtle p-3 text-sm leading-5 text-text-secondary">
      <AlertCircle className="size-4 shrink-0 text-danger" strokeWidth={1.5} aria-hidden />
      <span className="min-w-0 grow">
        {common.loadFailed} {message}
      </span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {common.retry}
      </Button>
    </div>
  );
}

/** What a signed-out visitor sees: what the page is for, and the way in. */
export function SignInCard({ title, body, next }: { title: string; body: string; next: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "join">("login");
  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl bg-border-subtle p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base leading-6 font-semibold text-text-primary">{title}</h2>
        <p className="text-sm leading-5 text-text-secondary">{body}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="lime"
          size="md"
          onClick={() => {
            setMode("join");
            setOpen(true);
          }}
        >
          {gate.join}
        </Button>
        <Button
          variant="outline"
          size="md"
          onClick={() => {
            setMode("login");
            setOpen(true);
          }}
        >
          {gate.signIn}
        </Button>
      </div>
      <LoginDialog open={open} onOpenChange={setOpen} mode={mode} next={next} />
    </div>
  );
}

/** A guest's banner: their work is kept for now, an account keeps it for good. */
export function GuestBanner({ next }: { next: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brand-chip bg-brand-tint p-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 grow flex-col">
        <p className="text-sm leading-5 font-medium text-text-primary">{gate.guestTitle}</p>
        <p className="text-sm leading-5 text-text-secondary">{gate.guestBody}</p>
      </div>
      <ButtonLink href={`${routes.join}?next=${encodeURIComponent(next)}`} variant="lime" size="sm">
        {gate.join}
      </ButtonLink>
    </div>
  );
}

/** Dates and times for the account pages, in the member's own locale. */
export function formatDate(ms: number) {
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(ms);
}
export function formatDateTime(ms: number) {
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(ms);
}
export function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
