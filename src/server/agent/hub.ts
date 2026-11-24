import "server-only";

/**
 * One Server-Sent Events stream per member. Everything the screens need to stay live
 * (row upserts, chat changes, computer state) goes through `publish`.
 */

type Send = (event: string, data: unknown) => void;
interface Sub {
  send: Send;
  close: () => void;
}

const MAX_STREAMS = 4; // tabs per member; the oldest is closed past this

const subs: Map<string, Sub[]> = ((globalThis as unknown as { __agentHub?: Map<string, Sub[]> }).__agentHub ??= new Map());

export function publish(userId: string, event: string, data: unknown) {
  for (const s of subs.get(userId) ?? []) {
    try {
      s.send(event, data);
    } catch {
      /* a closed stream is removed by its own cleanup */
    }
  }
}

export function openStream(userId: string, signal: AbortSignal): Response {
  const enc = new TextEncoder();
  let sub: Sub | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      const cleanup = () => {
        if (!open) return;
        open = false;
        if (timer) clearInterval(timer);
        const list = (subs.get(userId) ?? []).filter((s) => s !== sub);
        if (list.length) subs.set(userId, list);
        else subs.delete(userId);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      sub = {
        send: (event, data) => {
          if (open) controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        },
        close: cleanup,
      };
      const list = subs.get(userId) ?? [];
      list.push(sub);
      while (list.length > MAX_STREAMS) list.shift()!.close();
      subs.set(userId, list);
      // A padded first event gets past buffers that hold small responses back.
      controller.enqueue(enc.encode(`: ${" ".repeat(1024)}\n\nevent: ready\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`));
      timer = setInterval(() => {
        if (open) controller.enqueue(enc.encode(`: ping\n\n`));
      }, 20_000);
      signal.addEventListener("abort", cleanup);
    },
    cancel() {
      sub?.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
