"use client";

import { useEffect, useRef } from "react";

/*
 * Live streams (server-sent events), shared.
 *
 * A browser allows only six connections to one site at a time, and a live stream holds one for
 * as long as it is open. A few streams left open by other tabs, or by pages kept in the
 * back/forward cache, are enough to make every other request on the site wait in line.
 *
 * So each stream has at most one connection per tab, however many parts of the page listen, and
 * none while the tab is hidden. The server sends `ready` on every new connection, which is the
 * signal for listeners to catch up on whatever they missed.
 */

export type LiveListener = (event: string, data: unknown) => void;

/** Sent to listeners when the connection drops or is closed while they are still listening. */
export const STREAM_DOWN = "$down";

export interface LiveStream {
  /** Starts listening and returns the function that stops. The connection opens with the first listener and closes with the last. */
  subscribe(listener: LiveListener): () => void;
}

const FIRST_RETRY_MS = 3000;
const LAST_RETRY_MS = 60_000;

/** A shared connection to one stream address. `events` are the event names the server sends. */
export function liveStream(url: string, events: readonly string[]): LiveStream {
  const listeners = new Set<LiveListener>();
  let source: EventSource | null = null;
  let timer: number | undefined;
  let delay = FIRST_RETRY_MS;

  const emit = (event: string, data: unknown) => {
    for (const l of [...listeners]) l(event, data);
  };

  function close() {
    window.clearTimeout(timer);
    timer = undefined;
    if (!source) return;
    source.close();
    source = null;
    emit(STREAM_DOWN, null);
  }

  function open() {
    window.clearTimeout(timer);
    timer = undefined;
    if (source || listeners.size === 0 || typeof EventSource === "undefined") return;
    if (document.visibilityState !== "visible") return;
    const es = new EventSource(url);
    source = es;
    for (const name of events) {
      es.addEventListener(name, (e) => {
        delay = FIRST_RETRY_MS;
        let data: unknown = null;
        try {
          data = JSON.parse((e as MessageEvent).data);
        } catch {
          /* an event without a readable body is still a signal */
        }
        emit(name, data);
      });
    }
    es.onerror = () => {
      if (source !== es) return;
      emit(STREAM_DOWN, null);
      // While it says "connecting" the browser retries by itself. Closed means the server refused:
      // try again ourselves, more slowly each time.
      if (es.readyState !== EventSource.CLOSED) return;
      es.close();
      source = null;
      timer = window.setTimeout(open, delay);
      delay = Math.min(delay * 2, LAST_RETRY_MS);
    };
  }

  const onVisibility = () => (document.visibilityState === "visible" ? open() : close());

  return {
    subscribe(listener) {
      if (listeners.size === 0) {
        document.addEventListener("visibilitychange", onVisibility);
        // A page kept in the back/forward cache must let go of its connection, and take it back on return.
        window.addEventListener("pagehide", close);
        window.addEventListener("pageshow", open);
      }
      listeners.add(listener);
      open();
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("pagehide", close);
        window.removeEventListener("pageshow", open);
        close();
      };
    },
  };
}

/** Listens to a shared stream for as long as the component is shown and `enabled` is true. */
export function useLiveStream(stream: LiveStream, onEvent: LiveListener, enabled = true) {
  const latest = useRef(onEvent);
  useEffect(() => {
    latest.current = onEvent;
  });
  useEffect(() => {
    if (!enabled) return;
    return stream.subscribe((event, data) => latest.current(event, data));
  }, [stream, enabled]);
}

/** The signed-in member's notifications: `ready` and `unread` carry the count, `notice` a new notice. */
export const notificationStream = liveStream("/api/notifications/stream", ["ready", "notice", "unread"]);
