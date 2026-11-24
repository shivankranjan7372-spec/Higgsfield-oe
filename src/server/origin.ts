import "server-only";

import type { NextRequest } from "next/server";

/**
 * The app's own address, as people reach it.
 *
 * On a laptop that is simply the address of the request. Behind a proxy or a public link the
 * server may only see an inner address, so the operator names the outer one in PARALLAX_ORIGIN
 * (for example https://parallax.example.com).
 */

/** PARALLAX_ORIGIN as a clean origin, or null when it is unset or not an address. */
export function configuredOrigin(): string | null {
  const raw = process.env.PARALLAX_ORIGIN?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/** The origin to put in links the server writes for a browser to open. */
export function publicOrigin(req: NextRequest): string {
  return configuredOrigin() ?? req.nextUrl.origin;
}

/**
 * True when a browser request comes from one of our own pages. A request counts as ours when
 * its Origin names the host it was sent to, or the configured public address.
 */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // Non-browser clients send no Origin, and carry no ambient cookie either.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    const from = new URL(origin);
    return from.host === host || from.origin === configuredOrigin();
  } catch {
    return false;
  }
}
