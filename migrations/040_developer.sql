-- Developer API, webhooks and MCP. Times are Unix milliseconds, credits are millicredits.

-- API keys. Only the SHA-256 of a key is stored; the key itself is shown once.
CREATE TABLE dev_api_keys (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  prefix       TEXT NOT NULL,              -- first characters of the key, safe to show
  key_hash     TEXT NOT NULL UNIQUE,
  scopes       TEXT NOT NULL DEFAULT '[]', -- JSON array: read, generate
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at   INTEGER
);
CREATE INDEX dev_api_keys_user ON dev_api_keys(user_id, created_at);

-- One row per request made with a key, for the usage table.
CREATE TABLE dev_request_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key_id     TEXT NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method     TEXT NOT NULL,
  route      TEXT NOT NULL,               -- the route pattern, e.g. /v1/generations/{id}
  status     INTEGER NOT NULL,
  credits    INTEGER NOT NULL DEFAULT 0,  -- millicredits held by this request
  created_at INTEGER NOT NULL
);
CREATE INDEX dev_request_log_user ON dev_request_log(user_id, id);
CREATE INDEX dev_request_log_key ON dev_request_log(key_id, id);

-- Idempotency-Key replays for POST /v1/generations.
CREATE TABLE dev_idempotency (
  key_id       TEXT NOT NULL,
  idem_key     TEXT NOT NULL,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_hash TEXT NOT NULL,
  job_ids      TEXT NOT NULL DEFAULT '[]',
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (key_id, idem_key)
);

CREATE TABLE dev_webhooks (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  secret      TEXT NOT NULL,              -- needed in the clear to sign deliveries
  events      TEXT NOT NULL DEFAULT '[]', -- JSON array of event names
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);
CREATE INDEX dev_webhooks_user ON dev_webhooks(user_id);

-- One row per event per endpoint. Retried with backoff until delivered or out of attempts.
CREATE TABLE dev_webhook_deliveries (
  id              TEXT PRIMARY KEY,
  webhook_id      TEXT NOT NULL REFERENCES dev_webhooks(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event           TEXT NOT NULL,
  job_id          TEXT,
  payload         TEXT NOT NULL,
  status          TEXT NOT NULL,          -- pending | delivered | failed
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  last_status     INTEGER,                -- HTTP status of the last attempt
  last_error      TEXT,
  created_at      INTEGER NOT NULL,
  delivered_at    INTEGER
);
CREATE UNIQUE INDEX dev_webhook_deliveries_job ON dev_webhook_deliveries(webhook_id, event, job_id) WHERE job_id IS NOT NULL;
CREATE INDEX dev_webhook_deliveries_due ON dev_webhook_deliveries(status, next_attempt_at);
CREATE INDEX dev_webhook_deliveries_hook ON dev_webhook_deliveries(webhook_id, created_at);

-- Small key/value store for the dispatcher's watermark.
CREATE TABLE dev_state (
  name  TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
