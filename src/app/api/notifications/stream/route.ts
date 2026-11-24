import { intParam, route } from "@/server/http";
import { subscribe, syncNotices, unreadCount, type Notice } from "@/server/notify";

/** How often the stream re-checks jobs and balance, since the worker has no hooks yet. */
const SYNC_MS = 3000;

/**
 * GET /api/notifications/stream?heartbeat=15&timeout=300
 * Server-sent events for the signed-in member:
 *   event: ready   data: { unread }           once, on open
 *   event: notice  data: { notice, unread }   a new notice
 *   event: unread  data: { unread }           the count changed (read, deleted)
 *   event: bye     data: { reconnect: true }  the server is closing; EventSource reconnects by itself
 *   ": ping"                                  heartbeat comment, ignored by EventSource
 */
export const GET = route(({ req, user }) => {
  const heartbeatMs = intParam(req, "heartbeat", 15, 1, 60) * 1000;
  const lifetimeMs = intParam(req, "timeout", 300, 1, 900) * 1000;
  const encoder = new TextEncoder();
  let stop = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          stop();
        }
      };
      const event = (name: string, data: unknown) => send(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);

      const unsubscribe = subscribe(user.id, (e) => {
        if (e.event === "notice") event("notice", e.data as { notice: Notice; unread: number });
        else event("unread", e.data);
      });
      const beat = setInterval(() => send(`: ping ${Date.now()}\n\n`), heartbeatMs);
      const tick = setInterval(() => {
        try {
          syncNotices(user.id);
        } catch (err) {
          console.error("[notify] sync failed:", (err as Error).message);
        }
      }, SYNC_MS);
      const end = setTimeout(() => {
        event("bye", { reconnect: true });
        stop();
      }, lifetimeMs);

      stop = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(beat);
        clearInterval(tick);
        clearTimeout(end);
        req.signal.removeEventListener("abort", stop);
        try {
          controller.close();
        } catch {
          /* already closed by the client */
        }
      };
      req.signal.addEventListener("abort", stop);

      send("retry: 3000\n\n");
      syncNotices(user.id, true); // may emit "notice" events through the subscription above
      event("ready", { unread: unreadCount(user.id) });
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
