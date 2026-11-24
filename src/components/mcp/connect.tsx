"use client";

import { Code2, FileJson, KeyRound, Plug, SquareTerminal, type LucideIcon } from "lucide-react";
import { clients, connect, snippetFor, type ClientId } from "@/content/mcp";
import { routes } from "@/content/site";
import { useLive } from "@/lib/browser";
import { useSession } from "@/lib/session";
import { ButtonLink, cn } from "@/ui";
import { CodeBlock, CopyButton } from "./copy";

export const clientIcons: Record<ClientId, LucideIcon> = {
  config: FileJson,
  terminal: SquareTerminal,
  python: Code2,
  other: Plug,
};

/** The server address, built from the page's own origin once the page is live. */
export function useServerUrl(): string {
  const live = useLive();
  return live ? `${window.location.origin}/api/mcp` : "/api/mcp";
}

/** The small segmented picker used inside the connect panel and dialog. */
export function ClientPicker({ value, onChange }: { value: ClientId; onChange: (id: ClientId) => void }) {
  return (
    <div role="radiogroup" aria-label="Client" className="scroll-none flex max-w-full items-center gap-2 overflow-x-auto">
      {clients.map((c) => {
        const Icon = clientIcons[c.id];
        const on = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(c.id)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-[6px] rounded-md px-3 text-sm leading-4 font-medium transition-colors duration-150",
              on ? "bg-border-default text-text-primary" : "text-text-secondary hover:bg-border-subtle hover:text-text-primary",
            )}
          >
            <Icon className="size-4" strokeWidth={1.5} aria-hidden />
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

function KeyStep() {
  const { member, loading } = useSession();
  const href = member || loading ? routes.developer : `${routes.join}?next=${encodeURIComponent(routes.developer)}`;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-5 text-[#FFFFFF80]">{connect.step1Body}</p>
      <ButtonLink href={href} variant="white" size="sm" className="self-start">
        <KeyRound className="size-4" strokeWidth={1.5} aria-hidden />
        {member || loading ? connect.step1Cta : "Create a free account"}
      </ButtonLink>
    </div>
  );
}

/** Step two: the address, the header and a snippet for the chosen client. */
export function ConnectBody({ client, onClient }: { client: ClientId; onClient: (id: ClientId) => void }) {
  const url = useServerUrl();
  const snippet = snippetFor(client, url);
  const blurb = clients.find((c) => c.id === client)?.blurb;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ClientPicker value={client} onChange={onClient} />
      <p className="text-sm leading-5 text-[#FFFFFF80]">{blurb}</p>
      <div className="flex min-w-0 flex-col gap-2">
        <Row label={connect.urlLabel} value={url} />
        <Row label={connect.headerLabel} value={`Authorization: Bearer ${connect.keyPlaceholder}`} />
      </div>
      <CodeBlock code={snippet} label={`${clients.find((c) => c.id === client)?.label ?? ""} snippet`} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border-subtle bg-surface-primary py-1 pr-1 pl-4">
      <span className="hidden w-[112px] shrink-0 text-xs leading-4 font-medium text-text-secondary sm:block">{label}</span>
      <code aria-label={label} className="min-w-0 flex-1 truncate font-mono text-xs leading-5 text-text-primary" title={value}>
        {value}
      </code>
      <CopyButton text={value} label={connect.copy} name={`Copy ${label.toLowerCase()}`} copiedLabel={connect.copied} />
    </div>
  );
}

/** The connect section at the foot of the page ("How to connect?" scrolls here). */
export function ConnectSection({ client, onClient }: { client: ClientId; onClient: (id: ClientId) => void }) {
  return (
    <section id="connect" aria-labelledby="connect-title" className="flex w-full max-w-[1360px] scroll-mt-6 flex-col gap-7">
      <h2 id="connect-title" className="text-xl leading-6 font-semibold tracking-[-0.02em] text-text-primary">
        {connect.title}
      </h2>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[339px_minmax(0,1fr)] lg:gap-10">
        <div className="flex flex-col gap-6">
          <Step n={1} title={connect.step1}>
            <KeyStep />
          </Step>
          <ul className="flex flex-col gap-2 border-t border-border-subtle pt-6">
            {connect.notes.map((n) => (
              <li key={n} className="text-sm leading-5 text-[#FFFFFF80]">
                {n}
              </li>
            ))}
          </ul>
        </div>
        <Step n={2} title={connect.step2}>
          <ConnectBody client={client} onClient={onClient} />
        </Step>
      </div>
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border-default bg-border-subtle text-xs leading-4 font-semibold text-brand">
          {n}
        </span>
        <h3 className="text-base leading-6 font-semibold text-text-primary">{title}</h3>
      </div>
      {children}
    </div>
  );
}
