-- Apps: one-purpose tools. The catalog itself is code (src/server/apps/catalog); these tables
-- only hold what members do with it. Times are Unix milliseconds.

-- One row per press of an app's Run button. The jobs it queued are listed in job_ids.
CREATE TABLE app_runs (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT NOT NULL UNIQUE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id     TEXT NOT NULL,
  fields     TEXT NOT NULL DEFAULT '{}',  -- checked form values (JSON)
  vals       TEXT NOT NULL DEFAULT '{}',  -- member-set control values (JSON)
  inputs     TEXT NOT NULL DEFAULT '{}',  -- { inputId: [assetId] } (JSON)
  job_ids    TEXT NOT NULL DEFAULT '[]',  -- (JSON)
  created_at INTEGER NOT NULL
);
CREATE INDEX app_runs_user_app ON app_runs(user_id, app_id, seq);
CREATE INDEX app_runs_user ON app_runs(user_id, seq);
CREATE INDEX app_runs_app ON app_runs(app_id);

-- Apps a member pinned to the top of their list.
CREATE TABLE app_pins (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id     TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, app_id)
);
