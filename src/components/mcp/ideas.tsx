"use client";

import { Check, Clapperboard, Image as ImageIcon, Music, Wallet, Wrench, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { LogoMark } from "@/components/brand/logo";
import { ideaTabs, ideas, ideasSection, type IdeaKind } from "@/content/mcp";
import { Artwork, cn } from "@/ui";
import { useCopy } from "./copy";

const kindIcon: Record<IdeaKind, LucideIcon> = { image: ImageIcon, video: Clapperboard, audio: Music, account: Wallet };
const kindLabel: Record<IdeaKind, string> = { image: "Image", video: "Video", audio: "Audio", account: "Account" };

/** "Things to ask with Parallax": the 3 × 2 grid of example asks. A card copies its prompt. */
export function Ideas() {
  const [tab, setTab] = useState<IdeaKind | "all">("all");
  const shown = tab === "all" ? ideas : ideas.filter((i) => i.kind === tab);

  return (
    <section aria-labelledby="ideas-title" className="flex w-full max-w-[1360px] flex-col gap-7">
      <div className="flex flex-col gap-4">
        <h2 id="ideas-title" className="flex items-center gap-1 text-xl leading-6 font-semibold tracking-[-0.02em] text-text-primary">
          {ideasSection.title}
          <LogoMark size={24} className="mx-[2px]" />
          {ideasSection.titleAfter}
        </h2>
        <div role="tablist" aria-label="Filter examples" className="scroll-none flex h-8 items-center gap-2 overflow-x-auto">
          {ideaTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex h-8 shrink-0 items-center justify-center rounded-md px-3 text-sm leading-4 font-medium text-text-primary transition-colors duration-150",
                tab === t.id ? "bg-border-default backdrop-blur-[40px]" : "hover:bg-border-subtle",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <ul aria-label="Example asks" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} />
        ))}
      </ul>
    </section>
  );
}

function IdeaCard({ idea }: { idea: (typeof ideas)[number] }) {
  const { state, copy } = useCopy();
  const Icon = kindIcon[idea.kind];
  return (
    <li>
      <button
        type="button"
        onClick={() => copy(idea.prompt)}
        title={idea.prompt}
        aria-label={`${idea.title}. ${ideasSection.copyHint}: ${idea.prompt}`}
        className="group relative block aspect-[437/246] w-full overflow-hidden rounded-xl bg-surface-secondary text-left"
      >
        <Artwork name={`mcp/idea-${idea.id}`} className="absolute inset-0 size-full transition-transform duration-300 ease-out-soft group-hover:scale-[1.03]" />
        <div className="absolute inset-x-0 bottom-0 flex h-[88px] flex-col items-start justify-center gap-2 pl-4">
          <div
            aria-hidden
            className="absolute inset-x-0 -top-8 h-[120px] backdrop-blur-[8px]"
            style={{
              backgroundImage: "linear-gradient(180deg, #00000000 0%, #000000B3 100%)",
              maskImage: "linear-gradient(180deg, transparent 0%, #000 35%)",
              WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 35%)",
            }}
          />
          <span className="relative max-w-full truncate pr-4 text-base leading-6 font-medium text-text-primary">{idea.title}</span>
          <span className="relative flex items-center gap-2">
            <Pill icon={Icon}>{kindLabel[idea.kind]}</Pill>
            <Pill icon={Wrench}>{idea.tools[0]}</Pill>
          </span>
        </div>
        <span
          aria-hidden
          className={cn(
            "absolute top-3 right-3 inline-flex h-6 items-center gap-1 rounded-full bg-surface-glass px-2 text-xs leading-4 font-medium text-text-primary backdrop-blur-[12px] transition-opacity duration-150",
            state === "copied" ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
          )}
        >
          {state === "copied" ? <Check className="size-3.5" strokeWidth={1.5} /> : null}
          {state === "copied" ? ideasSection.copied : ideasSection.copyHint}
        </span>
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl shadow-[inset_0_0_0_1px_#FFFFFF1A] transition-shadow duration-150 group-hover:shadow-[inset_0_0_0_1px_#FFFFFF33]" />
      </button>
    </li>
  );
}

function Pill({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center gap-[6px] rounded-full bg-border-subtle px-2 text-xs leading-4 font-medium text-[#FFFFFF80]">
      <Icon className="size-4" strokeWidth={1.5} aria-hidden />
      {children}
    </span>
  );
}
