"use client";

import { Bell as BellIcon } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { bellWords } from "@/content/shell";
import { routes } from "@/content/site";
import { fetcher } from "@/lib/api";
import { notificationStream, useLiveStream } from "@/lib/live";
import { cn } from "@/ui";

const KEY = "/api/notifications/unread";

/**
 * The unread count, kept fresh by the live stream (`/api/notifications/stream`), with a slow poll
 * as the fallback when the stream is down. Pass `enabled` only for a signed-in member.
 */
export function useUnread(enabled: boolean): number {
  const { data, mutate } = useSWR<{ unread: number }>(enabled ? KEY : null, fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  });

  // Every event on the stream carries the count; anything else (a dropped connection) changes nothing.
  useLiveStream(
    notificationStream,
    (_event, data) => {
      const n = (data as { unread?: unknown } | null)?.unread;
      if (typeof n === "number") void mutate({ unread: n }, { revalidate: false });
    },
    enabled,
  );

  return data?.unread ?? 0;
}

/** The bell: links to the notifications page and shows how many are unread. Members only. */
export function Bell({ className, size }: { className: string; size: 16 | 20 }) {
  const unread = useUnread(true);
  const shown = unread > 99 ? "99+" : String(unread);
  return (
    <Link href={routes.notifications} aria-label={bellWords.label(unread)} className={cn("relative", className)} data-unread={unread}>
      <BellIcon className={size === 16 ? "size-4" : "size-5"} strokeWidth={1.5} aria-hidden />
      {unread > 0 ? (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-promo px-1 text-2xs leading-3 font-semibold text-text-primary tabular-nums ring-2 ring-page"
        >
          {shown}
        </span>
      ) : null}
    </Link>
  );
}
