"use client";

import { BookOpen, Box, Coins, Copy, Check, Eye, FolderOpen, Layers, Search, Sparkles, Wallet, X, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { scopeFilters, toolCallBody, toolGroups, tools, toolsSection, type Scope, type ToolGroup, type ToolInfo } from "@/content/mcp";
import { routes } from "@/content/site";
import Link from "next/link";
import { Artwork, cn } from "@/ui";
import { useCopy } from "./copy";

const groupIcon: Record<ToolGroup | "all", LucideIcon> = { all: Layers, models: Box, generations: Sparkles, files: FolderOpen, account: Wallet };
const scopeIcon: Record<Scope, LucideIcon> = { read: Eye, generate: Sparkles };

type Filter = ToolGroup | "all" | `scope:${Scope}`;

/** "Tools your agent gets": the search and filter column, and one row per real MCP tool. */
export function Tools() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = tools.filter((t) => {
    if (filter.startsWith("scope:")) {
      if (t.scope !== filter.slice(6)) return false;
    } else if (filter !== "all" && t.group !== filter) return false;
    if (!q) return true;
    return [t.name, t.title, t.description].some((s) => s.toLowerCase().includes(q));
  });

  return (
    <section aria-labelledby="tools-title" className="flex w-full max-w-[1360px] flex-col gap-6">
      <h2 id="tools-title" className="text-xl leading-6 font-semibold tracking-[-0.02em] text-text-primary">
        {toolsSection.title}
      </h2>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[339px_minmax(0,1fr)] lg:gap-10">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <label className="flex h-9 items-center gap-2 rounded-xl bg-border-default px-[10px] focus-within:outline-2 focus-within:outline-brand">
            <Search className="size-[18px] shrink-0 text-text-secondary" strokeWidth={1.5} aria-hidden />
            <span className="sr-only">{toolsSection.search}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={toolsSection.search}
              className="h-6 min-w-0 flex-1 bg-transparent text-sm leading-6 text-text-primary outline-none placeholder:text-text-secondary focus-visible:outline-none [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query ? (
              <button type="button" aria-label={toolsSection.clear} onClick={() => setQuery("")} className="rounded-md text-text-secondary hover:text-text-primary">
                <X className="size-4" strokeWidth={1.5} aria-hidden />
              </button>
            ) : null}
          </label>
          <nav aria-label="Filter tools" className="scroll-none flex gap-[2px] overflow-x-auto lg:flex-col">
            {toolGroups.map((g) => (
              <FilterRow key={g.id} icon={groupIcon[g.id]} label={g.label} on={filter === g.id} onClick={() => setFilter(g.id)} />
            ))}
            <div aria-hidden className="my-2 hidden h-px bg-border-subtle lg:block" />
            {scopeFilters.map((s) => (
              <FilterRow key={s.id} icon={scopeIcon[s.id]} label={s.label} on={filter === `scope:${s.id}`} onClick={() => setFilter(`scope:${s.id}`)} />
            ))}
          </nav>
        </aside>
        <div className="flex min-w-0 flex-col gap-7">
          {shown.length ? (
            <ul aria-label="Tools" className="flex flex-col gap-7">
              {shown.map((t) => (
                <ToolRow key={t.name} tool={t} />
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-border-subtle p-6">
              <p className="text-sm leading-5 text-[#FFFFFF80]">{toolsSection.empty}</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
                className="h-8 rounded-md bg-border-default px-3 text-xs leading-4 font-medium text-text-primary hover:bg-border-strong"
              >
                {toolsSection.clear}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FilterRow({ icon: Icon, label, on, onClick }: { icon: LucideIcon; label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 rounded-xl pr-3 pl-[6px] text-sm leading-5 font-medium whitespace-nowrap transition-colors duration-150 lg:w-full",
        on ? "text-brand" : "text-[#FFFFFFCC] hover:bg-border-subtle",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-md border border-border-default shadow-[inset_0_2px_4px_#FFFFFF33]",
          on ? "text-ink" : "text-text-primary",
        )}
        style={{
          backgroundImage: on ? "linear-gradient(135deg, #FFF599 0%, #D1FE17 100%)" : "linear-gradient(135deg, #FFFFFF0D 0%, #FFFFFF33 100%)",
        }}
      >
        <Icon className="size-4" strokeWidth={1.5} />
      </span>
      {label}
    </button>
  );
}

function ToolRow({ tool }: { tool: ToolInfo }) {
  const { state, copy } = useCopy();
  const ScopeIcon = scopeIcon[tool.scope];
  return (
    <li className="rounded-2xl p-0 transition-colors duration-150 hover:bg-surface-primary md:p-3" data-tool={tool.name}>
      <div className="flex flex-col gap-4 md:flex-row md:gap-7">
        <div
          className="relative aspect-[440/248] w-full shrink-0 overflow-hidden rounded-2xl bg-surface-primary md:w-[440px] md:max-w-[46%]"
          style={{ backgroundImage: "linear-gradient(180deg, #FFFFFF1A 0%, #00000000 72.88%)" }}
        >
          <Artwork name={`mcp/tool-${tool.name}`} className="absolute inset-0 size-full" />
          <span aria-hidden className="absolute inset-0 rounded-2xl shadow-[inset_0_0_36px_#FFFFFF1A]" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 md:pt-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-[6px]">
              <h3 className="flex items-center gap-2 text-xl leading-6 font-semibold tracking-[-0.02em] text-text-primary">
                {tool.title}
                {tool.scope === "generate" ? (
                  <span className="inline-flex h-4 items-center gap-[2px] rounded-sm bg-[#364418] px-1 text-2xs leading-4 font-semibold tracking-normal text-brand">
                    <Coins className="size-2.5" strokeWidth={2} aria-hidden />
                    {toolsSection.spendsBadge}
                  </span>
                ) : null}
              </h3>
              <p className="max-w-[489px] text-sm leading-5 text-[#FFFFFF80]">{tool.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-7 items-center gap-[6px] rounded-lg border border-border-default px-[10px] text-xs leading-4 font-medium text-text-primary">
                <span aria-hidden className="text-sm leading-5 font-bold text-brand">
                  /
                </span>
                <code className="font-sans">{tool.name}</code>
              </span>
              <span className="inline-flex h-7 items-center gap-1 rounded-lg border border-border-default px-[10px] text-xs leading-4 font-medium text-text-primary">
                <ScopeIcon className="size-4" strokeWidth={1.5} aria-hidden />
                {tool.scope}
              </span>
            </div>
            <dl className="grid max-w-[489px] grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs leading-4">
              <dt className="text-text-tertiary">{toolsSection.argsLabel}</dt>
              <dd className="truncate font-mono text-text-nav">{tool.args}</dd>
              <dt className="text-text-tertiary">{toolsSection.returnsLabel}</dt>
              <dd className="truncate font-mono text-text-nav">{tool.returns}</dd>
            </dl>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copy(toolCallBody(tool))}
              aria-label={`${toolsSection.copy}: ${tool.name}`}
              className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-text-primary px-3 text-sm leading-4 font-semibold text-text-inverse transition-colors duration-150 hover:bg-text-soft"
            >
              {state === "copied" ? <Check className="size-4" strokeWidth={1.75} aria-hidden /> : <Copy className="size-4" strokeWidth={1.75} aria-hidden />}
              <span aria-live="polite">{state === "copied" ? toolsSection.copied : state === "failed" ? "Copy failed" : toolsSection.copy}</span>
            </button>
            <Link
              href={`${routes.developer}?tab=reference`}
              className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-border-default px-3 text-xs leading-4 font-medium text-text-primary backdrop-blur-[40px] transition-colors duration-150 hover:bg-border-strong"
            >
              <BookOpen className="size-4" strokeWidth={1.5} aria-hidden />
              {toolsSection.more}
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}
