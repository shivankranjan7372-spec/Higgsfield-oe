"use client";

import { useSyncExternalStore } from "react";

/*
 * Pages are prerendered as static shells, so nothing may read the clock or the address bar
 * while rendering on the server. These hooks answer "not known yet" there and the real value
 * in the browser, without a hydration mismatch.
 */

function everySecond(onTick: () => void) {
  const id = window.setInterval(onTick, 1000);
  return () => window.clearInterval(id);
}

/** The time in whole seconds since 1970, ticking once a second. Null until the page is live. */
export function useNow(): number | null {
  return useSyncExternalStore(
    everySecond,
    () => Math.floor(Date.now() / 1000),
    () => null,
  );
}

function onAddressChange(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

/**
 * One value from the address bar's query string (`?model=...`), or null. Use this instead of
 * `useSearchParams`, which would force the page out of the static shell.
 */
export function useQueryParam(name: string): string | null {
  const search = useSyncExternalStore(
    onAddressChange,
    () => window.location.search,
    () => "",
  );
  return new URLSearchParams(search).get(name);
}

const noSubscribe = () => () => {};

/** False on the server and during hydration, true afterwards. */
export function useLive(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}
