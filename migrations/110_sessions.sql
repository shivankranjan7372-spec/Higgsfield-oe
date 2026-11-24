-- What the sessions screen shows next to each sign-in: which browser, and when it was last used.
-- No address is stored.
ALTER TABLE sessions ADD COLUMN user_agent TEXT;
ALTER TABLE sessions ADD COLUMN last_seen_at INTEGER;
