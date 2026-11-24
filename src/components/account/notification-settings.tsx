"use client";

import { Lock } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { notifyCopy, gate } from "@/content/account";
import { routes } from "@/content/site";
import { api, errorMessage, fetcher } from "@/lib/api";
import { useSession } from "@/lib/session";
import { ButtonLink, Switch, cn } from "@/ui";
import { AccountFrame } from "./frame";
import { Card, LoadError, LoadingCard, ROW_LINE, SignInCard, Status } from "./parts";

interface Preference {
  kind: string;
  label: string;
  group: string;
  canMute: boolean;
  enabled: boolean;
}

const KEY = "/api/notifications/preferences";
const GROUPS = ["activity", "account", "social", "news"];

function Group({ group, items, onFlip, busy, outcome }: { group: string; items: Preference[]; onFlip: (p: Preference, on: boolean) => void; busy: string | null; outcome: { kind: string; ok?: string; error?: string } | null }) {
  return (
    <Card id={`group-${group}`} title={notifyCopy.groups[group] ?? group}>
      <ul className="flex flex-col">
        {items.map((p) => (
          <li key={p.kind} className={cn("flex flex-col py-[10px]", ROW_LINE)}>
            <div className="flex min-h-5 items-center gap-[10px]">
              <label htmlFor={`notice-${p.kind}`} className="min-w-0 grow text-sm leading-5 font-medium text-text-primary">
                {p.label}
              </label>
              {p.canMute ? null : (
                <span className="flex items-center gap-1 text-xs leading-4 text-text-secondary">
                  <Lock className="size-3" strokeWidth={1.5} aria-hidden />
                  {notifyCopy.locked}
                </span>
              )}
              <Switch
                id={`notice-${p.kind}`}
                checked={p.enabled}
                disabled={!p.canMute || busy === p.kind}
                onCheckedChange={(on) => onFlip(p, on)}
                aria-label={p.label}
              />
            </div>
            {outcome?.kind === p.kind ? (
              <div className="pt-2">
                <Status ok={outcome.ok} error={outcome.error} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function NotificationSettings() {
  const { user, loading } = useSession();
  const { data, error, isLoading, mutate } = useSWR<{ preferences: Preference[] }>(user ? KEY : null, fetcher);
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ kind: string; ok?: string; error?: string } | null>(null);

  const flip = async (p: Preference, on: boolean) => {
    setBusy(p.kind);
    setOutcome(null);
    const before = data;
    mutate({ preferences: (data?.preferences ?? []).map((x) => (x.kind === p.kind ? { ...x, enabled: on } : x)) }, { revalidate: false });
    try {
      const r = await api<{ preferences: Preference[] }>(KEY, { method: "PUT", body: { kinds: { [p.kind]: on } } });
      mutate(r, { revalidate: false });
      setOutcome({ kind: p.kind, ok: on ? notifyCopy.savedOn(p.label) : notifyCopy.savedOff(p.label) });
    } catch (e) {
      mutate(before, { revalidate: false });
      setOutcome({ kind: p.kind, error: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  let body;
  if (loading || (user && isLoading)) body = <LoadingCard rows={4} />;
  else if (!user) body = <SignInCard {...gate.signedOut.notifications} next={`${routes.settings}/notifications`} />;
  else if (error || !data) body = <LoadError message={errorMessage(error)} onRetry={() => mutate()} />;
  else {
    const groups = [...GROUPS, ...new Set(data.preferences.map((p) => p.group).filter((g) => !GROUPS.includes(g)))];
    body = groups.map((g) => {
      const items = data.preferences.filter((p) => p.group === g);
      return items.length ? <Group key={g} group={g} items={items} onFlip={flip} busy={busy} outcome={outcome} /> : null;
    });
  }

  return (
    <AccountFrame
      page="notifications"
      title={notifyCopy.title}
      lead={
        <div className="flex flex-wrap items-center gap-3">
          <span className="min-w-0 grow">{notifyCopy.hint}</span>
          {user ? (
            <ButtonLink href={routes.notifications} variant="outline" size="xs">
              {notifyCopy.inbox}
            </ButtonLink>
          ) : null}
        </div>
      }
    >
      {body}
    </AccountFrame>
  );
}
