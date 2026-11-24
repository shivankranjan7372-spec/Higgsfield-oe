import type { ReactNode } from "react";
import type { NavId } from "@/content/site";
import { cn } from "@/ui";
import { CompactNav } from "./compact-nav";
import { FullNav } from "./full-nav";
import { PromoBanner } from "./promo-banner";
import { SiteFooter } from "./site-footer";

/**
 * The frame around every app page: the offer strip, the nav, then the page.
 *
 *   <AppShell active="image" fixed>...</AppShell>
 *   <AppShell active="pricing" nav="full" footer>...</AppShell>
 *
 * `active` lights a nav link. `fixed` pins the frame to the window height so the page can
 * manage its own scrolling (create pages, where the composer floats over a scrolling grid).
 * Without it the page scrolls as a whole.
 *
 * `nav` picks the bar: "compact" (the default, 36 pixels, on the studios) or "full" (the
 * taller bar with the big menus, on the home and marketing pages). `footer` adds the site
 * footer under the page; it has no effect with `fixed`.
 *
 * These five props are a contract: pages all over the app pass them. Keep them working.
 */
export function AppShell({
  active,
  fixed,
  nav = "compact",
  footer,
  children,
}: {
  active?: NavId;
  fixed?: boolean;
  nav?: "compact" | "full";
  footer?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col", fixed ? "h-dvh overflow-hidden" : "min-h-dvh")}>
      <PromoBanner />
      {nav === "full" ? <FullNav active={active} /> : <CompactNav active={active} />}
      <main className="relative flex min-h-0 flex-1 flex-col">{children}</main>
      {footer && !fixed ? <SiteFooter /> : null}
    </div>
  );
}
