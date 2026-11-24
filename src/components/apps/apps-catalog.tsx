"use client";

import { ChevronRight, LayoutGrid, Search, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import useSWR, { useSWRConfig } from "swr";
import { LoginDialog } from "@/components/entry/login-dialog";
import { appsCopy, categoryBlurbs } from "@/content/apps";
import { routes } from "@/content/site";
import { api, errorMessage, fetcher } from "@/lib/api";
import { useQueryParam } from "@/lib/browser";
import { useSession } from "@/lib/session";
import { Button, cn } from "@/ui";
import { AppCard, CardSkeleton, FeaturedCard } from "./app-card";
import type { AppSummary, Catalog } from "./types";

const ROW = 5;
/* A row of cards: scrolls inside itself on small screens, five equal columns at 1440. */
const rowClass = "-mx-4 flex gap-4 overflow-x-auto scroll-none px-4 desktop:mx-0 desktop:grid desktop:grid-cols-5 desktop:overflow-visible desktop:px-0";

function SectionHead({ title, sub, onSeeAll }: { title: string; sub: string; onSeeAll?: () => void }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="font-display text-2xl leading-8 font-bold tracking-[-0.02em] text-text-primary uppercase sm:text-3xl sm:leading-[36px]">{title}</h2>
        <p className="text-sm leading-5 text-[#FFFFFF99]">{sub}</p>
      </div>
      {onSeeAll ? (
        <button
          type="button"
          onClick={onSeeAll}
          aria-label={`${appsCopy.seeAll}: ${title}`}
          className="flex h-10 shrink-0 items-center justify-center gap-1 rounded-lg px-3 text-sm leading-5 font-semibold text-text-primary transition-colors duration-150 hover:bg-border-subtle"
        >
          {appsCopy.seeAll}
          <ChevronRight className="size-[18px]" strokeWidth={1.5} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function Section({ label, children, head }: { label: string; head: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={label} className="flex w-full flex-col gap-4">
      {head}
      {children}
    </section>
  );
}

export function AppsCatalog() {
  const { user, loading: sessionLoading } = useSession();
  const { mutate: mutateAny } = useSWRConfig();
  const fromQuery = useQueryParam("category");
  // Undefined until the visitor picks a pill; until then a ?category= in the address decides.
  const [picked, setCategory] = useState<string | null | undefined>(undefined);
  const category = picked === undefined ? fromQuery : picked;
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setQ(typed.trim()), 250);
    return () => window.clearTimeout(id);
  }, [typed]);

  const all = useSWR<Catalog>("/api/apps", fetcher);
  const filtered = category !== null || q !== "";
  const query = new URLSearchParams();
  if (category) query.set("category", category);
  if (q) query.set("q", q);
  const list = useSWR<Catalog>(filtered ? `/api/apps?${query}` : null, fetcher, { keepPreviousData: true });
  const pinned = useSWR<{ apps: AppSummary[] }>(user ? "/api/apps/pinned" : null, fetcher);
  const recent = useSWR<{ apps: AppSummary[] }>(user ? "/api/apps/recent?limit=5" : null, fetcher);

  const categories = all.data?.categories ?? [];
  const featured = useMemo(() => (all.data?.apps ?? []).filter((a) => a.badge && a.status === "available").slice(0, ROW), [all.data]);
  const byCategory = useMemo(() => {
    const m = new Map<string, AppSummary[]>();
    for (const a of all.data?.apps ?? []) m.set(a.category, [...(m.get(a.category) ?? []), a]);
    return m;
  }, [all.data]);

  async function togglePin(app: AppSummary) {
    if (app.pinned === null || !user) {
      setLoginOpen(true);
      return;
    }
    setProblem(null);
    try {
      await api(`/api/apps/${app.id}/pin`, { method: app.pinned ? "DELETE" : "PUT" });
      await mutateAny((key) => typeof key === "string" && key.startsWith("/api/apps"));
    } catch (e) {
      setProblem(errorMessage(e));
    }
  }

  function pick(id: string | null) {
    setCategory(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const pills = [{ id: null as string | null, label: appsCopy.allLabel }, ...categories.map((c) => ({ id: c.id as string | null, label: c.label }))];
  const loading = all.isLoading && !all.data;
  const listError = all.error ?? list.error;

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 pt-10 pb-20 sm:pt-14">
      <header className="flex flex-col">
        <LayoutGrid className="size-7 text-text-primary" strokeWidth={1.5} aria-hidden />
        <h1 className="mt-6 font-display text-[32px] leading-[36px] font-bold tracking-[-0.0134em] text-text-primary uppercase sm:text-5xl sm:leading-[48px]">
          {appsCopy.headingLead} <span className="text-brand">{appsCopy.headingBrand}</span>
        </h1>
        <p className="mt-4 text-sm leading-5 text-text-muted">{appsCopy.intro}</p>
      </header>

      <div className="flex w-full flex-col gap-14">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-8">
          <label className="flex h-11 w-full shrink-0 items-center gap-2 rounded-xl bg-[#FFFFFF0A] px-4 shadow-[#0000001F_0px_4px_12px] transition-colors duration-150 focus-within:bg-[#FFFFFF14] hover:bg-[#FFFFFF0F] md:w-[237px]">
            <Search className="size-5 shrink-0 text-[#FFFFFF99]" strokeWidth={1.5} aria-hidden />
            <span className="sr-only">{appsCopy.searchLabel}</span>
            <input
              type="search"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={appsCopy.searchPlaceholder}
              className="h-5 min-w-0 flex-1 bg-transparent text-sm leading-5 text-text-primary outline-none placeholder:text-[#FFFFFF99] [&::-webkit-search-cancel-button]:hidden"
            />
            {typed ? (
              <button type="button" aria-label={appsCopy.clearSearch} onClick={() => setTyped("")} className="shrink-0 text-[#FFFFFF99] hover:text-text-primary">
                <X className="size-4" strokeWidth={1.5} aria-hidden />
              </button>
            ) : null}
          </label>
          <div className="relative min-w-0 flex-1">
            <div role="tablist" aria-label="Categories" className="flex h-11 items-center gap-1 overflow-x-auto scroll-none rounded-xl bg-[#131517] px-1 shadow-[#FFFFFF05_0px_0px_0px_1px] md:w-fit md:max-w-full">
              {pills.map((p) => {
                const on = category === p.id;
                return (
                  <button
                    key={p.id ?? "all"}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => pick(p.id)}
                    className={cn(
                      "flex h-9 shrink-0 items-center justify-center rounded-lg px-[17px] text-sm leading-5 font-medium whitespace-nowrap shadow-[#0000000D_0px_1px_2px] transition-colors duration-150",
                      on ? "bg-[#2E3031] text-text-soft" : "text-[#FFFFFF99] hover:bg-border-subtle hover:text-text-primary",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {problem ? (
          <p role="alert" className="-mt-10 text-sm leading-5 text-danger">
            {problem}
          </p>
        ) : null}

        {listError ? (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl bg-[#131517] p-6">
            <p className="text-sm leading-5 text-text-primary">{appsCopy.loadError}</p>
            <p className="text-sm leading-5 text-text-secondary">{errorMessage(listError)}</p>
            <Button variant="outline" size="sm" onClick={() => void (all.mutate(), list.mutate())}>
              {appsCopy.retry}
            </Button>
          </div>
        ) : filtered ? (
          <Section
            label={category ? (categories.find((c) => c.id === category)?.label ?? category) : appsCopy.searchLabel}
            head={
              <SectionHead
                title={category ? (categories.find((c) => c.id === category)?.label ?? "") : appsCopy.allLabel}
                sub={list.data ? appsCopy.results(list.data.apps.length) + (category ? ` · ${categoryBlurbs[category] ?? ""}` : "") : " "}
              />
            }
          >
            {list.data && list.data.apps.length === 0 ? (
              <div className="flex flex-col items-start gap-3 rounded-2xl bg-[#131517] p-6">
                <p className="text-sm leading-5 text-text-primary">{appsCopy.emptySearch}</p>
                <Button variant="outline" size="sm" onClick={() => (setTyped(""), setQ(""), setCategory(null))}>
                  {appsCopy.clearSearch}
                </Button>
              </div>
            ) : (
              <ul aria-label="Apps" className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 desktop:grid-cols-5">
                {list.data ? list.data.apps.map((a) => <AppCard key={a.id} app={a} onPin={togglePin} fluid />) : Array.from({ length: 10 }, (_, i) => <CardSkeleton key={i} fluid />)}
              </ul>
            )}
          </Section>
        ) : (
          <div className="flex flex-col gap-8">
            <Section label={appsCopy.featured.title} head={<SectionHead title={appsCopy.featured.title} sub={appsCopy.featured.sub} />}>
              <ul aria-label={appsCopy.featured.title} className={rowClass}>
                {loading ? Array.from({ length: ROW }, (_, i) => <CardSkeleton key={i} tall />) : featured.map((a) => <FeaturedCard key={a.id} app={a} onPin={togglePin} />)}
              </ul>
            </Section>

            {!sessionLoading && user && pinned.data && pinned.data.apps.length > 0 ? (
              <Section label={appsCopy.pinned.title} head={<SectionHead title={appsCopy.pinned.title} sub={appsCopy.pinned.sub} />}>
                <ul aria-label={appsCopy.pinned.title} className={rowClass}>
                  {pinned.data.apps.slice(0, ROW).map((a) => (
                    <AppCard key={a.id} app={a} onPin={togglePin} />
                  ))}
                </ul>
              </Section>
            ) : null}

            {!sessionLoading && user && recent.data && recent.data.apps.length > 0 ? (
              <Section label={appsCopy.recent.title} head={<SectionHead title={appsCopy.recent.title} sub={appsCopy.recent.sub} />}>
                <ul aria-label={appsCopy.recent.title} className={rowClass}>
                  {recent.data.apps.slice(0, ROW).map((a) => (
                    <AppCard key={a.id} app={a} onPin={togglePin} />
                  ))}
                </ul>
              </Section>
            ) : null}

            {loading
              ? Array.from({ length: 2 }, (_, s) => (
                  <ul key={s} aria-hidden className={rowClass}>
                    {Array.from({ length: ROW }, (_, i) => (
                      <CardSkeleton key={i} />
                    ))}
                  </ul>
                ))
              : categories.map((c) => (
                  <Section key={c.id} label={c.label} head={<SectionHead title={c.label} sub={categoryBlurbs[c.id] ?? ""} onSeeAll={() => pick(c.id)} />}>
                    <ul aria-label={c.label} className={rowClass}>
                      {(byCategory.get(c.id) ?? []).slice(0, ROW).map((a) => (
                        <AppCard key={a.id} app={a} onPin={togglePin} />
                      ))}
                    </ul>
                  </Section>
                ))}
          </div>
        )}
      </div>
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} mode="join" next={routes.apps} />
    </div>
  );
}
