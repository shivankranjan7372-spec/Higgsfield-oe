"use client";

import { useState } from "react";
import { type AudioSurface } from "@/content/audio";
import type { Job } from "@/lib/api";
import { useQueryParam } from "@/lib/browser";
import { useJobs, useStudio } from "@/lib/studio";
import { getModel } from "@/registry";
import { AudioForm } from "./audio-form";
import { AudioHistory } from "./history";

/** `?tab=music`, or a music model in `?model=`, opens the Music tab. */
function fromAddress(tab: string | null, model: string | null): AudioSurface | null {
  if (tab === "speech" || tab === "music") return tab;
  const m = getModel(model);
  if (m?.surfaces.includes("music")) return "music";
  if (m?.surfaces.includes("speech")) return "speech";
  return null;
}

/**
 * The Audio page: the form on the left (Text to Speech and Music, one `useStudio` each), and
 * on the right the member's own tracks from both, newest first, or the explainer.
 */
export function AudioStudio() {
  const speech = useStudio("speech");
  const music = useStudio("music");
  const speechJobs = useJobs("speech");
  const musicJobs = useJobs("music");
  const tab = useQueryParam("tab");
  const model = useQueryParam("model");
  const [picked, setPicked] = useState<AudioSurface | null>(null);
  const surface = picked ?? fromAddress(tab, model) ?? "speech";

  const jobs = [...speechJobs.jobs, ...musicJobs.jobs].filter((j) => j.status !== "canceled").sort((a, b) => b.createdAt - a.createdAt);

  function use(job: Job) {
    const target: AudioSurface = job.surface === "music" ? "music" : "speech";
    setPicked(target);
    (target === "music" ? music : speech).load(job);
  }

  return (
    <div className="scroll-quiet flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 pt-3 pb-4 lg:flex-row lg:items-start lg:gap-0 lg:overflow-hidden lg:px-4">
      <AudioForm surface={surface} onSurface={setPicked} studios={{ speech, music }} />
      <div className="flex min-w-0 flex-1 flex-col lg:h-full lg:pl-6">
        <AudioHistory surface={surface} jobs={jobs} loading={speechJobs.loading || musicJobs.loading} onUse={use} />
      </div>
    </div>
  );
}
