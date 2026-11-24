"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LogoMark } from "@/components/brand/logo";
import { LoginDialog } from "@/components/entry/login-dialog";
import { dev } from "@/content/mcp";
import { routes } from "@/content/site";
import { useQueryParam } from "@/lib/browser";
import { useSession } from "@/lib/session";
import { Button, ButtonLink, cn } from "@/ui";
import { KeysPanel } from "./dev-keys";
import { ReferencePanel } from "./dev-reference";
import { UsagePanel } from "./dev-usage";
import { WebhooksPanel } from "./dev-webhooks";

type Tab = (typeof dev.tabs)[number]["id"];
const isTab = (v: string | null): v is Tab => dev.tabs.some((t) => t.id === v);

/** The developer console: keys, usage, webhooks and the REST reference. */
export function DeveloperConsole() {
  const fromUrl = useQueryParam("tab");
  const [picked, setPicked] = useState<Tab | null>(null);
  const tab: Tab = picked ?? (isTab(fromUrl) ? fromUrl : "keys");
  const { member, user, loading } = useSession();

  function pick(id: Tab) {
    setPicked(id);
    const u = new URL(window.location.href);
    u.searchParams.set("tab", id);
    window.history.replaceState(null, "", u);
  }

  return (
    <div className="flex w-full justify-center px-4 pt-8 pb-20 md:px-10">
      <div className="flex w-full max-w-[1360px] min-w-0 flex-col gap-7">
        <header className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-[28px] leading-[34px] font-bold tracking-[-0.04em] text-text-primary uppercase md:text-4xl md:leading-[44px]">
              {dev.title}
            </h1>
            <p className="text-sm leading-5 text-[#FFFFFF80]">
              {dev.intro}{" "}
              <Link href={routes.mcp} className="text-text-primary underline-offset-2 hover:underline">
                Connect an agent
              </Link>
            </p>
          </div>
          <div role="tablist" aria-label="Console sections" className="scroll-none flex h-8 items-center gap-2 overflow-x-auto">
            {dev.tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls="console-panel"
                onClick={() => pick(t.id)}
                className={cn(
                  "flex h-8 shrink-0 items-center justify-center rounded-md px-3 text-sm leading-4 font-medium transition-colors duration-150",
                  tab === t.id ? "bg-border-default text-text-primary" : "text-text-tab hover:bg-border-subtle hover:text-text-primary",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>
        <div id="console-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="min-w-0">
          {tab === "reference" ? (
            <ReferencePanel />
          ) : loading ? (
            <div aria-busy="true" className="flex flex-col gap-2">
              <div className="shimmer h-10 w-64 rounded-lg bg-surface-secondary" />
              <div className="shimmer h-[72px] rounded-2xl bg-surface-secondary" />
              <div className="shimmer h-[72px] rounded-2xl bg-surface-secondary" />
            </div>
          ) : !member ? (
            <SignedOut guest={!!user} />
          ) : tab === "keys" ? (
            <KeysPanel />
          ) : tab === "usage" ? (
            <UsagePanel />
          ) : (
            <WebhooksPanel />
          )}
        </div>
      </div>
    </div>
  );
}

function SignedOut({ guest }: { guest: boolean }) {
  const [open, setOpen] = useState(false);
  const s = dev.signedOut;
  return (
    <section aria-label={s.title} className="flex flex-col gap-6 rounded-3xl border border-border-subtle bg-surface-primary p-6 md:flex-row md:items-center md:p-10">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <LogoMark size={36} />
        <h2 className="text-2xl leading-8 font-semibold tracking-[-0.02em] text-text-primary">{s.title}</h2>
        <p className="max-w-[560px] text-sm leading-5 text-text-nav">{guest ? s.guest : s.body}</p>
        <ul className="flex flex-col gap-2">
          {s.points.map((p) => (
            <li key={p} className="flex items-center gap-2 text-sm leading-5 text-text-primary">
              <Check className="size-4 shrink-0 text-brand" strokeWidth={1.75} aria-hidden />
              {p}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="lime" size="md" onClick={() => setOpen(true)}>
            {s.cta}
          </Button>
          <ButtonLink href={`${routes.login}?next=${encodeURIComponent(routes.developer)}`} variant="outline" size="md">
            {s.login}
          </ButtonLink>
        </div>
      </div>
      <LoginDialog open={open} onOpenChange={setOpen} mode="join" next={routes.developer} />
    </section>
  );
}
