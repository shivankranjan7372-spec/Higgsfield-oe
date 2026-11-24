import "server-only";

import dns from "node:dns";
import net from "node:net";

/**
 * Webhook URLs are fetched by the server, so they must not reach the server's own
 * network. Only https is allowed, and every address the host resolves to must be
 * public. The check runs again at send time inside the socket's own DNS lookup, so a
 * host that changes its answer after we checked it is still refused.
 *
 * `http://127.0.0.1:<port>` is allowed only when PARALLAX_ALLOW_LOCAL_WEBHOOKS=1 (tests).
 */

export const localWebhooksAllowed = () => process.env.PARALLAX_ALLOW_LOCAL_WEBHOOKS === "1";

function v4Private(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/** True for loopback, private, link-local, shared, multicast and reserved addresses. */
export function isPrivateAddress(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return v4Private(ip);
  if (kind !== 6) return true;
  const low = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(low);
  if (mapped) return v4Private(mapped[1]);
  if (low === "::" || low === "::1") return true;
  const first = parseInt(low.split(":")[0] || "0", 16);
  return (
    (first & 0xfe00) === 0xfc00 || // unique local fc00::/7
    (first & 0xffc0) === 0xfe80 || // link-local fe80::/10
    (first & 0xff00) === 0xff00 || // multicast
    low.startsWith("64:ff9b:") || // NAT64 can reach IPv4 private space
    low.startsWith("::ffff:") ||
    low.startsWith("2001:db8:")
  );
}

export class UrlRefused extends Error {}

/** True when this exact URL is the test-only local exception. */
export function isAllowedLocal(url: URL): boolean {
  return localWebhooksAllowed() && url.protocol === "http:" && url.hostname === "127.0.0.1";
}

/** Parses and checks the shape of a webhook URL. Throws UrlRefused with a member-facing message. */
export function parseWebhookUrl(raw: unknown): URL {
  if (typeof raw !== "string" || raw.length > 2000) throw new UrlRefused("Enter the endpoint URL.");
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new UrlRefused("That is not a valid URL.");
  }
  if (url.username || url.password) throw new UrlRefused("Leave the user name and password out of the URL.");
  if (isAllowedLocal(url)) return url;
  if (url.protocol !== "https:") throw new UrlRefused("The endpoint must use https.");
  if (url.port && url.port !== "443" && Number(url.port) < 1024) throw new UrlRefused("Use port 443 or a port above 1023.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new UrlRefused("The endpoint must be on the public internet.");
  }
  if (net.isIP(host) && isPrivateAddress(host)) throw new UrlRefused("The endpoint must be on the public internet.");
  return url;
}

/** Resolves the host and refuses it if any address is private. */
export async function checkResolves(url: URL): Promise<void> {
  if (isAllowedLocal(url)) return;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addrs: { address: string }[];
  try {
    addrs = net.isIP(host) ? [{ address: host }] : await dns.promises.lookup(host, { all: true });
  } catch {
    throw new UrlRefused("We could not find that host.");
  }
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) throw new UrlRefused("The endpoint must be on the public internet.");
}

/** A `lookup` for http(s).request that refuses private answers at connect time. */
export function guardedLookup(allowLocal: boolean): net.LookupFunction {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err, "", 0);
      const list = addresses as unknown as dns.LookupAddress[];
      const bad = !allowLocal && list.some((a) => isPrivateAddress(a.address));
      if (bad || list.length === 0) return callback(new UrlRefused("Refused a private address."), "", 0);
      if ((options as dns.LookupOptions).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
      callback(null, list[0].address, list[0].family);
    });
  };
}
