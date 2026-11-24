-- Ads studio. Times are Unix milliseconds. Credit amounts are millicredits.
-- Lists (colours, benefits, image ids...) are JSON arrays.

CREATE TABLE ad_brand_kits (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  colors        TEXT NOT NULL DEFAULT '[]',   -- [{ name, hex }]
  fonts         TEXT NOT NULL DEFAULT '{}',   -- { heading, body }
  tone          TEXT NOT NULL DEFAULT '',
  logo_asset_id TEXT,
  words_use     TEXT NOT NULL DEFAULT '[]',
  words_avoid   TEXT NOT NULL DEFAULT '[]',
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX ad_brand_kits_user ON ad_brand_kits(user_id, created_at);

CREATE TABLE ad_products (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand_kit_id TEXT,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  benefits     TEXT NOT NULL DEFAULT '[]',
  audience     TEXT NOT NULL DEFAULT '',
  price        TEXT NOT NULL DEFAULT '',     -- as the member writes it: "$24", "from 19 EUR"
  link         TEXT NOT NULL DEFAULT '',
  image_ids    TEXT NOT NULL DEFAULT '[]',   -- asset ids, member's own images
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX ad_products_user ON ad_products(user_id, created_at);

CREATE TABLE ad_campaigns (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  product_id         TEXT,
  brand_kit_id       TEXT,
  formats            TEXT NOT NULL DEFAULT '[]', -- [formatId]
  variations         INTEGER NOT NULL DEFAULT 1,
  script             TEXT NOT NULL DEFAULT '',   -- spoken formats; empty = written from the product
  presenter_asset_id TEXT,                       -- photo for the spokesperson format
  copied_from        TEXT,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);
CREATE INDEX ad_campaigns_user ON ad_campaigns(user_id, created_at);

-- One ad: one format, one variation, one round (a re-run adds a round).
-- status: waiting (not yet submitted, fed in as job slots free up) | running | succeeded | failed | canceled
-- Spoken formats with a talking video run two jobs: speech_job_id first, then job_id.
CREATE TABLE ad_items (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  id            TEXT NOT NULL UNIQUE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id   TEXT NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  format_id     TEXT NOT NULL,
  round         INTEGER NOT NULL DEFAULT 1,
  variation     INTEGER NOT NULL,
  status        TEXT NOT NULL,
  prompt        TEXT NOT NULL,
  script        TEXT NOT NULL DEFAULT '',
  copy          TEXT NOT NULL DEFAULT '{}',
  inputs        TEXT NOT NULL DEFAULT '{}',   -- { slotId: [assetId] } for the main job
  cost          INTEGER NOT NULL DEFAULT 0,   -- quoted millicredits for this ad
  speech_job_id TEXT,
  job_id        TEXT,
  winner        INTEGER NOT NULL DEFAULT 0,
  error_code    TEXT,
  error_message TEXT,
  created_at    INTEGER NOT NULL,
  finished_at   INTEGER
);
CREATE INDEX ad_items_campaign ON ad_items(campaign_id, seq);
CREATE INDEX ad_items_status ON ad_items(status, user_id);
