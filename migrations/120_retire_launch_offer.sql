-- Retires the sample launch-week promo code that earlier versions seeded, so it can no longer
-- mint credits on servers that already have it. New installs never had it.
UPDATE account_promo_codes SET active = 0 WHERE code = 'LAUNCH-WEEK';
