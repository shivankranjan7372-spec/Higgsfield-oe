"use client";

import { HatGlasses, Pin } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { copy, agentRoutes } from "@/content/agent";
import { api, ApiError, errorMessage, fetcher } from "@/lib/api";
import { useSession } from "@/lib/session";
import { ButtonLink, Spinner } from "@/ui";
import { AgentComposer, type SendInput } from "./composer";
import { ContextRow } from "./context-row";
import { keys, sortChats, useAgentEvents } from "./data";
import { RowView, ToolGroup } from "./rows";
import { AgentShell } from "./shell";
import type { Chat, ComputerStatus, Row, Turn } from "./types";

type Item = { type: "row"; row: Row } | { type: "tools"; rows: Row[] };

/** Rows sorted by seq, with each run of tool calls folded into one block. */
function group(rows: Row[]): Item[] {
  const out: Item[] = [];
  for (const row of rows) {
    const last = out[out.length - 1];
    if (row.kind === "tool-call") {
      if (last?.type === "tools") last.rows.push(row);
      else out.push({ type: "tools", rows: [row] });
    } else out.push({ type: "row", row });
  }
  return out;
}

function Skeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 pt-20" aria-label={copy.chat.loading}>
      <div className="shimmer ml-auto h-10 w-2/3 rounded-2xl bg-surface-secondary" />
      <div className="shimmer h-16 w-5/6 rounded-2xl bg-surface-secondary" />
      <div className="shimmer h-24 w-full rounded-2xl bg-surface-secondary" />
    </div>
  );
}

export function AgentChat({ id }: { id: string }) {
  const { user, loading: sessionLoading } = useSession();
  const [rows, setRows] = useState<Map<number, Row>>(() => new Map());
  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState<string | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const [text, setText] = useState("");
  const [computer, setComputer] = useState<ComputerStatus | null>(null);
  const rev = useRef(0);
  const gone = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const upsert = useCallback((list: Row[]) => {
    if (!list.length) return;
    setRows((prev) => {
      const next = new Map(prev);
      for (const r of list) {
        const old = next.get(r.seq);
        if (!old || old.updatedSeq <= r.updatedSeq) next.set(r.seq, r);
        rev.current = Math.max(rev.current, r.updatedSeq);
      }
      return next;
    });
  }, []);

  /** Reads every change after the newest one we hold. */
  const catchUp = useCallback(async () => {
    try {
      for (let i = 0; i < 20; i++) {
        const res = await api<{ chat: Chat; rows: Row[]; rev: number }>(`/api/agent/chats/${id}/rows?after=${rev.current}&limit=500`);
        setChat(res.chat);
        upsert(res.rows);
        if (res.rows.length < 500) break;
        rev.current = Math.max(rev.current, res.rev);
      }
      setLoaded(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) gone.current = true;
      setMissing(errorMessage(e));
      setLoaded(true);
    }
  }, [id, upsert]);

  useEffect(() => {
    if (sessionLoading || !user) return;
    void catchUp();
    void api<{ computer: ComputerStatus }>("/api/agent/computer")
      .then((r) => setComputer(r.computer))
      .catch(() => {});
  }, [catchUp, user, sessionLoading]);

  // Leaving the chat: a private chat is deleted by the server.
  useEffect(() => {
    return () => {
      if (gone.current) return;
      void fetch(`/api/agent/chats/${id}/close`, { method: "POST", keepalive: true, credentials: "same-origin" }).catch(() => {});
    };
  }, [id]);

  useAgentEvents((event, data) => {
    if (event === "row") {
      const r = data as Row;
      if (r?.chatId === id) upsert([r]);
    } else if (event === "chat") {
      const c = (data as { chat?: Chat })?.chat;
      if (c?.id === id) setChat(c);
    } else if (event === "chat-deleted") {
      if ((data as { chatId?: string })?.chatId === id) {
        gone.current = true;
        setMissing(copy.chat.notFound);
      }
    } else if (event === "computer") {
      setComputer(data as ComputerStatus);
    } else if (event === "ready") {
      void catchUp();
    }
  });

  // Turns, for the queued count; refreshed whenever the chat changes state.
  const turns = useSWR<{ chat: Chat; turns: Turn[] }>(user && loaded && !missing ? `/api/agent/chats/${id}#${chat?.state}-${chat?.rev}` : null, (k: string) => fetcher<{ chat: Chat; turns: Turn[] }>(k.split("#")[0]));
  const queued = turns.data?.turns.filter((t) => t.status === "queued").length ?? 0;

  const sorted = useMemo(() => [...rows.values()].sort((a, b) => a.seq - b.seq), [rows]);
  const items = useMemo(() => group(sorted), [sorted]);
  const signedOut = !sessionLoading && !user;
  const running = chat?.state === "running" || chat?.state === "waiting";

  // Follow the newest row unless the member scrolled up to read.
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [items]);

  const send = async (input: SendInput) => {
    stick.current = true;
    const res = await api<{ turn: Turn; row: Row }>(`/api/agent/chats/${id}/messages`, { method: "POST", body: input });
    upsert([res.row]);
    setText("");
    return true;
  };

  const stop = async () => {
    try {
      await api(`/api/agent/chats/${id}/stop`, { method: "POST" });
    } catch {}
  };

  const patch = async (body: Record<string, unknown>) => {
    try {
      const { chat: next } = await api<{ chat: Chat }>(`/api/agent/chats/${id}`, { method: "PATCH", body });
      setChat(next);
      void mutate(keys.chats, (prev: { chats: Chat[] } | undefined) => (prev ? { chats: sortChats(prev.chats.map((c) => (c.id === next.id ? next : c))) } : prev), {
        revalidate: false,
      });
    } catch {}
  };

  return (
    <AgentShell active="chat" activeChat={id}>
      {/* The title sits in the corner row, centred. */}
      <div className="pointer-events-none absolute top-5 right-20 left-24 z-30 flex h-8 items-center justify-center gap-2 lg:left-28">
        {chat?.pinned ? <Pin className="size-3 shrink-0 text-text-secondary" strokeWidth={1.5} aria-label={copy.chat.pinned} /> : null}
        {chat?.incognito ? <HatGlasses className="size-4 shrink-0 text-brand" strokeWidth={1.5} aria-label={copy.chat.private} /> : null}
        <h1 className="truncate text-sm leading-5 font-medium text-text-primary">{chat?.title || copy.nav.newChat}</h1>
        {running ? <Spinner /> : null}
      </div>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto scroll-quiet"
      >
        {!loaded && !signedOut ? (
          <Skeleton />
        ) : missing || signedOut ? (
          <div role="alert" className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm leading-5 text-text-secondary">{missing ?? copy.chat.notFound}</p>
            <ButtonLink href={agentRoutes.home} variant="lime" size="md">
              {copy.chat.backHome}
            </ButtonLink>
          </div>
        ) : (
          <ol className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-4 pt-20 pb-6" aria-live="polite" aria-label={chat?.title || copy.nav.newChat}>
            {items.length === 0 ? <li className="text-center text-sm leading-5 text-text-secondary">{copy.chat.empty}</li> : null}
            {items.map((it) => (
              <li key={it.type === "row" ? it.row.seq : `t${it.rows[0].seq}`} className="animate-fade-in">
                {it.type === "row" ? <RowView row={it.row} /> : <ToolGroup rows={it.rows} computer={computer} />}
              </li>
            ))}
            {chat?.state === "running" && sorted[sorted.length - 1]?.kind === "message" && sorted[sorted.length - 1]?.body.role === "user" ? (
              <li className="ml-9 flex items-center gap-2 text-xs leading-4 text-text-secondary">
                <Spinner />
                {copy.chat.working}
              </li>
            ) : null}
          </ol>
        )}
      </div>
      {loaded && !missing && !signedOut ? (
        <div className="shrink-0 px-3 pb-3">
          <div className="mx-auto w-full max-w-[680px]">
            {queued ? <p className="px-3 pb-2 text-xs leading-4 text-text-secondary">{`${copy.chat.queued}: ${queued}`}</p> : null}
            <AgentComposer
              value={text}
              onChange={setText}
              onSend={send}
              running={running}
              onStop={() => void stop()}
              placeholder={copy.chatPlaceholder}
              below={
                chat && !chat.incognito ? (
                  <div className="hidden sm:block">
                    <ContextRow projectId={chat.projectId} onProject={(p) => void patch({ projectId: p })} skillIds={chat.skillIds} onSkills={(s) => void patch({ skillIds: s })} />
                  </div>
                ) : null
              }
            />
          </div>
        </div>
      ) : null}
    </AgentShell>
  );
}
