-- The agent chat. Times are Unix milliseconds.

CREATE TABLE super_projects (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  file_ids     TEXT NOT NULL DEFAULT '[]',          -- JSON list of asset ids
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX super_projects_user ON super_projects(user_id, updated_at);

CREATE TABLE super_chats (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '',
  project_id  TEXT,
  skill_ids   TEXT NOT NULL DEFAULT '[]',           -- JSON list of skill ids
  pinned      INTEGER NOT NULL DEFAULT 0,
  incognito   INTEGER NOT NULL DEFAULT 0,
  state       TEXT NOT NULL DEFAULT 'idle',         -- idle | running | waiting
  last_seq    INTEGER NOT NULL DEFAULT 0,           -- highest row seq
  rev         INTEGER NOT NULL DEFAULT 0,           -- highest updated_seq
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX super_chats_user ON super_chats(user_id, updated_at);

-- The transcript. A row is upserted by (chat_id, seq); every write takes a new updated_seq.
CREATE TABLE super_rows (
  chat_id     TEXT NOT NULL REFERENCES super_chats(id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,
  updated_seq INTEGER NOT NULL,
  kind        TEXT NOT NULL,                        -- message | tool-call | card | event | notice
  body        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (chat_id, seq)
);
CREATE INDEX super_rows_rev ON super_rows(chat_id, updated_seq);

-- What the language model sees, in order. Kept apart from the rows the member sees.
CREATE TABLE super_llm (
  chat_id TEXT NOT NULL REFERENCES super_chats(id) ON DELETE CASCADE,
  n       INTEGER NOT NULL,
  message TEXT NOT NULL,
  PRIMARY KEY (chat_id, n)
);

CREATE TABLE super_turns (
  id          TEXT PRIMARY KEY,
  chat_id     TEXT NOT NULL REFERENCES super_chats(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,                        -- queued | running | waiting | done | failed | stopped | interrupted
  mode        TEXT NOT NULL,                        -- ask | auto
  model       TEXT NOT NULL,
  text        TEXT NOT NULL,
  file_ids    TEXT NOT NULL DEFAULT '[]',
  steps       INTEGER NOT NULL DEFAULT 0,
  error       TEXT,
  created_at  INTEGER NOT NULL,
  started_at  INTEGER,
  finished_at INTEGER
);
CREATE INDEX super_turns_chat ON super_turns(chat_id, created_at);
CREATE INDEX super_turns_status ON super_turns(status);

-- Cards that wait for the member: approvals, questions.
CREATE TABLE super_approvals (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id     TEXT NOT NULL REFERENCES super_chats(id) ON DELETE CASCADE,
  turn_id     TEXT NOT NULL,
  row_seq     INTEGER NOT NULL,
  kind        TEXT NOT NULL,                        -- approval | question
  tool        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',      -- pending | allowed | denied | answered | expired
  answer      TEXT,
  created_at  INTEGER NOT NULL,
  answered_at INTEGER
);
CREATE INDEX super_approvals_chat ON super_approvals(chat_id, status);

-- "Always allow" answers, per member and tool.
CREATE TABLE super_policies (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, tool)
);

CREATE TABLE super_skills (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX super_skills_user ON super_skills(user_id);

CREATE TABLE super_memories (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  chat_id    TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX super_memories_user ON super_memories(user_id, created_at);

-- Apps a member connected through the connector service.
CREATE TABLE super_connections (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app         TEXT NOT NULL,
  status      TEXT NOT NULL,                        -- pending | active
  external_id TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, app)
);

-- Custom MCP servers: stored only, never called.
CREATE TABLE super_mcp_servers (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  url        TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX super_mcp_user ON super_mcp_servers(user_id);

CREATE TABLE super_schedules (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id          TEXT,                            -- the chat each run posts into, made on first run
  title            TEXT NOT NULL,
  prompt           TEXT NOT NULL,
  interval_minutes INTEGER NOT NULL,
  enabled          INTEGER NOT NULL DEFAULT 1,
  next_run_at      INTEGER NOT NULL,
  last_run_at      INTEGER,
  created_at       INTEGER NOT NULL
);
CREATE INDEX super_schedules_due ON super_schedules(enabled, next_run_at);

-- One cloud computer per member.
CREATE TABLE super_computers (
  user_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  external_id    TEXT,
  status         TEXT NOT NULL,                     -- creating | running | suspended | error
  screenshot     BLOB,
  screenshot_at  INTEGER,
  last_used_at   INTEGER NOT NULL,
  created_at     INTEGER NOT NULL
);
