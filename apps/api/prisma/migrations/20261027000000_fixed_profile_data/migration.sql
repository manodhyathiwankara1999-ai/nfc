ALTER TABLE "public"."profiles"
  ADD COLUMN "tagline" VARCHAR(80),
  ADD COLUMN "skills_line" VARCHAR(120),
  ADD COLUMN "cover_image_url" TEXT,
  ADD COLUMN "phone" VARCHAR(40),
  ADD COLUMN "email" VARCHAR(254),
  ADD COLUMN "location" VARCHAR(100),
  ADD COLUMN "website" TEXT,
  ADD COLUMN "linkedin_url" TEXT,
  ADD COLUMN "github_url" TEXT,
  ADD COLUMN "theme_color" VARCHAR(7) NOT NULL DEFAULT '#4f46e5';

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_theme_color_hex_check"
  CHECK ("theme_color" ~ '^#[0-9A-Fa-f]{6}$');

UPDATE "public"."profiles" AS profile
SET
  "tagline" = CASE
    WHEN length(widget.settings->>'subtitle') <= 80 THEN widget.settings->>'subtitle'
    ELSE NULL
  END,
  "cover_image_url" = widget.settings->>'imageUrl'
FROM "public"."profile_widgets" AS widget
WHERE widget.profile_id = profile.id
  AND widget.type::text = 'cover'
  AND jsonb_typeof(widget.settings->'imageUrl') = 'string';

UPDATE "public"."profiles"
SET
  "tagline" = left("bio", 80)
WHERE "tagline" IS NULL
  AND "bio" IS NOT NULL
  AND length("bio") <= 80;

UPDATE "public"."profiles" AS profile
SET
  "phone" = CASE
    WHEN profile.contact->>'showPhone' = 'true'
      AND length(profile.contact->>'phone') <= 40
      THEN profile.contact->>'phone'
    ELSE NULL
  END,
  "email" = CASE
    WHEN profile.contact->>'showEmail' = 'true'
      AND length(profile.contact->>'email') <= 254
      THEN lower(profile.contact->>'email')
    ELSE NULL
  END,
  "website" = CASE
    WHEN profile.contact->>'showWebsite' = 'true'
      THEN profile.contact->>'website'
    ELSE NULL
  END;

UPDATE "public"."profiles" AS profile
SET "location" = profile.contact->>'location'
WHERE length(profile.contact->>'location') <= 100;

UPDATE "public"."profiles" AS profile
SET "linkedin_url" = social.url
FROM (
  SELECT DISTINCT ON (profile_id) profile_id, url
  FROM "public"."social_links"
  WHERE lower(platform) = 'linkedin'
  ORDER BY profile_id, position, created_at
) AS social
WHERE social.profile_id = profile.id;

UPDATE "public"."profiles" AS profile
SET "github_url" = social.url
FROM (
  SELECT DISTINCT ON (profile_id) profile_id, url
  FROM "public"."social_links"
  WHERE lower(platform) = 'github'
  ORDER BY profile_id, position, created_at
) AS social
WHERE social.profile_id = profile.id;

UPDATE "public"."profiles"
SET "theme_color" = theme->>'primary'
WHERE jsonb_typeof(theme->'primary') = 'string'
  AND theme->>'primary' ~ '^#[0-9A-Fa-f]{6}$';
