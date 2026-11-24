"use client";

import { useState } from "react";
import { LogoMark } from "@/components/brand/logo";
import { clients, connect, hero, type ClientId } from "@/content/mcp";
import { Dialog, DialogContent, cn } from "@/ui";
import { ConnectBody, ConnectSection, clientIcons } from "./connect";
import { Ideas } from "./ideas";
import { Tools } from "./tools";

/** The marketing page for the MCP server. */
export function McpPage() {
  const [client, setClient] = useState<ClientId>("config");
  const [open, setOpen] = useState(false);
  const AgentIcon = clientIcons[client];

  return (
    <div className="flex flex-col bg-black">
      {/* The client bar under the nav. */}
      <div className="flex h-[47px] shrink-0 justify-center border-b border-border-subtle bg-black pt-3">
        <div role="tablist" aria-label="How you connect" className="scroll-none flex h-[34px] max-w-full items-start gap-3 overflow-x-auto px-4">
          {clients.map((c) => {
            const Icon = clientIcons[c.id];
            const on = c.id === client;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setClient(c.id)}
                className={cn(
                  "relative flex h-[34px] shrink-0 items-start justify-center px-[6px] transition-colors duration-150 focus-visible:-outline-offset-2",
                  on ? "text-text-primary" : "text-text-secondary hover:text-text-nav",
                )}
              >
                <span className="flex h-5 items-center gap-[6px] text-sm leading-5 font-medium whitespace-nowrap">
                  <Icon className="size-4" strokeWidth={1.5} aria-hidden />
                  {c.label}
                </span>
                {on ? <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-text-primary" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hero */}
      <section className="relative flex min-h-[420px] justify-center overflow-hidden px-4 pt-8 md:h-[565px]">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, #FFFFFF26 1px, transparent 1.5px)",
            backgroundSize: "16px 16px",
            maskImage: "radial-gradient(ellipse 75% 60% at 50% 50%, #000 30%, transparent 85%)",
            WebkitMaskImage: "radial-gradient(ellipse 75% 60% at 50% 50%, #000 30%, transparent 85%)",
          }}
        />
        <div className="relative flex w-full max-w-[1408px] flex-col items-center justify-center gap-8 py-12 md:py-0">
          <h1 className="flex flex-col items-center text-center font-display text-[28px] leading-[36px] font-bold tracking-[-0.04em] text-text-primary uppercase md:text-5xl md:leading-[56px]">
            <span>
              {hero.line1} <span className="text-brand">{hero.line1Accent}</span>
            </span>
            <span className="flex flex-wrap items-center justify-center gap-x-2">
              <span>{hero.line2a}</span>
              <span
                aria-hidden
                className="flex size-[30px] items-center justify-center rounded-lg border border-border-strong bg-surface-elevated shadow-[inset_0_3px_6px_#FFFFFF33,0_6px_6px_#0000001A] md:size-[44px] md:rounded-xl"
                style={{ backgroundImage: "linear-gradient(180deg, #FFFFFF33 0%, #00000000 100%)" }}
              >
                <AgentIcon className="size-5 text-text-primary md:size-7" strokeWidth={1.75} />
              </span>
              <span>{hero.line2b}</span>
              <LogoMark size={44} className="hidden rounded-xl shadow-[0_6px_6px_#0000001A] md:block" />
              <LogoMark size={30} className="md:hidden" />
              <span>{hero.line2c}</span>
            </span>
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-text-primary px-4 text-base leading-5 font-semibold text-text-inverse shadow-[inset_0_-3px_0_#00000052,0_6px_4px_#00000040,0_32px_24px_#00000026] transition-colors duration-150 hover:bg-text-soft"
            >
              <LogoMark size={20} className="[&>rect]:fill-ink [&>path]:fill-text-primary" />
              {hero.primary}
            </button>
            <a
              href="#connect"
              className="flex h-12 items-center justify-center rounded-xl bg-surface-glass px-4 text-base leading-5 font-semibold text-text-primary backdrop-blur-[12px] transition-colors duration-150 hover:bg-surface-tertiary"
            >
              {hero.secondary}
            </a>
          </div>
        </div>
      </section>

      <div className="flex flex-col items-center gap-[100px] px-4 pb-20 md:px-10">
        <Ideas />
        <Tools />
        <ConnectSection client={client} onClient={setClient} />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={connect.dialogTitle} className="max-w-[640px]">
          <div className="flex flex-col gap-4 p-6">
            <ConnectBody client={client} onClient={setClient} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
