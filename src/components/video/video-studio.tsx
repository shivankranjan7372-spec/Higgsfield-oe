"use client";

import { Clapperboard, FolderClosed, CircleHelp } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { LoginDialog } from "@/components/entry/login-dialog";
import { routes } from "@/content/site";
import { videoCopy as t, type VideoExample } from "@/content/video";
import type { Asset, Job } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useJobs, useStudio } from "@/lib/studio";
import { Button } from "@/ui";
import { VideoDetail } from "./detail";
import { Examples } from "./examples";
import { History, HistorySkeleton } from "./history";
import { Segmented } from "./segmented";
import { VideoForm, type FormTab } from "./video-form";

type View = "examples" | "history";

/**
 * The Video studio: the settings form on the left, and on the right either the member's own
 * videos or the example gallery. On a phone the two stack and the page scrolls as one.
 */
export function VideoStudio() {
  const studio = useStudio("video");
  const { jobs, loading, working } = useJobs("video");
  const { user, loading: sessionLoading } = useSession();
  const signedOut = !sessionLoading && !user;
  const [tab, setTab] = useState<FormTab>("create");
  const [chosen, setChosen] = useState<View | null>(null);
  const [signIn, setSignIn] = useState(false);
  const [open, setOpen] = useState<{ job: Job; asset: Asset } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLElement>(null);

  const shown = jobs.filter((job) => job.status !== "canceled");
  const view: View =
    chosen ?? (shown.length > 0 || working ? "history" : "examples");

  function applyExample(example: VideoExample) {
    setTab("create");
    studio.setPrompt(example.prompt);
    const box = formRef.current?.querySelector("textarea");
    box?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    box?.focus({ preventScroll: true });
  }

  async function generate() {
    const ok = await studio.generate();
    if (!ok) return;
    setChosen("history");
    // On a phone the gallery sits under the form: bring the new tile into view.
    if (!window.matchMedia("(min-width: 1024px)").matches)
      galleryRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  return (
    <div className="scroll-quiet flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-4 lg:flex-row lg:justify-center lg:overflow-hidden lg:px-4 lg:pb-9">
      <div ref={formRef} className="contents">
        <VideoForm
          studio={studio}
          tab={tab}
          onTab={setTab}
          signedOut={signedOut}
          onSignIn={() => setSignIn(true)}
          onGenerate={() => void generate()}
        />
      </div>

      <section
        ref={galleryRef}
        aria-label="Gallery"
        className="relative flex min-w-0 shrink-0 flex-col overflow-clip rounded-3xl border border-border-default bg-[radial-gradient(circle_farthest-corner_at_50%_50%,#191B1D_0%,#00000000_100%)] lg:h-full lg:max-w-[1080px] lg:flex-1"
      >
        <div className="flex h-14 shrink-0 items-start px-4 pt-2">
          <div className="flex h-9 items-center">
            <Segmented
              label="Gallery"
              value={view}
              onChange={(v) => setChosen(v as View)}
              items={[
                {
                  value: "examples",
                  label: t.views.examples,
                  icon: Clapperboard,
                },
                {
                  value: "history",
                  label: t.views.history,
                  icon: FolderClosed,
                },
              ]}
            />
          </div>
        </div>
        <div className="scroll-quiet min-h-0 flex-1 px-4 pb-6 lg:overflow-y-auto">
          {view === "examples" ? (
            <Examples onUse={applyExample} />
          ) : signedOut ? (
            <Invite
              title={t.history.signedOut}
              body={t.history.signedOutBody}
              action={t.signIn}
              onAction={() => setSignIn(true)}
            />
          ) : loading ? (
            <HistorySkeleton />
          ) : shown.length === 0 ? (
            <Invite
              title={t.history.empty}
              body={t.history.emptyBody}
              action={t.history.emptyAction}
              onAction={() => setChosen("examples")}
            />
          ) : (
            <History
              jobs={shown}
              onOpen={(job, asset) => {
                setOpen({ job, asset });
                setDetailOpen(true);
              }}
            />
          )}
        </div>
        <Link
          href={routes.guide}
          aria-label="Help"
          className="absolute right-3 bottom-4 hidden size-8 items-center justify-center rounded-full border border-border-default bg-surface-secondary text-text-primary transition-colors duration-150 hover:bg-surface-secondary-strong lg:flex"
        >
          <CircleHelp className="size-4" strokeWidth={1.5} aria-hidden />
        </Link>
      </section>

      <VideoDetail
        open={detailOpen}
        onOpenChange={setDetailOpen}
        job={open?.job ?? null}
        asset={open?.asset ?? null}
        onUse={studio.load}
      />
      <LoginDialog
        open={signIn}
        onOpenChange={setSignIn}
        mode="join"
        next={routes.video}
      />
    </div>
  );
}

function Invite({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="flex animate-fade-in flex-col items-center gap-3 px-4 py-24 text-center">
      <p className="font-display text-xl leading-7 font-bold text-text-primary uppercase">
        {title}
      </p>
      <p className="max-w-[360px] text-sm leading-5 text-text-secondary">
        {body}
      </p>
      <Button variant="soft" size="sm" onClick={onAction}>
        {action}
      </Button>
    </div>
  );
}
