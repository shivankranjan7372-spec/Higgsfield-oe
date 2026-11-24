"use client";

import Link from "next/link";
import { communityViews, communityWords as w, type CommunityView } from "@/content/community";
import { routes } from "@/content/site";
import { cn } from "@/ui";

export function viewHref(view: CommunityView) {
  if (view === "contests") return routes.contests;
  return view === "discover" ? routes.community : `${routes.community}?view=${view}`;
}

/**
 * The community bar under the top nav: the wordmark, then the places. 52 high on a near-black
 * strip with a hairline under it, as drawn. `onPick` lets the community page switch views in
 * place instead of reloading.
 */
export function CommunitySubNav({ active, onPick }: { active?: CommunityView; onPick?: (view: CommunityView) => void }) {
  return (
    <div className="sticky top-0 z-20 border-b border-border-subtle bg-[#000000F5]">
      <div className="flex h-[52px] items-center gap-[87px] px-4 md:pl-8">
        <Link href={routes.community} className="hidden w-[260px] shrink-0 md:block">
          <span className="text-chrome font-display text-[19px] leading-[17px] font-bold tracking-[0.04em] uppercase">{w.wordmark}</span>
        </Link>
        <nav aria-label={w.wordmark} className="scroll-none -mx-4 flex h-full min-w-0 items-center gap-[28px] overflow-x-auto px-4 md:mx-0 md:px-0">
          {communityViews.map((item) => {
            const on = item.view === active;
            return (
              <Link
                key={item.view}
                href={viewHref(item.view)}
                aria-current={on ? "page" : undefined}
                onClick={(e) => {
                  if (onPick && item.view !== "contests") {
                    e.preventDefault();
                    onPick(item.view);
                  }
                }}
                className={cn(
                  "flex h-full shrink-0 items-center border-b-2 pt-[2px] text-sm leading-5 font-medium whitespace-nowrap transition-colors duration-150",
                  on ? "border-text-primary text-text-primary" : "border-transparent text-text-idle hover:text-text-tab",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
