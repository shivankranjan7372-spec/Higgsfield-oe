-- Core tables. Times are Unix milliseconds. Credit amounts are millicredits (1 credit = 1000).
-- Feature teams: add your own file (010_library.sql, 020_explore.sql, ...). Never edit this one.

CREATE TABLE users (
  id              TEXT PRIMARY KEY,
  email           TEXT UNIQUE,
  handle          TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  password_hash   TEXT,
  is_guest        INTEGER NOT NULL DEFAULT 0,
  plan            TEXT NOT NULL DEFAULT 'free',
  avatar_asset_id TEXT,
  bio             TEXT NOT NULL DEFAULT '',
  created_at      INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- Append-only. A member's balance is SUM(amount).
-- kind: grant | topup | hold | charge | release | refund | adjust
-- A job inserts a negative `hold`. Success renames it to `charge`. Failure adds a positive `release`.
CREATE TABLE ledger (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  job_id     TEXT,
  note       TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX ledger_user ON ledger(user_id, id);
CREATE INDEX ledger_job ON ledger(job_id);

CREATE TABLE jobs (
  seq                 INTEGER PRIMARY KEY AUTOINCREMENT,
  id                  TEXT NOT NULL UNIQUE,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind                TEXT NOT NULL,              -- image | video | audio | music
  surface             TEXT NOT NULL,              -- which studio or tool made it
  model_id            TEXT NOT NULL,
  status              TEXT NOT NULL,              -- queued | running | succeeded | failed | canceled
  prompt              TEXT NOT NULL DEFAULT '',
  params              TEXT NOT NULL DEFAULT '{}', -- resolved control values (JSON)
  inputs              TEXT NOT NULL DEFAULT '{}', -- { slotId: [assetId] } (JSON)
  endpoint            TEXT NOT NULL,
  request             TEXT NOT NULL,              -- { body, query } with asset placeholders (JSON)
  expect_count        INTEGER NOT NULL DEFAULT 1,
  cost                INTEGER NOT NULL,           -- millicredits held for this job
  est_usd             REAL NOT NULL DEFAULT 0,
  treg_call_id        TEXT,
  provider_cost_micro INTEGER,
  error_code          TEXT,
  error_message       TEXT,
  batch_id            TEXT,
  meta                TEXT NOT NULL DEFAULT '{}',
  attempts            INTEGER NOT NULL DEFAULT 0,
  next_poll_at        INTEGER NOT NULL DEFAULT 0,
  created_at          INTEGER NOT NULL,
  started_at          INTEGER,
  finished_at         INTEGER,
  deleted_at          INTEGER
);
CREATE INDEX jobs_user ON jobs(user_id, seq);
CREATE INDEX jobs_status ON jobs(status, next_poll_at);
CREATE INDEX jobs_batch ON jobs(batch_id);

CREATE TABLE folders (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX folders_user ON folders(user_id);

CREATE TABLE assets (
  seq               INTEGER PRIMARY KEY AUTOINCREMENT,
  id                TEXT NOT NULL UNIQUE,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id            TEXT,
  kind              TEXT NOT NULL,                -- image | video | audio
  source            TEXT NOT NULL,                -- generated | upload
  mime              TEXT NOT NULL,
  bytes             INTEGER NOT NULL,
  width             INTEGER,
  height            INTEGER,
  duration          REAL,
  path              TEXT NOT NULL,                -- relative to the data directory
  poster_path       TEXT,
  title             TEXT NOT NULL DEFAULT '',
  prompt            TEXT NOT NULL DEFAULT '',
  model_id          TEXT,
  params            TEXT NOT NULL DEFAULT '{}',
  favorite          INTEGER NOT NULL DEFAULT 0,
  folder_id         TEXT,
  is_public         INTEGER NOT NULL DEFAULT 0,
  published_at      INTEGER,
  remote_url        TEXT,                         -- short-lived public copy handed to providers
  remote_expires_at INTEGER,
  created_at        INTEGER NOT NULL,
  deleted_at        INTEGER
);
CREATE INDEX assets_user ON assets(user_id, seq);
CREATE INDEX assets_job ON assets(job_id);
CREATE INDEX assets_public ON assets(is_public, published_at);
