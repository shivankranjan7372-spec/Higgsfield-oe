-- Library: trash, elements. Times are Unix milliseconds.
-- Folders live in the core `folders` table and `assets.folder_id`; nothing here changes them.

-- A file in the trash. Its `assets` row is marked `deleted_at` (so every core read hides it)
-- but, unlike a core delete, its files stay on disk until it is deleted for good.
-- No row here + `deleted_at` set = deleted for good.
CREATE TABLE library_trash (
  asset_id   TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trashed_at INTEGER NOT NULL
);
CREATE INDEX library_trash_user ON library_trash(user_id, trashed_at);

-- A named, reusable set of reference images.
CREATE TABLE elements (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,              -- character | object | style | place
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  tags         TEXT NOT NULL DEFAULT '[]', -- JSON array of lower-case strings
  use_count    INTEGER NOT NULL DEFAULT 0,
  last_used_at INTEGER,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX elements_user ON elements(user_id, updated_at);

-- The element's reference images, in order. Position 0 is the cover.
CREATE TABLE element_assets (
  element_id TEXT NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
  asset_id   TEXT NOT NULL,
  position   INTEGER NOT NULL,
  PRIMARY KEY (element_id, asset_id)
);
CREATE INDEX element_assets_asset ON element_assets(asset_id);
