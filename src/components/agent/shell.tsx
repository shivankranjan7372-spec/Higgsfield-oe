"use client";

import { Menu, PanelLeft } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { LogoMark } from "@/components/brand/logo";
import { routes } from "@/content/site";
import { copy } from "@/content/agent";
import { cn, Tag } from "@/ui";
import { useDemoHint, useAgentEvents } from "./data";
import { Sidebar, type SideId } from "./sidebar";

/**
 * The agent's own full-screen frame: the sidebar on the left and one rounded pane
 * on the right, exactly one screen tall. No top nav and no promo strip, as drawn. Below
 * 1024 pixels the sidebar becomes a sheet behind a menu button.
 */
export function AgentShell({
  active,
  activeChat,
  corner,
  children,
}: {
  active?: SideId;
  activeChat?: string;
  /** Controls drawn in the pane's top-right corner. */
  corner?: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [sheet, setSheet] = useState(false);
  const demoHint = useDemoHint(active);
  // Opening the stream here keeps the chat list live on every page.
  useAgentEvents(() => {});

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-surface-primary text-text-primary">
      {/* Wide screens: the sidebar column. */}
      {!collapsed ? (
        <div className="hidden w-[232px] shrink-0 items-center justify-center lg:flex">
          <Sidebar active={active} activeChat={activeChat} onCollapse={() => setCollapsed(true)} />
        </div>
      ) : null}

      {/* Narrow screens: the sidebar as a sheet. */}
      {sheet ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label={copy.nav.collapse} className="absolute inset-0 animate-fade-in bg-scrim" onClick={() => setSheet(false)} />
          <div className="relative flex h-full w-[232px] animate-rise-in items-center justify-center bg-surface-primary">
            <Sidebar active={active} activeChat={activeChat} onCollapse={() => setSheet(false)} onNavigate={() => setSheet(false)} />
          </div>
        </div>
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col py-1 pr-1 pl-1 lg:pl-0">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-clip rounded-2xl">
          <div className="pointer-events-none absolute top-0 right-0 left-0 z-20 flex h-[60px] items-start justify-between px-5 pt-5"
            style={{ backgroundImage: "linear-gradient(180deg, #131416 55%, #13141600 100%)" }}>
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                aria-label={copy.nav.openMenu}
                onClick={() => setSheet(true)}
                className="flex size-8 items-center justify-center rounded-md text-text-primary transition-colors duration-150 hover:bg-border-subtle lg:hidden"
              >
                <Menu className="size-4" strokeWidth={1.5} aria-hidden />
              </button>
              {collapsed ? (
                <button
                  type="button"
                  aria-label={copy.nav.expand}
                  onClick={() => setCollapsed(false)}
                  className="hidden size-8 items-center justify-center rounded-md text-text-primary transition-colors duration-150 hover:bg-border-subtle lg:flex"
                >
                  <PanelLeft className="size-4" strokeWidth={1.5} aria-hidden />
                </button>
              ) : null}
              <Link
                href={routes.home}
                aria-label={copy.nav.home}
                className={cn("items-center rounded-md lg:hidden", collapsed ? "lg:flex" : "flex")}
              >
                <LogoMark size={20} />
              </Link>
            </div>
            <div className="pointer-events-auto flex items-center gap-2">
              {demoHint ? (
                <span title={demoHint}>
                  <Tag tone="neutral">{copy.demo}</Tag>
                </span>
              ) : null}
              {corner}
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
