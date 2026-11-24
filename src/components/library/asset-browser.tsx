"use client";

import { Heart, Info, LayoutGrid, ListFilter, Search, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import useSWRInfinite from "swr/infinite";
import { library } from "@/content/library";
import { routes } from "@/content/site";
import { errorMessage, fetcher } from "@/lib/api";
import { useNow } from "@/lib/browser";
import { Button, ButtonLink, cn, MenuItem, MenuLabel, Popover, PopoverContent, PopoverTrigger } from "@/ui";
import { AssetMedia, BOX, CheckBox, EmptyState, ErrorLine, PanelHeader, SkeletonTiles } from "./common";
import { onLibraryChange, assetLabel, type Asset, type Folder, type LibraryPage, type Summary } from "./data";
import { SelectionBar } from "./selection-bar";
import { AssetViewer } from "./viewer";

export interface Scope {
  kind?: "image" | "video" | "audio";
  source?: "upload";
  favorite?: boolean;
  folder?: string;
}

type SourceId = (typeof library.sources)[number]["id"];
type DateId = (typeof library.dates)[number]["id"];
type SortId = (typeof library.sorts)[number]["id"];
type SizeId = (typeof library.sizes)[number]["id"];

const PAGE = 60;

function dayStart(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function AssetBrowser({
  title,
  lead,
  actions,
  scope,
  summary,
  folders,
  emptyLine,
  onUpload,
  uploading,
  enabled = true,
  openFirst = null,
}: {
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  scope: Scope;
  summary?: Summary;
  folders: Folder[];
  emptyLine: string;
  onUpload: () => void;
  uploading: boolean;
  /** False until there is a session to ask for. */
  enabled?: boolean;
  /** A file to show in the viewer straight away, when a link named one (`?asset=<id>`). */
  openFirst?: string | null;
}) {
  const now = useNow();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceId>("all");
  const [date, setDate] = useState<{ id: DateId; from?: number }>({ id: "any" });
  const [model, setModel] = useState<string | null>(null);
  const [sort, setSort] = useState<SortId>("newest");
  const [size, setSize] = useState<SizeId>("m");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(openFirst);

  // Search waits for a short pause in typing.
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const filtered = query !== "" || source !== "all" || date.id !== "any" || model !== null;

  const base = useMemo(() => {
    const p = new URLSearchParams();
    if (scope.kind) p.set("kind", scope.kind);
    const src = scope.source ?? (source === "all" ? null : source);
    if (src) p.set("source", src);
    if (scope.favorite) p.set("favorite", "1");
    if (scope.folder) p.set("folder", scope.folder);
    if (model) p.set("model", model);
    if (date.from) p.set("from", String(date.from));
    if (query) p.set("q", query);
    p.set("sort", sort);
    p.set("limit", String(PAGE));
    return `/api/library?${p.toString()}`;
  }, [scope.kind, scope.source, scope.favorite, scope.folder, source, model, date.from, query, sort]);

  const { data, error, isLoading, size: pages, setSize: setPages, mutate, isValidating } = useSWRInfinite<LibraryPage>(
    (i, prev: LibraryPage | null) => (!enabled ? null : i === 0 ? base : prev?.nextCursor ? `${base}&cursor=${encodeURIComponent(prev.nextCursor)}` : null),
    fetcher,
    { revalidateFirstPage: true },
  );
  const assets = useMemo(() => data?.flatMap((p) => p.assets) ?? [], [data]);
  useEffect(() => onLibraryChange(() => void mutate()), [mutate]);
  const hasMore = !!data?.[data.length - 1]?.nextCursor;
  const loadingMore = isValidating && pages > (data?.length ?? 0);

  // Keep the selection to files that are still listed.
  const listed = useMemo(() => new Set(assets.map((a) => a.id)), [assets]);
  const chosen = useMemo(() => [...selected].filter((id) => listed.has(id)), [selected, listed]);

  // Endless scroll: load the next page when the end comes into view.
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = end.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((e) => {
      if (e[0]?.isIntersecting && !loadingMore) void setPages(pages + 1);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingMore, pages, setPages]);

  const groups = useMemo(() => {
    if (sort !== "newest" && sort !== "oldest") return [{ key: "all", label: "", items: assets }];
    const out: { key: string; label: string; items: Asset[] }[] = [];
    const today = now ? dayStart(now * 1000) : null;
    const fmt = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" });
    for (const a of assets) {
      const day = dayStart(a.createdAt);
      const key = String(day);
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        const label = today === day ? library.today : today !== null && today - day === 86400000 ? library.yesterday : fmt.format(day);
        g = { key, label, items: [] };
        out.push(g);
      }
      g.items.push(a);
    }
    return out;
  }, [assets, sort, now]);

  const toggle = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const rowHeight = library.sizes.find((s) => s.id === size)?.row ?? 162;
  const clearFilters = () => {
    setQ("");
    setQuery("");
    setSource("all");
    setDate({ id: "any" });
    setModel(null);
  };
  const openIndex = open ? assets.findIndex((a) => a.id === open) : -1;

  return (
    <>
      <PanelHeader title={title} lead={lead}>
        {actions}
        <label className={cn(BOX, "group relative w-full justify-between focus-within:bg-border-subtle sm:w-[184px]")}>
          <span className="flex min-w-0 flex-1 items-center gap-[6px]">
            <Search className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={library.search.placeholder}
              aria-label={library.search.hint}
              maxLength={200}
              className="min-w-0 flex-1 bg-transparent text-sm leading-5 font-medium text-text-primary outline-none placeholder:text-text-primary [&::-webkit-search-cancel-button]:hidden"
            />
          </span>
          {q ? (
            <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="text-text-muted hover:text-text-primary">
              <X className="size-4" strokeWidth={1.5} aria-hidden />
            </button>
          ) : (
            <Info className="size-4 shrink-0 text-text-muted" strokeWidth={1.5} aria-hidden />
          )}
          <span
            role="tooltip"
            className="pointer-events-none absolute top-[calc(100%+6px)] left-1/2 z-20 hidden w-[240px] -translate-x-1/2 rounded-md bg-surface-menu px-3 py-2 text-xs leading-4 font-medium text-text-primary group-hover:block group-focus-within:block"
          >
            {library.search.hint}
          </span>
        </label>
        <Popover>
          <PopoverTrigger className={cn(BOX, "sm:w-[80px]", filtered && "border-brand text-brand")}>
            <ListFilter className="size-4" strokeWidth={1.5} aria-hidden />
            {library.filter}
          </PopoverTrigger>
          <PopoverContent align="end" className="max-h-[70vh] w-[260px] overflow-y-auto scroll-quiet">
            {!scope.source ? (
              <>
                <MenuLabel>{library.filterLabels.source}</MenuLabel>
                {library.sources.map((s) => (
                  <MenuItem key={s.id} selected={source === s.id} onClick={() => setSource(s.id)}>
                    {s.label}
                  </MenuItem>
                ))}
              </>
            ) : null}
            <MenuLabel>{library.filterLabels.date}</MenuLabel>
            {library.dates.map((d) => (
              <MenuItem
                key={d.id}
                selected={date.id === d.id}
                onClick={() => {
                  const t = Date.now();
                  setDate({ id: d.id, from: d.days === 0 ? undefined : d.days < 0 ? dayStart(t) : t - d.days * 86400000 });
                }}
              >
                {d.label}
              </MenuItem>
            ))}
            {summary && summary.models.length > 0 ? (
              <>
                <MenuLabel>{library.filterLabels.model}</MenuLabel>
                <MenuItem selected={model === null} onClick={() => setModel(null)}>
                  {library.filterLabels.anyModel}
                </MenuItem>
                {summary.models.map((m) => (
                  <MenuItem key={m.id} selected={model === m.id} hint={m.count} onClick={() => setModel(m.id)}>
                    {m.name}
                  </MenuItem>
                ))}
              </>
            ) : null}
            {filtered ? (
              <div className="mt-1 border-t border-border-subtle pt-1">
                <MenuItem onClick={clearFilters}>{library.filterLabels.clear}</MenuItem>
              </div>
            ) : null}
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger className={cn(BOX, "sm:w-[79px]")}>
            <LayoutGrid className="size-4" strokeWidth={1.5} aria-hidden />
            {library.view}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[220px]">
            <MenuLabel>{library.filterLabels.sort}</MenuLabel>
            {library.sorts.map((s) => (
              <MenuItem key={s.id} selected={sort === s.id} onClick={() => setSort(s.id)}>
                {s.label}
              </MenuItem>
            ))}
            <MenuLabel>{library.view}</MenuLabel>
            {library.sizes.map((s) => (
              <MenuItem key={s.id} selected={size === s.id} onClick={() => setSize(s.id)}>
                {s.label}
              </MenuItem>
            ))}
          </PopoverContent>
        </Popover>
        <button type="button" onClick={onUpload} disabled={uploading} className={cn(BOX, "disabled:opacity-50")}>
          <Upload className="size-4" strokeWidth={1.5} aria-hidden />
          {uploading ? library.uploading : library.upload}
        </button>
      </PanelHeader>

      <div className="-mx-[15px] flex min-h-0 flex-1 flex-col overflow-y-auto px-[15px] scroll-quiet">
        {error ? (
          <div className="pt-4">
            <ErrorLine message={errorMessage(error)} onRetry={() => void mutate()} />
          </div>
        ) : (isLoading || !enabled) && !data ? (
          <SkeletonTiles />
        ) : assets.length === 0 ? (
          filtered ? (
            <EmptyState
              line={library.empty.filtered.line}
              action={
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  {library.empty.filtered.cta}
                </Button>
              }
            />
          ) : (
            <EmptyState
              line={emptyLine}
              action={
                scope.folder || scope.favorite ? null : (
                  <div className="flex flex-wrap justify-center gap-2">
                    <ButtonLink href={routes.image} variant="lime" size="sm">
                      {library.empty.all.cta}
                    </ButtonLink>
                    <Button variant="outline" size="sm" onClick={onUpload}>
                      <Upload className="size-4" strokeWidth={1.5} aria-hidden />
                      {library.upload}
                    </Button>
                  </div>
                )
              }
            />
          )
        ) : (
          <div style={{ ["--row" as string]: `${rowHeight}px` }} className="pb-20">
            {groups.map((g) => {
              const ids = g.items.map((a) => a.id);
              const on = ids.filter((id) => selected.has(id)).length;
              return (
                <section key={g.key} aria-label={g.label || undefined}>
                  {g.label ? (
                    <div className="flex items-center gap-2 pt-[18px] pb-[14px] pl-[6px]">
                      <CheckBox
                        checked={on === ids.length}
                        mixed={on > 0 && on < ids.length}
                        onChange={(v) => toggle(ids, v)}
                        label={library.selectGroup(g.label)}
                      />
                      <h2 className="text-sm leading-5 font-medium text-text-primary">{g.label}</h2>
                    </div>
                  ) : (
                    <div className="h-4" />
                  )}
                  <ul aria-label={g.label || library.title} className="flex flex-wrap gap-1 max-sm:[--row:110px]!">
                    {g.items.map((a) => (
                      <Tile
                        key={a.id}
                        asset={a}
                        selected={selected.has(a.id)}
                        selecting={chosen.length > 0}
                        onSelect={(v) => toggle([a.id], v)}
                        onOpen={() => setOpen(a.id)}
                      />
                    ))}
                    <li aria-hidden className="h-0 grow-[1000]" />
                  </ul>
                </section>
              );
            })}
            <div ref={end} className="flex justify-center py-6">
              {hasMore ? (
                <Button variant="outline" size="sm" disabled={loadingMore} onClick={() => void setPages(pages + 1)}>
                  {library.loadMore}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <SelectionBar
        assets={assets.filter((a) => chosen.includes(a.id))}
        total={assets.length}
        folders={folders}
        onSelectAll={() => toggle(assets.map((a) => a.id), true)}
        onClear={() => setSelected(new Set())}
      />

      <AssetViewer
        asset={openIndex >= 0 ? assets[openIndex] : null}
        folders={folders}
        onClose={() => setOpen(null)}
        onPrev={openIndex > 0 ? () => setOpen(assets[openIndex - 1].id) : undefined}
        onNext={openIndex >= 0 && openIndex < assets.length - 1 ? () => setOpen(assets[openIndex + 1].id) : undefined}
      />
    </>
  );
}

function Tile({
  asset,
  selected,
  selecting,
  onSelect,
  onOpen,
}: {
  asset: Asset;
  selected: boolean;
  selecting: boolean;
  onSelect: (v: boolean) => void;
  onOpen: () => void;
}) {
  const ratio = asset.width && asset.height ? asset.width / asset.height : asset.kind === "audio" ? 1 : 16 / 9;
  const r = Math.min(Math.max(ratio, 0.5), 2.4);
  const [hot, setHot] = useState(false);
  return (
    <li
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      onFocus={() => setHot(true)}
      onBlur={() => setHot(false)}
      className={cn("group relative overflow-hidden bg-[#222222]", selected && "outline-2 -outline-offset-2 outline-brand")}
      style={{ flexGrow: r, flexBasis: `calc(var(--row) * ${r})`, aspectRatio: String(r) }}
    >
      <button
        type="button"
        onClick={() => (selecting ? onSelect(!selected) : onOpen())}
        aria-label={assetLabel(asset)}
        className="absolute inset-0 z-[1] outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
      />
      <AssetMedia asset={asset} active={hot} />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-[#00000066] via-transparent to-transparent opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100",
          (selected || selecting) && "opacity-100",
        )}
      >
        <CheckBox
          checked={selected}
          onChange={onSelect}
          label={`${library.selectOne}: ${assetLabel(asset)}`}
          className="pointer-events-auto absolute top-2 left-2"
        />
      </div>
      {asset.favorite ? (
        <Heart className="pointer-events-none absolute top-2 right-2 z-[2] size-4 fill-text-primary text-text-primary" strokeWidth={1.5} aria-label={library.selection.favourite} />
      ) : null}
    </li>
  );
}
