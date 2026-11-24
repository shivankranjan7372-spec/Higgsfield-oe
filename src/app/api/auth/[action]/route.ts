import { AccountError, createGuest, endSession, logIn, publicUser, signUp, startSession, type User } from "@/server/auth";
import { balance } from "@/server/credits";
import { badRequest, clientKey, notFound, publicRoute, rateLimit, readJson } from "@/server/http";

const HOUR = 3_600_000;

/** Server-wide ceilings on new accounts, each of which starts with free credits. */
const limit = (name: string, fallback: number) => {
  const n = Math.floor(Number(process.env[name]));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const GUESTS_PER_HOUR = limit("PARALLAX_GUESTS_PER_HOUR", 200);
const SIGNUPS_PER_HOUR = limit("PARALLAX_SIGNUPS_PER_HOUR", 100);

/**
 * POST /api/auth/signup  { email, password, name? }   a guest who signs up keeps their work
 * POST /api/auth/login   { email, password }
 * POST /api/auth/guest                                 a throwaway account, so people can try first
 * POST /api/auth/logout
 */
export const POST = publicRoute<{ action: string }>(async ({ req, user, params }) => {
  const who = clientKey(req);
  let next: User | null;
  let body: Record<string, unknown>;
  try {
    switch (params.action) {
      case "signup":
        rateLimit(`signup:${who}`, 10, HOUR);
        // The address above comes from X-Forwarded-For, which a client can set. A server-wide
        // ceiling bounds how many credit-carrying accounts can be made however it is spoofed.
        rateLimit("signup:all", SIGNUPS_PER_HOUR, HOUR);
        body = await readJson(req);
        next = signUp({ email: body.email, password: body.password, name: body.name }, user);
        break;
      case "login":
        rateLimit(`login:${who}`, 20, HOUR / 4);
        body = await readJson(req);
        // Per account as well as per address, so guessing one member's password stays slow.
        rateLimit(`login-email:${String(body.email ?? "").trim().toLowerCase().slice(0, 254)}`, 10, HOUR / 4);
        next = logIn({ email: body.email, password: body.password });
        break;
      case "guest":
        if (!user) {
          rateLimit(`guest:${who}`, 10, HOUR);
          rateLimit("guest:all", GUESTS_PER_HOUR, HOUR);
        }
        next = user ?? createGuest();
        break;
      case "logout":
        await endSession();
        next = null;
        break;
      default:
        throw notFound();
    }
  } catch (err) {
    if (err instanceof AccountError) throw badRequest(err.message);
    throw err;
  }
  if (next && next.id !== user?.id) await startSession(next.id);
  return { user: next ? publicUser(next) : null, balance: next ? balance(next.id) : 0 };
});
