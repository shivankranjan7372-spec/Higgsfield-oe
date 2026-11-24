-- Account, plans and billing. Times are Unix milliseconds. Credits are millicredits.
-- Every table points at users(id) and is removed with the member.

-- One row per member who has ever had a paid plan. No row means the Free plan.
-- status: active | ended
CREATE TABLE account_subscriptions (
  user_id              TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan_id              TEXT NOT NULL,
  interval             TEXT NOT NULL,              -- month | year
  status               TEXT NOT NULL,
  period_start         INTEGER NOT NULL,
  period_end           INTEGER NOT NULL,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  pending_plan_id      TEXT,                       -- a downgrade that starts at period_end
  pending_interval     TEXT,
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);

-- What the billing provider charged. Written by the provider, never edited.
CREATE TABLE account_receipts (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL,                      -- demo
  reference    TEXT NOT NULL,
  plan_id      TEXT NOT NULL,
  interval     TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency     TEXT NOT NULL,
  description  TEXT NOT NULL,
  status       TEXT NOT NULL,                      -- paid
  period_start INTEGER NOT NULL,
  period_end   INTEGER NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX account_receipts_user ON account_receipts(user_id, created_at);

-- One row per monthly credit window that was granted. The primary key makes the grant happen once.
CREATE TABLE account_credit_grants (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  window_start INTEGER NOT NULL,
  window_end   INTEGER NOT NULL,
  plan_id      TEXT NOT NULL,
  amount       INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, window_start)
);

-- Promo codes. Codes are stored upper case.
CREATE TABLE account_promo_codes (
  code       TEXT PRIMARY KEY,
  credits    INTEGER NOT NULL,                     -- millicredits
  max_uses   INTEGER,                              -- null = no limit
  uses       INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,                              -- null = never
  active     INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE account_promo_redemptions (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,
  credits    INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, code)
);

-- Each member's own invite code, made on first request.
CREATE TABLE account_referral_codes (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code       TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

-- One row per invited member: a member can be invited only once.
-- inviter_id has no foreign key so the row (and the "once") survives the inviter deleting their account.
CREATE TABLE account_referrals (
  invitee_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  inviter_id TEXT NOT NULL,
  credits    INTEGER NOT NULL,                     -- given to each side, millicredits
  created_at INTEGER NOT NULL
);
CREATE INDEX account_referrals_inviter ON account_referrals(inviter_id);

-- Small per-member settings. value is JSON.
CREATE TABLE account_prefs (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, key)
);

-- Demo promo codes, so the feature works out of the box.
INSERT INTO account_promo_codes (code, credits, max_uses, created_at) VALUES ('HELLO-PARALLAX', 25000, NULL, 0);
INSERT INTO account_promo_codes (code, credits, max_uses, created_at) VALUES ('STUDIO-100', 100000, 1000, 0);
