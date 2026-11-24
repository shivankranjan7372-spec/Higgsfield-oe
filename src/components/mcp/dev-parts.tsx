"use client";

import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Button, Dialog, DialogContent, cn } from "@/ui";
import { CopyButton } from "./copy";

/** Types from docs/api/developer.md. */
export type KeyScope = "read" | "generate";
export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: KeyScope[];
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
}
export interface UsageRow {
  id: number;
  keyId: string;
  method: string;
  route: string;
  status: number;
  credits: number;
  createdAt: number;
  cursor: number;
}
export interface UsageTotals {
  keyId: string;
  requests: number;
  errors: number;
  credits: number;
}
export interface Webhook {
  id: string;
  url: string;
  description: string;
  events: string[];
  enabled: boolean;
  secretHint: string;
  createdAt: number;
}
export interface Delivery {
  id: string;
  webhookId: string;
  event: string;
  generationId: string | null;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  nextAttemptAt: number | null;
  responseStatus: number | null;
  error: string | null;
  createdAt: number;
  deliveredAt: number | null;
}

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const fullFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "medium" });
export function when(ms: number): string {
  return dateFmt.format(new Date(ms));
}
export function whenFull(ms: number): string {
  return fullFmt.format(new Date(ms));
}

export function Panel({ title, blurb, action, children }: { title: string; blurb?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-xl leading-6 font-semibold tracking-[-0.02em] text-text-primary">{title}</h2>
          {blurb ? <p className="text-sm leading-5 text-[#FFFFFF80]">{blurb}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ErrorLine({ message, onRetry, retryLabel = "Try again" }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-[#FF6B6B33] bg-[#FF6B6B14] px-4 py-3">
      <AlertCircle className="size-4 shrink-0 text-danger" strokeWidth={1.5} aria-hidden />
      <p className="min-w-0 flex-1 text-sm leading-5 text-text-primary">{message}</p>
      {onRetry ? (
        <Button variant="soft" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function Skeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div aria-busy="true" aria-label="Loading" className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="shimmer h-[72px] rounded-2xl bg-surface-secondary" />
      ))}
    </div>
  );
}

export function Empty({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border-default p-6">
      <p className="text-sm leading-5 text-[#FFFFFF80]">{text}</p>
      {children}
    </div>
  );
}

export const fieldClass =
  "h-10 w-full min-w-0 rounded-lg border border-border-default bg-surface-field px-3 text-sm leading-5 text-text-primary outline-none placeholder:text-text-tertiary focus-visible:border-brand";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-[6px]">
      <span className="text-xs leading-4 font-medium text-text-nav">{label}</span>
      {children}
      {hint ? <span className="text-xs leading-4 text-text-tertiary">{hint}</span> : null}
    </label>
  );
}

export function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-subtle px-3 py-[10px] transition-colors duration-150 hover:bg-border-subtle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-[2px] size-4 shrink-0 accent-[#D1FE17]" />
      <span className="flex min-w-0 flex-col gap-[2px]">
        <span className="font-mono text-sm leading-5 text-text-primary">{label}</span>
        {hint ? <span className="text-xs leading-4 text-text-secondary">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" | "danger" | "muted" }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full px-2 text-xs leading-4 font-medium",
        tone === "neutral" && "bg-border-subtle text-[#FFFFFFCC]",
        tone === "brand" && "bg-brand-tint text-brand",
        tone === "danger" && "bg-[#FF6B6B1F] text-danger",
        tone === "muted" && "bg-border-subtle text-text-tertiary",
      )}
    >
      {children}
    </span>
  );
}

/** The one-time secret window: big warning, the secret, a copy button. */
export function SecretDialog({
  open,
  onClose,
  title,
  warning,
  secret,
  doneLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  warning: string;
  secret: string;
  doneLabel: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent title={title} className="max-w-[560px]" onInteractOutside={(e) => e.preventDefault()}>
        <div className="flex flex-col gap-4 p-6">
          <div role="note" className="flex items-start gap-3 rounded-xl border border-[#D1FE1733] bg-brand-tint px-4 py-3">
            <AlertCircle className="mt-[2px] size-4 shrink-0 text-brand" strokeWidth={1.5} aria-hidden />
            <p className="text-sm leading-5 text-text-primary">{warning}</p>
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border-default bg-surface-sunken p-2 pl-4">
            <code data-secret className="min-w-0 flex-1 font-mono text-sm leading-5 break-all text-text-primary select-all">
              {secret}
            </code>
            <CopyButton text={secret} tone="lime" label="Copy secret" copiedLabel="Copied" />
          </div>
          <Button variant="white" size="md" onClick={onClose} className="self-end">
            {doneLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "Are you sure?" for revoke, delete and rotate. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirm,
  busy,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  body: string;
  confirm: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} className="max-w-[440px]">
        <div className="flex flex-col gap-4 p-6 pt-3">
          <p className="text-sm leading-5 text-text-nav">{body}</p>
          {error ? <ErrorLine message={error} /> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="md" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-danger px-4 text-sm leading-5 font-semibold text-ink transition-opacity duration-150 hover:opacity-90 disabled:opacity-40"
            >
              {confirm}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
