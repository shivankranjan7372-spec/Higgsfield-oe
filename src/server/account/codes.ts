import "server-only";

import { randomBytes } from "node:crypto";
import { MILLI } from "@/config/economy";
import type { User } from "@/server/auth";
import { grant } from "@/server/credits";
import { get, run, tx } from "@/server/db";
import { ApiError, badRequest } from "@/server/errors";

/** Promo codes and invite links. Each pays out once per member. */

/** Credits each side gets when an invite is claimed. Whole credits. */
export const REFERRAL_CREDITS = 50;
/** An inviter is paid for at most this many invites. */
export const REFERRAL_LIMIT = 50;

function cleanCode(raw: unknown, what: string): string {
  if (typeof raw !== "string") throw badRequest(`Enter ${what}.`);
  const code = raw.trim().toUpperCase();
  if (!code) throw badRequest(`Enter ${what}.`);
  if (code.length > 40 || !/^[A-Z0-9-]+$/.test(code)) throw new ApiError(404, "invalid_code", "That code does not exist.");
  return code;
}

interface PromoRow {
  code: string;
  credits: number;
  max_uses: number | null;
  uses: number;
  expires_at: number | null;
  active: number;
}

export function redeemPromo(userId: string, raw: unknown): { code: string; credits: number } {
  const code = cleanCode(raw, "a code");
  return tx(() => {
    const promo = get<PromoRow>("SELECT * FROM account_promo_codes WHERE code = ?", code);
    if (!promo || !promo.active) throw new ApiError(404, "invalid_code", "That code does not exist.");
    if (promo.expires_at !== null && promo.expires_at <= Date.now()) throw new ApiError(410, "code_expired", "That code has expired.");
    if (get("SELECT 1 FROM account_promo_redemptions WHERE user_id = ? AND code = ?", userId, code)) {
      throw new ApiError(409, "already_redeemed", "You have already used this code.");
    }
    if (promo.max_uses !== null && promo.uses >= promo.max_uses) throw new ApiError(410, "code_used_up", "That code has been used up.");
    run("INSERT INTO account_promo_redemptions (user_id, code, credits, created_at) VALUES (?, ?, ?, ?)", userId, code, promo.credits, Date.now());
    run("UPDATE account_promo_codes SET uses = uses + 1 WHERE code = ?", code);
    grant(userId, "grant", promo.credits, `Promo code ${code}`);
    return { code, credits: promo.credits };
  });
}

/* -------------------------------- referrals ------------------------------- */

export function referralCode(userId: string): string {
  const have = get<{ code: string }>("SELECT code FROM account_referral_codes WHERE user_id = ?", userId);
  if (have) return have.code;
  for (let i = 0; i < 10; i++) {
    // Base32-ish without look-alike characters.
    const code = Array.from(randomBytes(8), (b) => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[b % 31]).join("");
    if (run("INSERT OR IGNORE INTO account_referral_codes (user_id, code, created_at) VALUES (?, ?, ?)", userId, code, Date.now()).changes === 1) return code;
    const raced = get<{ code: string }>("SELECT code FROM account_referral_codes WHERE user_id = ?", userId);
    if (raced) return raced.code;
  }
  throw new Error("could not make a referral code");
}

export function referralSummary(userId: string) {
  const code = referralCode(userId);
  const stats = get<{ n: number; total: number }>("SELECT COUNT(*) AS n, COALESCE(SUM(credits), 0) AS total FROM account_referrals WHERE inviter_id = ?", userId)!;
  const claimed = get<{ inviter_id: string; created_at: number }>("SELECT inviter_id, created_at FROM account_referrals WHERE invitee_id = ?", userId);
  return {
    code,
    path: `/join?ref=${code}`,
    creditsEach: REFERRAL_CREDITS * MILLI,
    invited: stats.n,
    creditsEarned: stats.total,
    limit: REFERRAL_LIMIT,
    claimedInvite: claimed ? { claimedAt: claimed.created_at } : null,
  };
}

export function claimReferral(user: User, raw: unknown): { credits: number } {
  if (user.isGuest) throw new ApiError(409, "guest_account", "Create an account first, then claim the invite.");
  const code = cleanCode(raw, "an invite code");
  return tx(() => {
    const owner = get<{ user_id: string }>("SELECT user_id FROM account_referral_codes WHERE code = ?", code);
    if (!owner) throw new ApiError(404, "invalid_code", "That code does not exist.");
    if (owner.user_id === user.id) throw badRequest("You cannot use your own invite.");
    if (get("SELECT 1 FROM account_referrals WHERE invitee_id = ?", user.id)) throw new ApiError(409, "already_redeemed", "You have already used an invite.");
    // The code may outlive a deleted inviter row only briefly; check they still exist.
    const inviter = get<{ created_at: number }>("SELECT created_at FROM users WHERE id = ?", owner.user_id);
    if (!inviter) throw new ApiError(404, "invalid_code", "That code does not exist.");
    const credits = REFERRAL_CREDITS * MILLI;
    run("INSERT INTO account_referrals (invitee_id, inviter_id, credits, created_at) VALUES (?, ?, ?, ?)", user.id, owner.user_id, credits, Date.now());
    grant(user.id, "grant", credits, "Invite bonus");
    const paid = get<{ n: number }>("SELECT COUNT(*) AS n FROM account_referrals WHERE inviter_id = ?", owner.user_id)!.n;
    if (paid <= REFERRAL_LIMIT) grant(owner.user_id, "grant", credits, "Invite bonus: a friend joined");
    return { credits };
  });
}
