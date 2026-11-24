"use client";

import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { dev } from "@/content/mcp";
import { api, errorMessage, fetcher } from "@/lib/api";
import { Button, Dialog, DialogContent, cn } from "@/ui";
import { Check, ConfirmDialog, Empty, ErrorLine, Field, Panel, Pill, SecretDialog, Skeleton, fieldClass, when, whenFull, type ApiKey, type KeyScope } from "./dev-parts";

export const KEYS_URL = "/api/developer/keys";
export interface KeysAnswer {
  keys: ApiKey[];
  limit: number;
  scopes: KeyScope[];
}

const t = dev.keys;

export function KeysPanel() {
  const { data, error, isLoading, mutate } = useSWR<KeysAnswer>(KEYS_URL, fetcher);
  const [editing, setEditing] = useState<ApiKey | "new" | null>(null);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const active = data?.keys.filter((k) => !k.revokedAt).length ?? 0;
  const full = !!data && active >= data.limit;

  async function revoke() {
    if (!revoking) return;
    setBusy(true);
    setProblem(null);
    try {
      await api(`${KEYS_URL}/${revoking.id}`, { method: "DELETE" });
      await mutate();
      setRevoking(null);
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title={t.title}
      blurb={data ? `${t.blurb} ${t.of(active, data.limit)}.` : t.blurb}
      action={
        <Button variant="lime" size="md" onClick={() => setEditing("new")} disabled={!data || full} title={full ? "Revoke a key to make room." : undefined}>
          <Plus className="size-4" strokeWidth={1.75} aria-hidden />
          {t.create}
        </Button>
      }
    >
      {error ? <ErrorLine message={errorMessage(error)} onRetry={() => mutate()} /> : null}
      {isLoading ? <Skeleton /> : null}
      {data && data.keys.length === 0 ? (
        <Empty text={t.empty}>
          <Button variant="white" size="sm" onClick={() => setEditing("new")}>
            <KeyRound className="size-4" strokeWidth={1.5} aria-hidden />
            {t.create}
          </Button>
        </Empty>
      ) : null}
      {data && data.keys.length ? (
        <ul aria-label="Your API keys" className="flex flex-col gap-2">
          {data.keys.map((k) => (
            <li
              key={k.id}
              data-key-id={k.id}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-primary p-4 transition-colors duration-150 md:flex-row md:items-center",
                k.revokedAt ? "opacity-60" : "hover:bg-surface-secondary",
              )}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="truncate text-base leading-6 font-semibold text-text-primary">{k.name}</span>
                  {k.revokedAt ? <Pill tone="danger">{t.revoked}</Pill> : null}
                  {k.scopes.map((s) => (
                    <Pill key={s} tone={s === "generate" ? "brand" : "neutral"}>
                      {s}
                    </Pill>
                  ))}
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs leading-4 text-text-secondary">
                  <code className="font-mono text-text-nav">{k.prefix}…</code>
                  <span title={whenFull(k.createdAt)}>
                    {t.created} {when(k.createdAt)}
                  </span>
                  <span>{k.lastUsedAt ? `${t.lastUsed} ${when(k.lastUsedAt)}` : t.neverUsed}</span>
                  {k.revokedAt ? <span>{`${t.revoked} ${when(k.revokedAt)}`}</span> : null}
                </div>
              </div>
              {!k.revokedAt ? (
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="soft" size="sm" onClick={() => setEditing(k)} aria-label={`${t.rename} ${k.name}`}>
                    <Pencil className="size-4" strokeWidth={1.5} aria-hidden />
                    {t.rename}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setProblem(null);
                      setRevoking(k);
                    }}
                    aria-label={`${t.revoke} ${k.name}`}
                  >
                    <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
                    {t.revoke}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {editing ? (
        <KeyForm
          key={editing === "new" ? "new" : editing.id}
          existing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (s) => {
            setEditing(null);
            await mutate();
            if (s) setSecret(s);
          }}
        />
      ) : null}
      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => (!o ? setRevoking(null) : null)}
        title={t.revokeTitle}
        body={`${revoking?.name ?? ""}: ${t.revokeBody}`}
        confirm={t.revoke}
        busy={busy}
        error={problem}
        onConfirm={revoke}
      />
      <SecretDialog open={!!secret} onClose={() => setSecret(null)} title={t.secretTitle} warning={t.secretWarn} secret={secret ?? ""} doneLabel={t.done} />
    </Panel>
  );
}

function KeyForm({ existing, onClose, onSaved }: { existing: ApiKey | null; onClose: () => void; onSaved: (secret: string | null) => void }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [scopes, setScopes] = useState<KeyScope[]>(existing?.scopes ?? ["read", "generate"]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function toggle(s: KeyScope, on: boolean) {
    setScopes((cur) => (on ? [...new Set([...cur, s])] : cur.filter((x) => x !== s)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!scopes.length) {
      setProblem("Pick at least one scope.");
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const body = { name: name.trim() || undefined, scopes };
      if (existing) {
        await api(`${KEYS_URL}/${existing.id}`, { method: "PATCH", body });
        onSaved(null);
      } else {
        const r = await api<{ key: ApiKey; secret: string }>(KEYS_URL, { method: "POST", body });
        onSaved(r.secret);
      }
    } catch (e) {
      setProblem(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent title={existing ? `${t.rename} key` : t.create} className="max-w-[480px]">
        <form onSubmit={submit} className="flex flex-col gap-4 p-6 pt-4">
          <Field label={t.name}>
            <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} className={fieldClass} autoFocus />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-[6px] text-xs leading-4 font-medium text-text-nav">{t.scopes}</legend>
            {(["read", "generate"] as const).map((s) => (
              <Check key={s} label={s} hint={t.scopeHelp[s]} checked={scopes.includes(s)} onChange={(v) => toggle(s, v)} />
            ))}
          </fieldset>
          {problem ? <ErrorLine message={problem} /> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="md" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit" variant="lime" size="md" disabled={busy}>
              {existing ? t.save : t.create}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
