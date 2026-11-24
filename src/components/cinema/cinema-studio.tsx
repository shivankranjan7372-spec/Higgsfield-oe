"use client";

import { Menu, PanelLeft, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LoginDialog } from "@/components/entry/login-dialog";
import { LogoMark } from "@/components/brand/logo";
import { cinema } from "@/content/cinema";
import { routes } from "@/content/site";
import { ButtonLink, cn } from "@/ui";
import { CastDialog } from "./cast";
import { CinemaComposer } from "./composer";
import { Sidebar } from "./sidebar";
import { Stage } from "./stage";
import { CinemaProvider, useCinema } from "./state";
import { Storyboard } from "./storyboard";
import { Takes } from "./takes";

const c = cinema.composer;

/** The server's own sentence, next to the composer, with a way out. */
function Problem() {
  const { problem, setProblem, session } = useCinema();
  const [login, setLogin] = useState(false);
  if (!problem) return null;
  const needsAccount = problem.status === 401 || problem.status === 403;
  const needsCredits = problem.status === 402;
  return (
    <div role="alert" className="flex w-full max-w-[876px] items-center gap-3 rounded-xl border border-[#FF6B6B33] bg-[#FF6B6B14] px-3 py-2 text-sm leading-5 text-text-primary">
      <span className="min-w-0 flex-1">{problem.message}</span>
      {needsAccount && !session.member ? (
        <button type="button" onClick={() => setLogin(true)} className="shrink-0 rounded-md bg-brand px-3 py-1 text-xs leading-4 font-semibold text-ink">
          {cinema.account.join}
        </button>
      ) : null}
      {needsCredits ? (
        <ButtonLink href={routes.pricing} variant="white" size="pill-xs">
          {cinema.account.pricing}
        </ButtonLink>
      ) : null}
      <button
        type="button"
        aria-label={c.dismiss}
        onClick={() => setProblem(null)}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-border-subtle hover:text-text-primary"
      >
        <X className="size-4" strokeWidth={1.5} aria-hidden />
      </button>
      <LoginDialog open={login} onOpenChange={setLogin} mode="join" next={routes.cinema} />
    </div>
  );
}

/** The prompt the server will send for the open shot, and its notes. */
function ComposedPrompt() {
  const { composed, shot, mode } = useCinema();
  const [all, setAll] = useState(false);
  if (!shot || !composed.data) return null;
  const notes = [...composed.data.notes];
  if (mode === "animate") notes.unshift(c.animateFrom);
  if (mode === "text") notes.unshift(c.textVideo);
  return (
    <div className="flex w-full max-w-[876px] flex-col gap-1 px-2 sm:pl-[78px]" aria-live="polite">
      <span className="font-mono text-2xs leading-[14px] font-medium text-text-tertiary">{c.prompt}</span>
      <p data-testid="composed-prompt" className={cn("text-xs leading-[18px] text-text-secondary", !all && "line-clamp-2")}>
        {composed.data.prompt}
      </p>
      {composed.data.prompt.length > 180 ? (
        <button type="button" onClick={() => setAll(!all)} className="self-start text-xs leading-4 font-medium text-text-tab hover:text-text-primary">
          {all ? c.hidePrompt : c.showPrompt}
        </button>
      ) : null}
      {notes.map((n) => (
        <span key={n} className="text-xs leading-4 text-text-tertiary">
          {n}
        </span>
      ))}
    </div>
  );
}

/** The takes and the storyboard. A visitor with no project sees only the composer, as drawn. */
function Below() {
  const { projectId } = useCinema();
  if (!projectId) return null;
  return (
    <div className="mt-16 flex w-full flex-col items-center gap-10">
      <Takes />
      <Storyboard />
    </div>
  );
}

function Workspace() {
  const [collapsed, setCollapsed] = useState(false);
  const [sheet, setSheet] = useState(false);

  return (
    <div className="flex h-dvh w-full gap-1 overflow-hidden bg-surface-primary p-1">
      {/* Desktop: the drawn sidebar. Phone: a sheet over the page. */}
      <aside className={cn("hidden w-[231px] shrink-0", !collapsed && "lg:flex")}>
        <Sidebar onCollapse={() => setCollapsed(true)} />
      </aside>
      {sheet ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <button type="button" aria-label={cinema.sidebar.close} className="absolute inset-0 animate-fade-in bg-scrim" onClick={() => setSheet(false)} />
          <aside className="relative z-10 flex h-full w-[min(280px,85vw)] animate-rise-in p-1">
            <Sidebar onCollapse={() => setSheet(false)} onNavigate={() => setSheet(false)} />
          </aside>
        </div>
      ) : null}

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface-primary">
        <div className="flex h-12 shrink-0 items-center gap-2 px-2 lg:hidden">
          <button
            type="button"
            aria-label={cinema.sidebar.open}
            onClick={() => setSheet(true)}
            className="flex size-9 items-center justify-center rounded-xl bg-border-subtle text-text-primary hover:bg-border-default"
          >
            <Menu className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
          <Link href={routes.home} aria-label={cinema.homeLabel} className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-border-subtle">
            <LogoMark size={24} />
            <span className="text-sm leading-5 font-medium text-text-primary">{cinema.studioName}</span>
          </Link>
        </div>
        {collapsed ? (
          <button
            type="button"
            aria-label={cinema.sidebar.expand}
            onClick={() => setCollapsed(false)}
            className="absolute top-2 left-2 z-10 hidden size-9 items-center justify-center rounded-xl bg-border-subtle text-text-primary hover:bg-border-default lg:flex"
          >
            <PanelLeft className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
        ) : null}
        <div id="cinema-top" className="scroll-quiet flex min-h-0 flex-1 flex-col items-center overflow-x-hidden overflow-y-auto px-2 pt-6 pb-16 sm:px-[10px] lg:pt-[108px]">
          <Stage />
          <div className="mt-6 flex w-full flex-col items-center gap-3 sm:mt-[38px]">
            <CinemaComposer />
            <Problem />
            <ComposedPrompt />
          </div>
          <Below />
        </div>
      </main>
      <CastDialog />
    </div>
  );
}

/** The Shot Planner: plan a film shot by shot, then make stills and takes for each shot. */
export function CinemaStudio() {
  return (
    <CinemaProvider>
      <Workspace />
    </CinemaProvider>
  );
}
