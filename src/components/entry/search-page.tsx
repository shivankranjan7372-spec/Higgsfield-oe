"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { searchCopy as c, searchTabs, type SearchTab } from "@/content/entry";
import { routes } from "@/content/site";
import { errorMessage } from "@/lib/api";
import { useLive } from "@/lib/browser";
import { useSession } from "@/lib/session";
import { Button, cn } from "@/ui";
import { LoginDialog } from "./login-dialog";
import { RowBody, RowSkeleton, RowTile, SectionLabel, firstBadge, rowClass, saveRecent, tabIcon, useSearch, type ResultItem } from "./search-parts";

const isTab = (v: string | null): v is SearchTab => searchTabs.some((t) => t.id === v);

/** /search?q=…&type=…: every group, or one group with more rows. */
export function SearchPage() {
  const live = useLive();
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<SearchTab>("all");
  const [ready, setReady] = useState(false);
  const [askLogin, setAskLogin] = useState(false);

  // Read the address once the page is live, and again on back and forward.
  useEffect(() => {
    if (!live) return;
    const read = () => {
      const p = new URLSearchParams(window.location.search);
      const q = (p.get("q") ?? "").slice(0, 100);
      const t = p.get("type");
      setText(q);
      setQuery(q.trim());
      setTab(isTab(t) ? t : "all");
      setReady(true);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [live]);

  function show(q: string, t: SearchTab, push: boolean) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (t !== "all") params.set("type", t);
    const url = `${routes.search}${params.size ? `?${params}` : ""}`;
    if (push) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
    setQuery(q);
    setTab(t);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = text.trim();
    show(q, tab, true);
    void saveRecent(q, !!user);
  }

  const { data, error, isLoading, mutate } = useSearch(query, tab, tab === "all" ? 5 : 20);
  const groups = (data?.groups ?? []).filter((g) => tab !== "all" || g.items.length > 0);
  const open = (it: ResultItem) => {
    void saveRecent(query, !!user);
    router.push(it.href);
  };

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-4 pt-8 pb-16 sm:px-0">
      <h1 className="text-2xl leading-8 font-semibold tracking-[-0.02em] text-text-primary">{c.pageTitle}</h1>

      <form role="search" onSubmit={submit} className="flex">
        <label className="flex h-[52px] min-w-0 flex-1 items-center rounded-4xl bg-[#D9D9D90A] pl-3 transition-colors duration-150 focus-within:bg-[#D9D9D914]">
          <Search className="size-6 shrink-0 text-[#737475]" strokeWidth={1.5} aria-hidden />
          <span className="sr-only">{c.title}</span>
          <input
            name="q"
            type="search"
            value={text}
            maxLength={100}
            onChange={(e) => setText(e.target.value)}
            placeholder={c.placeholder}
            autoComplete="off"
            className="h-7 min-w-0 flex-1 bg-transparent px-2 text-lg leading-7 tracking-[-0.01em] text-text-primary outline-none placeholder:text-[#737475]"
          />
          <button
            type="submit"
            className="mr-[6px] h-10 shrink-0 rounded-full bg-border-subtle px-4 text-sm leading-5 font-semibold text-text-primary transition-colors duration-150 hover:bg-border-default"
          >
            {c.title}
          </button>
        </label>
      </form>

      <div role="tablist" aria-label={c.tabsLabel} className="-mx-4 flex h-12 items-center gap-2 overflow-x-auto px-4 scroll-none sm:mx-0 sm:px-0">
        {searchTabs.map((t) => {
          const Icon = tabIcon[t.id];
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => show(query, t.id, false)}
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

      {!sessionLoading && !user ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-border-subtle px-4 py-3">
          <p className="text-sm leading-5 text-text-secondary">{c.signedOutNote}</p>
          <Button variant="tint" size="sm" onClick={() => setAskLogin(true)}>
            {c.signIn}
          </Button>
          <LoginDialog open={askLogin} onOpenChange={setAskLogin} mode="login" />
        </div>
      ) : null}

      <div className="flex flex-col gap-6 rounded-[28px] border border-[#FFFFFF1F] bg-[#23262AB2] p-3" aria-live="polite" aria-busy={isLoading}>
        {!ready || (query && isLoading && !data) ? <RowSkeleton count={5} /> : null}
        {ready && !query ? <p className="px-2 py-8 text-center text-sm leading-5 text-text-secondary">{c.pageEmpty}</p> : null}
        {query && error ? (
          <div role="alert" className="flex flex-col items-start gap-2 px-2 py-4">
            <p className="text-sm leading-5 text-text-primary">{errorMessage(error)}</p>
            <button type="button" onClick={() => void mutate()} className="text-sm leading-5 font-semibold text-brand hover:underline">
              {c.retry}
            </button>
          </div>
        ) : null}
        {query && data && data.total === 0 ? (
          <div className="flex flex-col gap-1 px-2 py-8 text-center">
            <p className="text-sm leading-5 font-semibold text-text-primary">{c.noResults(query)}</p>
            <p className="text-xs leading-[18px] text-text-tab">{c.noResultsHint}</p>
          </div>
        ) : null}
        {query && data && data.total > 0
          ? groups.map((g) => (
              <section key={g.type} aria-label={g.label} className="flex flex-col gap-2">
                <SectionLabel
                  action={
                    tab === "all" && g.more ? (
                      <button
                        type="button"
                        onClick={() => show(query, g.type, true)}
                        className="text-xs leading-[18px] font-medium text-text-primary transition-colors duration-150 hover:text-brand"
                      >
                        {c.seeAll}
                      </button>
                    ) : undefined
                  }
                >
                  {g.label}
                </SectionLabel>
                {g.items.length ? (
                  <ul className={cn("grid gap-1", tab !== "all" && "sm:grid-cols-2 sm:gap-x-2")}>
                    {g.items.map((it) => (
                      <li key={`${it.type}:${it.id}`} className="min-w-0">
                        <a
                          href={it.href}
                          onClick={(e) => {
                            e.preventDefault();
                            open(it);
                          }}
                          className={rowClass(false)}
                        >
                          <RowTile item={it} />
                          <RowBody title={it.title} subtitle={it.subtitle} tag={it.type === "models" ? firstBadge(it) : null} />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-2 py-4 text-sm leading-5 text-text-secondary">{c.groupEmpty}</p>
                )}
              </section>
            ))
          : null}
      </div>
    </div>
  );
}
