-- Cinema studio: film projects planned as scenes and shots, then generated take by take.
-- Times are Unix milliseconds. Every row carries user_id so each query can filter by owner.

CREATE TABLE cinema_projects (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  logline        TEXT NOT NULL DEFAULT '',
  aspect         TEXT NOT NULL DEFAULT '16:9',
  look           TEXT NOT NULL DEFAULT '{}',   -- { filmStock, grade, lensFamily, lighting } preset ids (JSON)
  image_model_id TEXT NOT NULL,
  video_model_id TEXT NOT NULL,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX cinema_projects_user ON cinema_projects(user_id, updated_at);

CREATE TABLE cinema_scenes (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES cinema_projects(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  title      TEXT NOT NULL DEFAULT '',
  notes      TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX cinema_scenes_project ON cinema_scenes(project_id, position);

-- Characters, locations and props. ref_asset_ids points at the member's own assets.
CREATE TABLE cinema_elements (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id    TEXT NOT NULL REFERENCES cinema_projects(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,                 -- character | location | prop
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  ref_asset_ids TEXT NOT NULL DEFAULT '[]',    -- JSON array of asset ids
  created_at    INTEGER NOT NULL
);
CREATE INDEX cinema_elements_project ON cinema_elements(project_id, kind);

CREATE TABLE cinema_shots (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id       TEXT NOT NULL REFERENCES cinema_projects(id) ON DELETE CASCADE,
  scene_id         TEXT NOT NULL REFERENCES cinema_scenes(id) ON DELETE CASCADE,
  position         INTEGER NOT NULL,
  action           TEXT NOT NULL DEFAULT '',
  size             TEXT NOT NULL DEFAULT '',   -- preset ids; '' means "let the model decide"
  angle            TEXT NOT NULL DEFAULT '',
  movement         TEXT NOT NULL DEFAULT '',
  lens             TEXT NOT NULL DEFAULT '',
  focus            TEXT NOT NULL DEFAULT '',   -- depth of field
  lighting         TEXT NOT NULL DEFAULT '',
  mood             TEXT NOT NULL DEFAULT '',
  duration         REAL NOT NULL DEFAULT 5,    -- planned seconds
  sound            TEXT NOT NULL DEFAULT '',   -- dialogue or sound note
  cast_ids         TEXT NOT NULL DEFAULT '[]', -- JSON array of character/prop element ids, in billing order
  location_id      TEXT,
  selected_take_id TEXT,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
CREATE INDEX cinema_shots_scene ON cinema_shots(scene_id, position);
CREATE INDEX cinema_shots_project ON cinema_shots(project_id);

-- One row per job started for a shot. Status, files and errors are read from the job.
CREATE TABLE cinema_takes (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id     TEXT NOT NULL REFERENCES cinema_projects(id) ON DELETE CASCADE,
  shot_id        TEXT NOT NULL REFERENCES cinema_shots(id) ON DELETE CASCADE,
  job_id         TEXT NOT NULL,
  mode           TEXT NOT NULL,                -- still | animate | text
  source_take_id TEXT,                         -- the still an animate take started from
  created_at     INTEGER NOT NULL
);
CREATE INDEX cinema_takes_shot ON cinema_takes(shot_id, created_at);
CREATE INDEX cinema_takes_job ON cinema_takes(job_id);

-- "Generate every missing still": items wait here until the member has a free job slot.
CREATE TABLE cinema_batches (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES cinema_projects(id) ON DELETE CASCADE,
  model_id   TEXT NOT NULL,
  status     TEXT NOT NULL,                    -- running | done | canceled
  quoted     INTEGER NOT NULL,                 -- millicredits quoted at start
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX cinema_batches_status ON cinema_batches(status);

CREATE TABLE cinema_batch_items (
  id         TEXT PRIMARY KEY,
  batch_id   TEXT NOT NULL REFERENCES cinema_batches(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shot_id    TEXT NOT NULL,
  position   INTEGER NOT NULL,
  status     TEXT NOT NULL,                    -- waiting | submitted | skipped | failed | canceled
  take_id    TEXT,
  error      TEXT,
  updated_at INTEGER NOT NULL
);
CREATE INDEX cinema_batch_items_batch ON cinema_batch_items(batch_id, position);
