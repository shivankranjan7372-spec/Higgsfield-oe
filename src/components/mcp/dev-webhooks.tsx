"use client";

import { ChevronDown, Pencil, Plus, RefreshCw, RotateCcw, Send, Trash2, Webhook as HookIcon } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { dev } from "@/content/mcp";
import { api, errorMessage, fetcher } from "@/lib/api";
import { Button, Dialog, DialogContent, Switch, cn } from "@/ui";
import { Check, ConfirmDialog, Empty, ErrorLine, Field, Panel, Pill, SecretDialog, Skeleton, fieldClass, when, whenFull, type Delivery, type Webhook } from "./dev-parts";

const t = dev.hooks;
const URL_ = "/api/developer/webhooks";

interface HooksAnswer {
  webhooks: Webhook[];
  events: string[];
  limit: number;
}

export function WebhooksPanel() {
  const { data, error, isLoading, mutate } = useSWR<HooksAnswer>(URL_, fetcher);
  const [editing, setEditing] = useState<Webhook | "new" | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const full = !!data && data.webhooks.length >= data.limit;

  return (
    <Panel
      title={t.title}
      blurb={t.blurb}
      action={
        <Button variant="lime" size="md" onClick={() => setEditing("new")} disabled={!data || full}>
          <Plus className="size-4" strokeWidth={1.75} aria-hidden />
          {t.create}
        </Button>
      }
    >
      {error ? <ErrorLine message={errorMessage(error)} onRetry={() => mutate()} /> : null}
      {isLoading ? <Skeleton rows={2} /> : null}
      {data && data.webhooks.length === 0 ? (
        <Empty text={t.empty}>
          <Button variant="white" size="sm" onClick={() => setEditing("new")}>
            <HookIcon className="size-4" strokeWidth={1.5} aria-hidden />
            {t.create}
          </Button>
        </Empty>
      ) : null}
      {data?.webhooks.length ? (
        <ul aria-label="Your webhook endpoints" className="flex flex-col gap-2">
          {data.webhooks.map((w) => (
            <HookRow key={w.id} hook={w} onEdit={() => setEditing(w)} onSecret={setSecret} onChanged={() => mutate()} />
          ))}
        </ul>
      ) : null}
      {editing && data ? (
        <HookForm
          existing={editing === "new" ? null : editing}
          events={data.events}
          onClose={() => setEditing(null)}
          onSaved={async (s) => {
            setEditing(null);
            await mutate();
            if (s) setSecret(s);
          }}
        />
      ) : null}
      <SecretDialog open={!!secret} onClose={() => setSecret(null)} title={t.secretTitle} warning={t.secretWarn} secret={secret ?? ""} doneLabel={dev.keys.done} />
    </Panel>
  );
}

function HookRow({ hook, onEdit, onSecret, onChanged }: { hook: Webhook; onEdit: () => void; onSecret: (s: string) => void; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "rotate" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [test, setTest] = useState<Delivery | null>(null);
  const [logKey, setLogKey] = useState(0);

  async function run(what: string, fn: () => Promise<void>) {
    setBusy(what);
    setProblem(null);
    try {
      await fn();
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <li data-hook-id={hook.id} className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-primary p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <code className="min-w-0 truncate font-mono text-sm leading-5 text-text-primary" title={hook.url}>
              {hook.url}
            </code>
            {!hook.enabled ? <Pill tone="muted">Off</Pill> : null}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-4 text-text-secondary">
            {hook.description ? <span className="truncate text-text-nav">{hook.description}</span> : null}
            <span>Secret …{hook.secretHint}</span>
            <span>Added {when(hook.createdAt)}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {hook.events.map((e) => (
              <Pill key={e}>{e}</Pill>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Switch
            checked={hook.enabled}
            aria-label={t.enabled}
            disabled={busy === "toggle"}
            onCheckedChange={(v) => run("toggle", async () => {
              await api(`${URL_}/${hook.id}`, { method: "PATCH", body: { enabled: v } });
              onChanged();
            })}
          />
          <Button
            variant="soft"
            size="sm"
            disabled={busy === "test"}
            onClick={() =>
              run("test", async () => {
                setTest(null);
                const r = await api<{ delivery: Delivery }>(`${URL_}/${hook.id}/test`, { method: "POST" });
                setTest(r.delivery);
                setLogKey((k) => k + 1);
              })
            }
          >
            <Send className="size-4" strokeWidth={1.5} aria-hidden />
            {busy === "test" ? "Sending…" : t.test}
          </Button>
          <Button variant="soft" size="sm" onClick={onEdit} aria-label={`${t.edit} ${hook.url}`}>
            <Pencil className="size-4" strokeWidth={1.5} aria-hidden />
            {t.edit}
          </Button>
          <Button variant="soft" size="sm" onClick={() => setConfirm("rotate")}>
            <RefreshCw className="size-4" strokeWidth={1.5} aria-hidden />
            {t.rotate}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfirm("delete")} aria-label={`${t.delete} ${hook.url}`}>
            <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
            {t.delete}
          </Button>
        </div>
      </div>
      {test ? (
        <p role="status" className={cn("text-sm leading-5", test.status === "delivered" ? "text-brand" : "text-danger")}>
          Test {test.status === "delivered" ? "delivered" : "not delivered yet"}
          {test.responseStatus ? ` · endpoint answered ${test.responseStatus}` : ""}
          {test.error ? ` · ${test.error}` : ""}
        </p>
      ) : null}
      {problem && !confirm ? <ErrorLine message={problem} /> : null}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 self-start rounded-md text-xs leading-4 font-medium text-text-nav transition-colors duration-150 hover:text-text-primary"
      >
        <ChevronDown className={cn("size-4 transition-transform duration-150", open && "rotate-180")} strokeWidth={1.5} aria-hidden />
        {t.deliveries}
      </button>
      {open ? <Deliveries key={logKey} hookId={hook.id} /> : null}
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => {
          if (!o) {
            setConfirm(null);
            setProblem(null);
          }
        }}
        title={confirm === "delete" ? t.deleteTitle : `${t.rotate}?`}
        body={confirm === "delete" ? t.deleteBody : t.rotateBody}
        confirm={confirm === "delete" ? t.delete : t.rotate}
        busy={!!busy}
        error={problem}
        onConfirm={() =>
          run("confirm", async () => {
            if (confirm === "delete") {
              await api(`${URL_}/${hook.id}`, { method: "DELETE" });
            } else {
              const r = await api<{ secret: string }>(`${URL_}/${hook.id}/rotate`, { method: "POST" });
              onSecret(r.secret);
            }
            setConfirm(null);
            onChanged();
          })
        }
      />
    </li>
  );
}

const LOG = 30;

function Deliveries({ hookId }: { hookId: string }) {
  const { data, error, isLoading, size, setSize, mutate } = useSWRInfinite<{ deliveries: Delivery[] }>(
    (index, prev: { deliveries: Delivery[] } | null) => {
      if (prev && prev.deliveries.length < LOG) return null;
      const last = prev?.deliveries.at(-1);
      return `${URL_}/${hookId}/deliveries?limit=${LOG}${index > 0 && last ? `&before=${last.createdAt}` : ""}`;
    },
    fetcher,
  );
  const [problem, setProblem] = useState<string | null>(null);
  const rows = data?.flatMap((p) => p.deliveries) ?? [];
  const more = !!data && (data.at(-1)?.deliveries.length ?? 0) >= LOG;

  async function retry(d: Delivery) {
    setProblem(null);
    try {
      await api(`${URL_}/${hookId}/deliveries/${d.id}/retry`, { method: "POST" });
      await mutate();
    } catch (e) {
      setProblem(errorMessage(e));
    }
  }

  if (error) return <ErrorLine message={errorMessage(error)} onRetry={() => mutate()} />;
  if (isLoading) return <div className="shimmer h-20 rounded-xl bg-surface-secondary" aria-busy="true" />;
  if (!rows.length) return <p className="text-sm leading-5 text-text-secondary">{t.noDeliveries}</p>;
  return (
    <div className="flex flex-col gap-2">
      {problem ? <ErrorLine message={problem} /> : null}
      <ul aria-label={t.deliveries} className="flex flex-col divide-y divide-border-subtle rounded-xl border border-border-subtle">
        {rows.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs leading-4">
            <Pill tone={d.status === "delivered" ? "brand" : d.status === "failed" ? "danger" : "neutral"}>{d.status}</Pill>
            <code className="font-mono text-text-primary">{d.event}</code>
            <span className="text-text-secondary" title={whenFull(d.createdAt)}>
              {when(d.createdAt)}
            </span>
            <span className="text-text-secondary">
              {d.attempts} attempt{d.attempts === 1 ? "" : "s"}
              {d.responseStatus ? ` · ${d.responseStatus}` : ""}
            </span>
            {d.error ? <span className="min-w-0 flex-1 truncate text-danger">{d.error}</span> : <span className="flex-1" />}
            {d.status !== "pending" ? (
              <Button variant="soft" size="xs" onClick={() => retry(d)} aria-label={`${t.retry} ${d.event}`}>
                <RotateCcw className="mr-1 size-3.5" strokeWidth={1.5} aria-hidden />
                {t.retry}
              </Button>
            ) : d.nextAttemptAt ? (
              <span className="text-text-tertiary">next try {when(d.nextAttemptAt)}</span>
            ) : null}
          </li>
        ))}
      </ul>
      {more ? (
        <Button variant="soft" size="sm" className="self-start" onClick={() => setSize(size + 1)}>
          {t.more}
        </Button>
      ) : null}
    </div>
  );
}

function HookForm({ existing, events, onClose, onSaved }: { existing: Webhook | null; events: string[]; onClose: () => void; onSaved: (s: string | null) => void }) {
  const [url, setUrl] = useState(existing?.url ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [chosen, setChosen] = useState<string[]>(existing?.events ?? events);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!chosen.length) {
      setProblem("Pick at least one event.");
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const body = { url: url.trim(), description: description.trim(), events: chosen };
      if (existing) {
        await api(`${URL_}/${existing.id}`, { method: "PATCH", body });
        onSaved(null);
      } else {
        const r = await api<{ secret: string }>(URL_, { method: "POST", body });
        onSaved(r.secret);
      }
    } catch (e) {
      setProblem(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent title={existing ? `${t.edit} endpoint` : t.create} className="max-w-[520px]">
        <form onSubmit={submit} className="flex flex-col gap-4 p-6 pt-4">
          <Field label={t.url} hint="https on the public internet.">
            <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t.urlPlaceholder} className={fieldClass} autoFocus />
          </Field>
          <Field label={t.description}>
            <input value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder="Production" className={fieldClass} />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-[6px] text-xs leading-4 font-medium text-text-nav">{t.events}</legend>
            {events.map((ev) => (
              <Check
                key={ev}
                label={ev}
                checked={chosen.includes(ev)}
                onChange={(v) => setChosen((c) => (v ? [...new Set([...c, ev])] : c.filter((x) => x !== ev)))}
              />
            ))}
          </fieldset>
          {problem ? <ErrorLine message={problem} /> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="md" onClick={onClose}>
              {dev.keys.cancel}
            </Button>
            <Button type="submit" variant="lime" size="md" disabled={busy}>
              {existing ? dev.keys.save : t.create}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
