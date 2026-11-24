-- Explore and Community: public posts, social actions, contests.
-- Times are Unix milliseconds. Every table points at core rows; no core table is altered.
-- Publishing also sets assets.is_public / assets.published_at, so visibleAsset() serves the file.

-- One row per published file. Unpublishing deletes the row (and its likes, saves, comments,
-- views, reports and contest entries with it).
CREATE TABLE community_posts (
  seq            INTEGER PRIMARY KEY AUTOINCREMENT,
  id             TEXT NOT NULL UNIQUE,
  asset_id       TEXT NOT NULL UNIQUE REFERENCES assets(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL,              -- image | video | audio, copied from the asset
  model_id       TEXT,                       -- copied from the asset, for the model filter
  title          TEXT NOT NULL DEFAULT '',
  description    TEXT NOT NULL DEFAULT '',
  allow_recreate INTEGER NOT NULL DEFAULT 0,
  like_count     INTEGER NOT NULL DEFAULT 0,
  save_count     INTEGER NOT NULL DEFAULT 0,
  comment_count  INTEGER NOT NULL DEFAULT 0,
  view_count     INTEGER NOT NULL DEFAULT 0,
  published_at   INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX community_posts_user ON community_posts(user_id, seq);
CREATE INDEX community_posts_published ON community_posts(published_at);
CREATE INDEX community_posts_kind ON community_posts(kind, seq);
CREATE INDEX community_posts_model ON community_posts(model_id, seq);

CREATE TABLE community_post_tags (
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  tag     TEXT NOT NULL,
  PRIMARY KEY (post_id, tag)
);
CREATE INDEX community_post_tags_tag ON community_post_tags(tag);

CREATE TABLE community_likes (
  post_id    TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX community_likes_user ON community_likes(user_id, created_at);

CREATE TABLE community_saves (
  post_id    TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX community_saves_user ON community_saves(user_id, created_at);

-- A view counts once per viewer per post per UTC day. `viewer` is a user id, or a hash of
-- the address for signed-out visitors (never the address itself).
CREATE TABLE community_views (
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  viewer  TEXT NOT NULL,
  day     INTEGER NOT NULL,
  PRIMARY KEY (post_id, viewer, day)
);

CREATE TABLE community_comments (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT NOT NULL UNIQUE,
  post_id    TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX community_comments_post ON community_comments(post_id, seq);

CREATE TABLE community_follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX community_follows_followee ON community_follows(followee_id, created_at);

-- "Hide this member's posts from my feeds". Private to the member who hid.
CREATE TABLE community_hides (
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hidden_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at     INTEGER NOT NULL,
  PRIMARY KEY (user_id, hidden_user_id)
);

-- Reports wait here for a moderator. status: open | dismissed | actioned
CREATE TABLE community_reports (
  id          TEXT PRIMARY KEY,
  post_id     TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'open',
  created_at  INTEGER NOT NULL,
  UNIQUE (post_id, reporter_id)
);
CREATE INDEX community_reports_status ON community_reports(status, created_at);

-- Contests. The phase is worked out from the times:
--   now < opens_at                -> upcoming
--   opens_at <= now < closes_at   -> open    (enter and vote)
--   closes_at <= now < ends_at    -> voting  (vote only)
--   ends_at <= now                -> ended   (leaderboard is final)
CREATE TABLE community_contests (
  id         TEXT PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  title      TEXT NOT NULL,
  summary    TEXT NOT NULL,
  brief      TEXT NOT NULL,
  rules      TEXT NOT NULL DEFAULT '[]',   -- JSON array of short rule lines
  kind       TEXT,                         -- image | video | audio, or NULL for any
  prize      TEXT NOT NULL DEFAULT '',     -- shown as written
  opens_at   INTEGER NOT NULL,
  closes_at  INTEGER NOT NULL,
  ends_at    INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE community_contest_entries (
  contest_id TEXT NOT NULL REFERENCES community_contests(id) ON DELETE CASCADE,
  post_id    TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (contest_id, post_id),
  UNIQUE (contest_id, user_id)              -- one entry per member per contest
);

CREATE TABLE community_contest_votes (
  contest_id TEXT NOT NULL,
  post_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (contest_id, post_id, user_id),
  FOREIGN KEY (contest_id, post_id) REFERENCES community_contest_entries(contest_id, post_id) ON DELETE CASCADE
);

-- Seed contests, placed relative to the moment the database is created.
INSERT INTO community_contests (id, slug, title, summary, brief, rules, kind, prize, opens_at, closes_at, ends_at, created_at) VALUES
  ('cst_quietcities', 'quiet-cities', 'Quiet Cities',
   'Empty streets, still water, the hour before everyone wakes.',
   'Show a city with nobody in it. Dawn light, rain on glass, a tram stop at 4 a.m. We are looking for calm, not ruins.',
   '["One entry per member.","The entry must be an image you generated and published on Parallax.","No real people, logos or brand names.","Voting is open to members while the contest runs and for three days after."]',
   'image', '2,000 credits for first place, 1,000 for second, 500 for third',
   CAST(strftime('%s','now') AS INTEGER) * 1000 - 3 * 86400000,
   CAST(strftime('%s','now') AS INTEGER) * 1000 + 11 * 86400000,
   CAST(strftime('%s','now') AS INTEGER) * 1000 + 14 * 86400000,
   CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('cst_tinyloops', 'tiny-loops', 'Tiny Loops',
   'A few seconds that could play forever.',
   'Make a short clip that loops cleanly: a spinning top, a breathing plant, waves that never finish. Seamless beats spectacular.',
   '["One entry per member.","The entry must be a video you generated and published on Parallax.","Keep it under ten seconds.","No real people, logos or brand names."]',
   'video', '3,000 credits for first place',
   CAST(strftime('%s','now') AS INTEGER) * 1000 + 7 * 86400000,
   CAST(strftime('%s','now') AS INTEGER) * 1000 + 21 * 86400000,
   CAST(strftime('%s','now') AS INTEGER) * 1000 + 24 * 86400000,
   CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('cst_firstlight', 'first-light', 'First Light',
   'Our opening challenge: the first moment of morning.',
   'Anything that feels like the first light of the day. Any medium.',
   '["One entry per member.","Any published image, video or sound counts."]',
   NULL, 'Featured on the Explore page for a week',
   CAST(strftime('%s','now') AS INTEGER) * 1000 - 30 * 86400000,
   CAST(strftime('%s','now') AS INTEGER) * 1000 - 16 * 86400000,
   CAST(strftime('%s','now') AS INTEGER) * 1000 - 13 * 86400000,
   CAST(strftime('%s','now') AS INTEGER) * 1000);
