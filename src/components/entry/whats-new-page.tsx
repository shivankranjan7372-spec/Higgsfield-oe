"use client";

import { ArrowUpRight, CheckCheck } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { useState } from "react";
import { whatsNewCopy as c } from "@/content/entry";
import { api, errorMessage, fetcher } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button, cn } from "@/ui";

interface NewsItem {
  id: string;
  title: string;
  body: string;
  link: string | null;
  tag: "new" | "improved" | "fixed" | string;
  publishedAt: number;
  seen: boolean;
}

interface News {
  items: NewsItem[];
  unseen: number;
}

const KEY = "/api/notifications/whats-new";
const panel = "rounded-[28px] border border-[#FFFFFF1F] bg-[#23262AB2]";
const day = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** /whats-new: release notes, newest first, with "mark all seen" for a signed-in member. */
export function WhatsNewPage() {
  const { user } = useSession();
  const { data, error, isLoading, mutate } = useSWR<News>(KEY, fetcher);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function markSeen() {
    setBusy(true);
    setProblem(null);
    try {
      const next = await api<News>(`${KEY}/seen`, { method: "POST", body: { all: true } });
      await mutate(next, { revalidate: false });
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pt-8 pb-16 sm:px-0">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl leading-8 font-semibold tracking-[-0.02em] text-text-primary">{c.title}</h1>
          <p className="text-sm leading-5 text-text-secondary">{c.intro}</p>
        </div>
        {data && user ? (
          data.unseen > 0 ? (
            <Button variant="soft" size="sm" onClick={markSeen} disabled={busy}>
              <CheckCheck className="size-4" strokeWidth={1.5} aria-hidden />
              {c.markSeen}
            </Button>
          ) : (
            <span className="text-xs leading-4 font-medium text-text-secondary" data-all-seen>
              {c.allSeen}
            </span>
          )
        ) : null}
      </header>
      {!user && data ? <p className="text-xs leading-4 text-text-secondary">{c.signedOutNote}</p> : null}
      {problem ? (
        <p role="alert" className="text-sm leading-5 text-danger">
          {problem}
        </p>
      ) : null}

      {error ? (
        <div role="alert" className={cn(panel, "flex flex-col items-start gap-2 p-6")}>
          <p className="text-sm leading-5 text-text-primary">{errorMessage(error) || c.error}</p>
          <button type="button" onClick={() => void mutate()} className="text-sm leading-5 font-semibold text-brand hover:underline">
            {c.retry}
          </button>
        </div>
      ) : isLoading || !data ? (
        <div className={cn(panel, "flex flex-col gap-4 p-6")} aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <span className="shimmer h-3 w-24 rounded-xs bg-border-subtle" />
              <span className="shimmer h-4 w-64 rounded-xs bg-border-subtle" />
              <span className="shimmer h-3 w-full rounded-xs bg-border-subtle" />
            </div>
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <p className={cn(panel, "p-6 text-center text-sm leading-5 text-text-secondary")}>{c.empty}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {data.items.map((it) => (
            <li key={it.id} data-news={it.id} data-seen={it.seen} className={cn(panel, "flex flex-col gap-2 p-5")}>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-4 items-center rounded-xs px-[6px] font-display text-xs leading-4 font-bold uppercase",
                    it.tag === "new" ? "bg-brand text-ink" : it.tag === "fixed" ? "bg-border-default text-text-primary" : "bg-brand-chip text-brand",
                  )}
                >
                  {c.tags[it.tag] ?? it.tag}
                </span>
                <time dateTime={new Date(it.publishedAt).toISOString()} className="text-xs leading-[18px] text-text-tertiary">
                  {day.format(it.publishedAt)}
                </time>
                {!it.seen ? <span aria-label="Not read yet" className="size-2 rounded-full bg-brand" /> : null}
              </div>
              <h2 className="text-base leading-6 font-semibold text-text-primary">{it.title}</h2>
              {it.body ? <p className="text-sm leading-5 text-text-nav">{it.body}</p> : null}
              {it.link?.startsWith("/") && !it.link.startsWith("//") ? (
                <Link href={it.link} className="inline-flex items-center gap-1 self-start text-sm leading-5 font-medium text-brand hover:underline">
                  {c.open}
                  <ArrowUpRight className="size-4" strokeWidth={1.5} aria-hidden />
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
