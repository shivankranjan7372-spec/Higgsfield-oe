"use client";

import { Clapperboard, Gamepad2, HatGlasses, LayoutGrid, LayoutTemplate, Megaphone, Sparkle, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { mutate } from "swr";
import { LogoMark } from "@/components/brand/logo";
import { categoryIcons, copy, agentRoutes } from "@/content/agent";
import { api, errorMessage } from "@/lib/api";
import { ensureSession } from "@/lib/session";
import { Artwork, Button, cn } from "@/ui";
import { AgentComposer, type SendInput } from "./composer";
import { ContextRow } from "./context-row";
import { keys, sortChats, useShowcase } from "./data";
import { GlassTile } from "./icons";
import { AgentShell } from "./shell";
import type { Chat, ShowcaseItem } from "./types";

const pillIcons = { all: LayoutGrid, marketing: Megaphone, video: Clapperboard, apps: LayoutTemplate, games: Gamepad2 } as const;

/** Hands a first message to the chat page, which shows it as soon as it opens. */
export const pending: { chatId: string | null } = { chatId: null };

function Card({ item, onUse }: { item: ShowcaseItem; onUse: (item: ShowcaseItem) => void }) {
  const Icon = pillIcons[categoryIcons[item.category] ?? "all"];
  return (
    <li>
      <button
        type="button"
        onClick={() => onUse(item)}
        aria-label={`${copy.gallery.use}: ${item.title}`}
        className="group flex w-full flex-col items-center gap-[10px] rounded-2xl p-[10px] text-left transition-colors duration-150 hover:bg-border-subtle"
      >
        <div className="relative aspect-[367/215] w-full overflow-clip rounded-lg bg-surface-secondary-strong">
          <Artwork name={`agent/showcase-${item.id}`} className="size-full transition-transform duration-300 ease-out-soft group-hover:scale-[1.03]" />
          <p className="absolute inset-x-0 bottom-0 line-clamp-3 bg-gradient-to-t from-[#000000B3] to-transparent px-3 pt-8 pb-3 text-xs leading-4 text-text-soft opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:hidden">
            {item.prompt}
          </p>
        </div>
        <div className="flex h-7 w-full items-center justify-between gap-2 pl-1">
          <span className="flex min-w-0 items-center gap-2">
            <GlassTile icon={Icon} />
            <span className="truncate text-sm leading-5 font-medium text-text-primary">{item.title}</span>
          </span>
          <span className="flex h-[18px] shrink-0 items-center gap-1 text-xs leading-[18px] font-medium text-text-muted">
            {item.skillId ? <Zap className="size-4" strokeWidth={1.5} aria-hidden /> : <Sparkle className="size-4" strokeWidth={1.5} aria-hidden />}
            {item.skillId ? copy.gallery.skill : copy.gallery.prompt}
          </span>
        </div>
      </button>
    </li>
  );
}

function Gallery({ onUse }: { onUse: (item: ShowcaseItem) => void }) {
  const { data, error, isLoading, mutate: reload } = useShowcase();
  const [cat, setCat] = useState("All");
  const cats = data?.categories ?? [];
  const items = (data?.items ?? []).filter((i) => cat === "All" || i.category === cat);

  return (
    <section aria-label={copy.gallery.use} className="flex w-full flex-col items-center gap-8 px-3 pt-7 pb-10">
      <div role="tablist" aria-label="Categories" className="flex h-8 max-w-full items-center justify-start gap-[6px] overflow-x-auto scroll-none sm:justify-center">
        {isLoading
          ? [55, 98, 134, 70, 80].map((w, i) => <span key={i} className="shimmer h-8 shrink-0 rounded-md bg-surface-secondary" style={{ width: w }} />)
          : cats.map((c) => {
              const Icon = pillIcons[categoryIcons[c] ?? "all"];
              const on = c === cat;
              return (
                <button
                  key={c}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setCat(c)}
                  className={cn(
                    "flex h-8 shrink-0 items-center justify-center gap-1 rounded-md px-2 text-xs leading-4 font-medium transition-colors duration-150",
                    on ? "bg-surface-glass text-text-primary backdrop-blur-[24px] [box-shadow:#FFFFFF0D_0px_2px_3px_inset,#0000001F_0px_2px_4px_-0.5px]" : "text-text-tab hover:bg-border-subtle hover:text-text-primary",
                  )}
                  style={on ? { backgroundImage: "linear-gradient(in oklab 139deg, #FFFFFF0A 22.6%, #FFFFFF0F 51.3%, #FFFFFF05 79.9%)" } : undefined}
                >
                  <Icon className="size-4" strokeWidth={1.5} aria-hidden />
                  <span className="px-1">{c}</span>
                </button>
              );
            })}
      </div>
      {error ? (
        <div role="alert" className="flex flex-col items-center gap-3 py-10 text-sm leading-5 text-text-secondary">
          {errorMessage(error) || copy.gallery.error}
          <Button variant="outline" onClick={() => void reload()}>
            {copy.retry}
          </Button>
        </div>
      ) : (
        <ul className="grid w-full max-w-[1180px] grid-cols-1 gap-x-[10px] gap-y-[10px] sm:grid-cols-2 xl:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="flex flex-col gap-[10px] p-[10px]" aria-hidden>
                  <div className="shimmer aspect-[367/215] w-full rounded-lg bg-surface-secondary" />
                  <div className="shimmer h-7 w-1/2 rounded-md bg-surface-secondary" />
                </li>
              ))
            : items.map((item) => <Card key={item.id} item={item} onUse={onUse} />)}
        </ul>
      )}
    </section>
  );
}

/** The private-chat switch in the pane's top-right corner. */
export function IncognitoToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? copy.incognito.on : copy.incognito.off}
      title={on ? copy.incognito.on : copy.incognito.off}
      onClick={() => onChange(!on)}
      className={cn(
        "flex size-8 items-center justify-center rounded-full transition-colors duration-150",
        on ? "bg-brand text-ink hover:bg-brand-glow" : "text-text-primary hover:bg-border-subtle",
      )}
    >
      <HatGlasses className="size-4" strokeWidth={1.5} aria-hidden />
    </button>
  );
}

/** The agent home: the headline, the composer with its context row, and the examples. */
export function AgentHome() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [incognito, setIncognito] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  const send = async (input: SendInput) => {
    await ensureSession();
    try {
      const { chat } = await api<{ chat: Chat }>("/api/agent/chats", {
        method: "POST",
        body: { ...(incognito ? { incognito: true } : { projectId: projectId ?? undefined }), skillIds },
      });
      await api(`/api/agent/chats/${chat.id}/messages`, { method: "POST", body: input });
      void mutate(keys.chats, (prev: { chats: Chat[] } | undefined) => (prev ? { chats: sortChats([chat, ...prev.chats.filter((c) => c.id !== chat.id)]) } : prev), {
        revalidate: true,
      });
      pending.chatId = chat.id;
      setText("");
      router.push(`${agentRoutes.chat}/${chat.id}`);
      return true;
    } catch (e) {
      throw new Error(errorMessage(e));
    }
  };

  const useExample = (item: ShowcaseItem) => {
    setText(item.prompt);
    if (item.skillId) setSkillIds((ids) => (ids.includes(item.skillId!) ? ids : [...ids, item.skillId!].slice(0, 10)));
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => document.getElementById("agent-prompt")?.focus(), 250);
  };

  return (
    <AgentShell active="new" corner={<IncognitoToggle on={incognito} onChange={setIncognito} />}>
      <div className="min-h-0 flex-1 overflow-y-auto scroll-quiet" ref={top}>
        <div className="relative flex w-full items-center justify-center px-3 pt-20 pb-2 sm:min-h-[484px] sm:pt-0 sm:pb-0">
          <div className="flex w-full max-w-[694px] flex-col items-center gap-5">
            <h1 className="flex items-center gap-3 text-center font-display text-xl leading-7 font-bold tracking-[-0.025em] text-text-primary uppercase sm:text-3xl sm:leading-8">
              <LogoMark size={40} className="hidden rounded-sm sm:block" />
              {copy.headline}
            </h1>
            <div className="w-full max-w-[680px]">
              <AgentComposer
                value={text}
                onChange={setText}
                onSend={send}
                autoFocus
                below={
                  incognito ? (
                    <p className="flex h-11 items-center gap-2 px-3 text-xs leading-4 font-medium text-text-secondary">
                      <HatGlasses className="size-4" strokeWidth={1.5} aria-hidden />
                      {copy.incognito.on}
                    </p>
                  ) : (
                    <div className="mt-[2px]">
                      <ContextRow projectId={projectId} onProject={setProjectId} skillIds={skillIds} onSkills={setSkillIds} />
                    </div>
                  )
                }
              />
            </div>
          </div>
        </div>
        <Gallery onUse={useExample} />
      </div>
    </AgentShell>
  );
}
