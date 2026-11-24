"use client";

import { useEffect, useRef } from "react";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/lib/api";
import { STREAM_DOWN, liveStream } from "@/lib/live";
import { copy } from "@/content/agent";
import { useSession } from "@/lib/session";
import type { Chat, ComputerStatus, ConnectorApp, McpServer, Project, Row, ShowcaseItem, Skill, AgentConfig } from "./types";

export const keys = {
  config: "/api/agent/config",
  showcase: "/api/agent/showcase",
  chats: "/api/agent/chats?limit=50",
  projects: "/api/agent/projects",
  skills: "/api/agent/skills",
  connectors: "/api/agent/connectors",
  schedules: "/api/agent/schedules",
  memory: "/api/agent/memory",
  mcp: "/api/agent/connectors/mcp",
} as const;

/** Only ask member-only routes once there is an account (a guest counts). */
function useMemberKey(key: string | null) {
  const { user } = useSession();
  return user && key ? key : null;
}

export function useConfig() {
  return useSWR<AgentConfig>(useMemberKey(keys.config), fetcher, { revalidateOnFocus: false });
}

export function useShowcase() {
  return useSWR<{ items: ShowcaseItem[]; categories: string[] }>(keys.showcase, fetcher, { revalidateOnFocus: false });
}

export function useChats() {
  return useSWR<{ chats: Chat[] }>(useMemberKey(keys.chats), fetcher);
}

export function useProjects() {
  return useSWR<{ projects: Project[] }>(useMemberKey(keys.projects), fetcher);
}

export function useSkills() {
  return useSWR<{ skills: Skill[] }>(useMemberKey(keys.skills), fetcher);
}

export function useConnectors() {
  return useSWR<{ apps: ConnectorApp[]; connected: { app: string; status: string; connectedAt: number }[]; mcpServers: McpServer[] }>(
    useMemberKey(keys.connectors),
    fetcher,
  );
}

/**
 * What the "demo" tag should say on this page, or null when what the page shows is live.
 * It names what is a stand-in, so the tag never claims more (or less) than is true.
 */
export function useDemoHint(page?: string): string | null {
  const { data } = useConfig();
  if (!data) return null;
  const s = data.services ?? {};
  if (s.llm !== "live") return copy.demoHint;
  const computer = s.computer !== "live";
  const connectors = s.connectors !== "live";
  // An outside engine is never handed a stand-in service, so only that service's own page is a demo.
  if (data.engine && data.engine.id !== "builtin") return connectors && page === "connectors" ? copy.demoConnectors : null;
  if (computer && connectors) return copy.demoParts.both;
  if (computer) return copy.demoParts.computer;
  if (connectors) return copy.demoParts.connectors;
  return null;
}

/* ------------------------------ the live stream ------------------------------ */

type Listener = (event: string, data: unknown) => void;
const listeners = new Set<Listener>();
// One connection per tab, closed while the tab is hidden. A fresh `ready` tells listeners to catch up.
const stream = liveStream("/api/agent/events", ["ready", "row", "chat", "chat-deleted", "computer"]);
let stop: (() => void) | null = null;

function emit(event: string, data: unknown) {
  if (event === STREAM_DOWN) return;
  listsListener(event, data);
  for (const l of [...listeners]) l(event, data);
}

/** Keeps the chat list in step with the stream, wherever the sidebar is shown. */
function listsListener(event: string, data: unknown) {
  if (event === "chat") {
    const chat = (data as { chat?: Chat })?.chat;
    if (!chat) return;
    void mutate(
      keys.chats,
      (prev: { chats: Chat[] } | undefined) => {
        if (!prev) return prev;
        const others = prev.chats.filter((c) => c.id !== chat.id);
        return { chats: sortChats([chat, ...others]) };
      },
      { revalidate: false },
    );
  } else if (event === "chat-deleted") {
    const id = (data as { chatId?: string })?.chatId;
    void mutate(keys.chats, (prev: { chats: Chat[] } | undefined) => (prev ? { chats: prev.chats.filter((c) => c.id !== id) } : prev), {
      revalidate: false,
    });
  } else if (event === "ready") {
    void mutate(keys.chats);
  }
}

export function sortChats(chats: Chat[]) {
  return [...chats].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
}

/** Subscribes to the member's event stream. One connection per tab, shared by every caller. */
export function useAgentEvents(onEvent: Listener) {
  const { user } = useSession();
  const ref = useRef(onEvent);
  useEffect(() => {
    ref.current = onEvent;
  });
  useEffect(() => {
    if (!user) return;
    const l: Listener = (e, d) => ref.current(e, d);
    listeners.add(l);
    stop ??= stream.subscribe(emit);
    return () => {
      listeners.delete(l);
      if (listeners.size > 0) return;
      stop?.();
      stop = null;
    };
  }, [user]);
}

export type { Row, ComputerStatus };
