-- Notifications, preferences, "what's new" seen state and recent searches.
-- Times are Unix milliseconds. Every row belongs to one member and goes when they go.
-- The search index (FTS5) is created at run time by src/server/notify/search.ts, because
-- not every SQLite build has FTS5 and this migration must run everywhere.

CREATE TABLE notify_notices (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,   -- cursor for paging
  id         TEXT NOT NULL UNIQUE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  link       TEXT,
  data       TEXT NOT NULL DEFAULT '{}',
  dedupe_key TEXT,                                -- one notice per (member, key), ever
  read_at    INTEGER,
  deleted_at INTEGER,                             -- kept as a tombstone so the dedupe key still holds
  created_at INTEGER NOT NULL
);
CREATE INDEX notify_notices_user ON notify_notices(user_id, seq);
CREATE INDEX notify_notices_unread ON notify_notices(user_id, read_at);
CREATE UNIQUE INDEX notify_notices_dedupe ON notify_notices(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- A missing row means the kind is on.
CREATE TABLE notify_prefs (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  enabled    INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind)
);

-- Where the lazy job scan got to, and which low-credit level was last announced.
CREATE TABLE notify_state (
  user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  jobs_after   INTEGER NOT NULL DEFAULT 0,        -- finished_at of the newest job already seen
  credit_level INTEGER NOT NULL DEFAULT 0,        -- 0 = fine, 1 = low, 2 = very low
  credit_armed INTEGER NOT NULL DEFAULT 0,        -- bumps each time the balance recovers
  synced_at    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE notify_seen (
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  announcement_id TEXT NOT NULL,
  seen_at         INTEGER NOT NULL,
  PRIMARY KEY (user_id, announcement_id)
);

CREATE TABLE notify_recent_searches (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query      TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, query)
);
CREATE INDEX notify_recent_user ON notify_recent_searches(user_id, created_at);

-- Small key/value store for the search index bookkeeping.
CREATE TABLE notify_search_state (
  key   TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
