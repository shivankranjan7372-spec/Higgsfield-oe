"use client";

import { ArrowUpRight, Clock, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog as D } from "radix-ui";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import useSWR from "swr";
import { Artwork, cn } from "@/ui";
import { searchCopy as c, searchTabs, type SearchTab } from "@/content/entry";
import { routes } from "@/content/site";
import { api, errorMessage, fetcher } from "@/lib/api";
import { useSession } from "@/lib/session";
import {
  NewBadge,
  RowBody,
  RowSkeleton,
  RowTile,
  SectionLabel,
  commandGroupOrder,
  firstBadge,
  iconForCommand,
  rowClass,
  runCommand,
  saveRecent,
  tabIcon,
  useDebounced,
  useSearch,
  type Command,
  type ResultItem,
  type Suggestions,
} from "./search-parts";

export interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The search window that opens over any page. The nav opens it (and the "/" key may).
 *
 *   const [open, setOpen] = useState(false);
 *   <SearchDialog open={open} onOpenChange={setOpen} />
 *
 * Empty, it shows recent searches, popular models, the member's newest files and the command
 * list. Typed into, it shows grouped results and matching commands. Arrows move, Enter opens,
 * Escape closes.
 */
export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 animate-fade-in bg-[#00000099] backdrop-blur-[24px]" />
        {open ? <SearchWindow onClose={() => onOpenChange(false)} /> : null}
      </D.Portal>
    </D.Root>
  );
}

interface Entry {
  key: string;
  title: string;
  subtitle?: string;
  tile: ReactNode;
  tag?: string | null;
  open: () => Promise<void>;
  remove?: () => void;
  removeLabel?: string;
  card?: ResultItem;
}

interface Section {
  key: string;
  label: string;
  layout: "rows" | "cards" | "grid";
  entries: Entry[];
  action?: ReactNode;
}

function SearchWindow({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { user } = useSession();
  const signedIn = !!user;
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<SearchTab>("all");
  const [active, setActive] = useState(-1);
  const [problem, setProblem] = useState<string | null>(null);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const query = useDebounced(q.trim());
  const typing = query.length > 0;

  const sugg = useSWR<Suggestions>("/api/search/suggestions", fetcher, { revalidateOnFocus: false });
  const cmds = useSWR<{ commands: Command[] }>(
    `/api/search/commands${typing ? `?q=${encodeURIComponent(query.slice(0, 100))}` : ""}`,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false },
  );
  const results = useSearch(query, tab, tab === "all" ? 5 : 20);

  async function go(href: string | null, saveQuery: boolean) {
    if (saveQuery) await saveRecent(query, signedIn);
    onClose();
    if (href) router.push(href);
  }

  const sections = useMemo<Section[]>(() => {
    const out: Section[] = [];
    const itemEntry = (it: ResultItem, save: boolean): Entry => ({
      key: `${it.type}:${it.id}`,
      title: it.title,
      subtitle: it.subtitle,
      tile: <RowTile item={it} />,
      tag: it.type === "models" ? firstBadge(it) : null,
      open: () => go(it.href, save),
      card: it,
    });
    const commandEntries = (list: Command[]) =>
      [...list]
        .sort((a, b) => commandGroupOrder.indexOf(a.group) - commandGroupOrder.indexOf(b.group))
        .map<Entry>((cmd) => ({
          key: `cmd:${cmd.id}`,
          title: cmd.label,
          subtitle: cmd.hint,
          tile: <RowTile icon={iconForCommand(cmd)} />,
          open: async () => {
            try {
              const href = await runCommand(cmd);
              await go(href, typing);
            } catch (e) {
              setProblem(errorMessage(e));
            }
          },
        }));

    if (!typing) {
      const s = sugg.data;
      if (s?.recentSearches.length) {
        out.push({
          key: "recent",
          label: c.recents,
          layout: "rows",
          action: (
            <button
              type="button"
              onClick={async () => {
                await api("/api/search/recent", { method: "DELETE" }).catch(() => null);
                void sugg.mutate();
              }}
              className="text-xs leading-[18px] font-medium text-text-primary transition-colors duration-150 hover:text-brand"
            >
              {c.clearRecents}
            </button>
          ),
          entries: s.recentSearches.slice(0, 3).map((r) => ({
            key: `recent:${r.id}`,
            title: r.query,
            subtitle: c.recentSubtitle,
            tile: <RowTile icon={Clock} />,
            open: async () => {
              setQ(r.query);
              setActive(0);
              inputRef.current?.focus();
            },
            removeLabel: c.removeRecent(r.query),
            remove: async () => {
              await api(`/api/search/recent/${encodeURIComponent(r.id)}`, { method: "DELETE" }).catch(() => null);
              void sugg.mutate();
            },
          })),
        });
      }
      if (s?.popularModels.length) {
        out.push({ key: "popular", label: c.popular, layout: "cards", entries: s.popularModels.map((m) => itemEntry(m, false)) });
      }
      if (s?.recentItems.length) {
        out.push({ key: "files", label: c.yourFiles, layout: "grid", entries: s.recentItems.slice(0, 4).map((m) => itemEntry(m, false)) });
      }
      if (cmds.data?.commands.length) {
        out.push({ key: "commands", label: c.jumpTo, layout: "grid", entries: commandEntries(cmds.data.commands) });
      }
      return out;
    }

    for (const g of results.data?.groups ?? []) {
      if (!g.items.length) continue;
      const more = g.more ? (
        <button
          type="button"
          onClick={() => go(`${routes.search}?q=${encodeURIComponent(query)}&type=${g.type}`, true)}
          className="text-xs leading-[18px] font-medium text-text-primary transition-colors duration-150 hover:text-brand"
        >
          {c.seeAll}
        </button>
      ) : undefined;
      out.push({ key: g.type, label: g.label, layout: "rows", entries: g.items.map((it) => itemEntry(it, true)), action: more });
    }
    if (tab === "all" && cmds.data?.commands.length) {
      out.push({ key: "commands", label: c.commands, layout: "rows", entries: commandEntries(cmds.data.commands.slice(0, 4)) });
    }
    return out;
    // `go` closes over the latest query; the lists below are what change the sections.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typing, query, tab, sugg.data, cmds.data, results.data, signedIn]);

  const flat = sections.flatMap((s) => s.entries);
  const optionId = (i: number) => `${listId}-opt-${i}`;
  const current = active >= 0 && active < flat.length ? active : -1;

  useEffect(() => {
    if (current >= 0) document.getElementById(optionId(current))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!flat.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => {
        const from = a >= 0 && a < flat.length ? a : step > 0 ? -1 : flat.length;
        return (from + step + flat.length) % flat.length;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (current >= 0) void flat[current].open();
      else if (q.trim()) void go(`${routes.search}?q=${encodeURIComponent(q.trim())}${tab === "all" ? "" : `&type=${tab}`}`, true);
    }
  }

  const loading = typing && !results.data && !results.error;
  const nothing = typing && results.data && !results.isLoading && flat.length === 0;
  let index = -1;

  return (
    <D.Content
      aria-describedby={undefined}
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        inputRef.current?.focus();
      }}
      className="fixed top-1/2 left-1/2 z-50 flex h-[min(642px,calc(100dvh-32px))] w-[min(760px,calc(100vw-16px))] -translate-x-1/2 -translate-y-1/2 animate-fade-in flex-col gap-[6px] overflow-hidden rounded-[28px] border border-[#FFFFFF1F] bg-[#23262AB2] text-text-primary shadow-[0_0_120px_#00000070] outline-none backdrop-blur-[64px]"
    >
      <D.Title className="sr-only">{c.title}</D.Title>

      {/* The field and the close button */}
      <div className="-mb-1 flex shrink-0 items-center gap-[6px] px-1 pt-1">
        <label className="flex h-[52px] min-w-0 flex-1 items-center rounded-4xl bg-[#D9D9D90A] pl-3 transition-colors duration-150 focus-within:bg-[#D9D9D914]">
          <Search className="size-6 shrink-0 text-[#737475]" strokeWidth={1.5} aria-hidden />
          <span className="sr-only">{c.title}</span>
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={current >= 0 ? optionId(current) : undefined}
            value={q}
            maxLength={100}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(e.target.value.trim() ? 0 : -1);
              setProblem(null);
            }}
            onKeyDown={onKey}
            placeholder={c.placeholder}
            autoComplete="off"
            spellCheck={false}
            className="h-7 min-w-0 flex-1 bg-transparent px-2 text-lg leading-7 tracking-[-0.01em] text-text-primary outline-none placeholder:text-[#737475]"
          />
          {q ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setActive(-1);
                inputRef.current?.focus();
              }}
              className="mr-3 shrink-0 rounded-md px-2 text-xs leading-5 font-medium text-text-secondary transition-colors duration-150 hover:text-text-primary"
            >
              {c.clear}
            </button>
          ) : null}
        </label>
        <D.Close
          aria-label={c.close}
          className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-[#D9D9D90A] text-text-primary transition-colors duration-150 hover:bg-border-default"
        >
          <X className="size-6" strokeWidth={2} aria-hidden />
        </D.Close>
      </div>

      {/* Where to look */}
      <div role="tablist" aria-label={c.tabsLabel} className="flex h-12 shrink-0 items-center gap-2 overflow-x-auto px-4 scroll-none">
        {searchTabs.map((t) => {
          const Icon = tabIcon[t.id];
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => {
                setTab(t.id);
                setActive(q.trim() ? 0 : -1);
                inputRef.current?.focus();
              }}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1 rounded-full text-sm leading-5 font-medium whitespace-nowrap text-[#FFFFFFCC] transition-colors duration-150",
                on ? "bg-border-default px-[15px] text-text-primary" : "border border-border-default px-[14px] hover:bg-border-subtle",
              )}
            >
              {Icon ? <Icon className="size-4" strokeWidth={1.5} aria-hidden /> : null}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Everything below scrolls */}
      <div id={listId} role="listbox" aria-label={c.title} className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 scroll-quiet">
        <div className="flex flex-col gap-4">
          {problem ? (
            <p role="alert" className="px-2 text-sm leading-5 text-danger">
              {problem}
            </p>
          ) : null}
          {loading ? <RowSkeleton count={4} /> : null}
          {!typing && !sugg.data && !sugg.error ? <RowSkeleton count={3} /> : null}
          {typing && results.error ? (
            <div className="flex flex-col items-start gap-2 px-2 py-4" role="alert">
              <p className="text-sm leading-5 text-text-primary">{errorMessage(results.error) || c.error}</p>
              <button type="button" onClick={() => void results.mutate()} className="text-sm leading-5 font-semibold text-brand hover:underline">
                {c.retry}
              </button>
            </div>
          ) : null}
          {nothing ? (
            <div className="flex flex-col gap-1 px-2 py-8 text-center">
              <p className="text-sm leading-5 font-semibold text-text-primary">{c.noResults(query)}</p>
              <p className="text-xs leading-[18px] text-text-tab">{c.noResultsHint}</p>
            </div>
          ) : null}

          {sections.map((s) => (
            <section key={s.key} role="group" aria-label={s.label} className="flex flex-col gap-2">
              <SectionLabel action={s.action}>{s.label}</SectionLabel>
              <div
                className={cn(
                  s.layout === "rows" && "flex flex-col gap-1",
                  s.layout === "grid" && "grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-x-2",
                  s.layout === "cards" && "-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 scroll-none",
                )}
              >
                {s.entries.map((e) => {
                  index += 1;
                  const i = index;
                  const on = i === current;
                  if (s.layout === "cards" && e.card) return <ModelCard key={e.key} id={optionId(i)} entry={e} item={e.card} active={on} onHover={() => setActive(i)} />;
                  return (
                    <div key={e.key} className="group relative min-w-0">
                      <div
                        id={optionId(i)}
                        role="option"
                        aria-selected={on}
                        tabIndex={-1}
                        onMouseMove={() => current !== i && setActive(i)}
                        onClick={() => void e.open()}
                        className={cn(rowClass(on), "cursor-pointer", e.remove && "pr-12")}
                      >
                        {e.tile}
                        <RowBody title={e.title} subtitle={e.subtitle} tag={e.tag} active={on} />
                      </div>
                      {e.remove ? (
                        <button
                          type="button"
                          aria-label={e.removeLabel}
                          onClick={e.remove}
                          className="absolute top-1/2 right-3 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-text-secondary opacity-0 transition-colors duration-150 group-hover:opacity-100 hover:bg-border-default hover:text-text-primary focus-visible:opacity-100"
                        >
                          <X className="size-4" strokeWidth={1.5} aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {typing && results.data && flat.length > 0 ? (
            <button
              type="button"
              onClick={() => void go(`${routes.search}?q=${encodeURIComponent(query)}${tab === "all" ? "" : `&type=${tab}`}`, true)}
              className="flex h-11 items-center justify-center gap-1 rounded-xl text-sm leading-5 font-medium text-text-secondary transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary"
            >
              {c.showAll(query)}
              <ArrowUpRight className="size-4" strokeWidth={1.5} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </D.Content>
  );
}

/** A popular model, drawn as the design's product card: picture, maker chip, badge, name, line. */
function ModelCard({ id, entry, item, active, onHover }: { id: string; entry: Entry; item: ResultItem; active: boolean; onHover: () => void }) {
  const maker = typeof item.extra.maker === "string" ? item.extra.maker : null;
  const badge = firstBadge(item);
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      tabIndex={-1}
      onMouseMove={onHover}
      onClick={() => void entry.open()}
      className={cn(
        "relative flex h-[104px] w-[237px] shrink-0 cursor-pointer flex-col justify-center gap-[11px] overflow-hidden rounded-xl px-3 transition-[box-shadow] duration-150",
        active && "ring-2 ring-border-strong",
      )}
    >
      <Artwork name={`entry/model-${item.id}`} className="absolute inset-0 size-full" />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#00000099] to-transparent" />
      <span className="relative flex h-[26px] items-start justify-between gap-2">
        {maker ? (
          <span className="inline-flex h-[26px] items-center gap-1 rounded-full bg-border-subtle px-2 text-2xs leading-[14px] font-medium text-[#FFFFFFCC] backdrop-blur-[8px]">
            <span className="flex size-[14px] items-center justify-center">
              <RowTileGlyph maker={maker} />
            </span>
            {maker}
          </span>
        ) : (
          <span />
        )}
        {badge ? (
          <span className="pt-[6px]">
            <NewBadge>{badge}</NewBadge>
          </span>
        ) : null}
      </span>
      <span className="relative flex min-w-0 flex-col">
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate font-display text-base leading-[19px] font-bold text-[#FFFFFFE6] uppercase">{item.title}</span>
          <ArrowUpRight className="size-[14px] shrink-0 text-[#FFFFFFE6]" strokeWidth={2} aria-hidden />
        </span>
        <span className="truncate pt-[3px] text-xs leading-[18px] text-text-tab">{item.subtitle}</span>
      </span>
    </div>
  );
}

function RowTileGlyph({ maker }: { maker: string }) {
  return <span className="font-display text-2xs leading-[14px] font-bold text-text-primary uppercase">{maker.trim().charAt(0)}</span>;
}
