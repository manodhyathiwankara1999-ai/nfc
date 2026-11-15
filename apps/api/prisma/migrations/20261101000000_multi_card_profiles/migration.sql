CREATE TYPE "public"."card_purpose" AS ENUM (
  'personal',
  'business_owner',
  'freelancer',
  'employee',
  'doctor',
  'lawyer',
  'teacher',
  'student',
  'real_estate',
  'other'
);

CREATE TYPE "public"."card_creator" AS ENUM ('owner', 'super_admin');
ALTER TYPE "public"."CardStatus" ADD VALUE 'deleted';

ALTER TABLE "public"."users"
  ADD COLUMN "name" VARCHAR(100),
  ADD COLUMN "phone" VARCHAR(16),
  ADD CONSTRAINT "users_phone_e164_check"
    CHECK ("phone" IS NULL OR "phone" ~ '^\+[1-9][0-9]{1,14}$');

ALTER TABLE "public"."cards"
  ADD COLUMN "owner_id" UUID,
  ADD COLUMN "purpose" "public"."card_purpose" NOT NULL DEFAULT 'personal',
  ADD COLUMN "custom_purpose" VARCHAR(80),
  ADD COLUMN "created_by" "public"."card_creator" NOT NULL DEFAULT 'owner',
  ADD CONSTRAINT "cards_custom_purpose_check"
    CHECK (
      ("purpose" = 'other' AND "custom_purpose" IS NOT NULL)
      OR ("purpose" <> 'other' AND "custom_purpose" IS NULL)
    ),
  ADD CONSTRAINT "cards_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "cards_owner_id_deleted_at_idx" ON "public"."cards"("owner_id", "deleted_at");

CREATE TABLE "public"."card_profiles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "card_id" UUID NOT NULL,
  "full_name" VARCHAR(100) NOT NULL,
  "job_title" VARCHAR(100),
  "skills_line" VARCHAR(120),
  "tagline" VARCHAR(120),
  "avatar" TEXT,
  "cover" TEXT,
  "contact" JSONB NOT NULL DEFAULT '{}',
  "social_links" JSONB NOT NULL DEFAULT '[]',
  "theme_color" VARCHAR(7) NOT NULL DEFAULT '#4f46e5',
  "gallery" JSONB NOT NULL DEFAULT '[]',
  "show_products" BOOLEAN NOT NULL DEFAULT false,
  "is_public" BOOLEAN NOT NULL DEFAULT true,
  "is_indexable" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "card_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "card_profiles_card_id_fkey"
    FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "card_profiles_theme_color_hex_check"
    CHECK ("theme_color" ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE UNIQUE INDEX "card_profiles_card_id_key" ON "public"."card_profiles"("card_id");

CREATE TABLE "public"."card_offices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "card_profile_id" UUID NOT NULL,
  "has_office" BOOLEAN NOT NULL DEFAULT false,
  "company_name" VARCHAR(160),
  "designation" VARCHAR(100),
  "department" VARCHAR(100),
  "office_address" VARCHAR(500),
  "office_phone" VARCHAR(16),
  "office_email" VARCHAR(254),
  "company_website" TEXT,
  "working_hours" VARCHAR(160),
  CONSTRAINT "card_offices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "card_offices_card_profile_id_fkey"
    FOREIGN KEY ("card_profile_id") REFERENCES "public"."card_profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "card_offices_office_phone_e164_check"
    CHECK ("office_phone" IS NULL OR "office_phone" ~ '^\+[1-9][0-9]{1,14}$')
);

CREATE UNIQUE INDEX "card_offices_card_profile_id_key"
  ON "public"."card_offices"("card_profile_id");

CREATE TABLE "public"."card_products" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "card_profile_id" UUID NOT NULL,
  "image" TEXT NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "price" DECIMAL(12,2),
  "currency" CHAR(3) NOT NULL DEFAULT 'USD',
  "detail" VARCHAR(120) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "card_products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "card_products_card_profile_id_fkey"
    FOREIGN KEY ("card_profile_id") REFERENCES "public"."card_profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "card_products_price_nonnegative_check"
    CHECK ("price" IS NULL OR "price" >= 0),
  CONSTRAINT "card_products_sort_order_check"
    CHECK ("sort_order" BETWEEN 0 AND 4)
);

CREATE INDEX "card_products_card_profile_id_deleted_at_sort_order_idx"
  ON "public"."card_products"("card_profile_id", "deleted_at", "sort_order");

ALTER TABLE "public"."audit_logs"
  ADD COLUMN "card_id" UUID,
  ADD CONSTRAINT "audit_logs_card_id_fkey"
    FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "audit_logs_card_id_created_at_idx" ON "public"."audit_logs"("card_id", "created_at");

CREATE TABLE "public"."_card_profile_migration_cards" (
  "card_id" UUID NOT NULL,
  CONSTRAINT "_card_profile_migration_cards_pkey" PRIMARY KEY ("card_id"),
  CONSTRAINT "_card_profile_migration_cards_card_id_fkey"
    FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "public"."_card_profile_migration_users" (
  "user_id" UUID NOT NULL,
  "was_created" BOOLEAN NOT NULL,
  "original_supabase_user_id" UUID,
  "original_email_verified_at" TIMESTAMPTZ(6),
  "original_updated_at" TIMESTAMPTZ(6),
  CONSTRAINT "_card_profile_migration_users_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "public"."card_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."card_offices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."card_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."_card_profile_migration_cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."_card_profile_migration_users" ENABLE ROW LEVEL SECURITY;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "public"."profiles" AS profile
    JOIN "auth"."users" AS auth_user ON auth_user."id" = profile."user_id"
    JOIN "public"."users" AS account ON lower(account."email") = lower(auth_user."email")
    WHERE account."supabase_user_id" IS NOT NULL
      AND account."supabase_user_id" <> auth_user."id"
  ) THEN
    RAISE EXCEPTION 'A legacy profile email is linked to a different Supabase identity.';
  END IF;
  IF EXISTS (
    SELECT lower(account."email")
    FROM "public"."profiles" AS profile
    JOIN "auth"."users" AS auth_user ON auth_user."id" = profile."user_id"
    JOIN "public"."users" AS account ON lower(account."email") = lower(auth_user."email")
    GROUP BY lower(account."email")
    HAVING count(DISTINCT account."id") > 1
  ) THEN
    RAISE EXCEPTION 'A legacy profile email maps to multiple application accounts.';
  END IF;
END
$migration$;

INSERT INTO "public"."_card_profile_migration_users" (
  "user_id",
  "was_created",
  "original_supabase_user_id",
  "original_email_verified_at",
  "original_updated_at"
)
SELECT DISTINCT
  account."id",
  false,
  account."supabase_user_id",
  account."email_verified_at",
  account."updated_at"
FROM "public"."profiles" AS profile
JOIN "auth"."users" AS auth_user ON auth_user."id" = profile."user_id"
JOIN "public"."users" AS account ON lower(account."email") = lower(auth_user."email")
WHERE account."supabase_user_id" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."users" AS mapped
    WHERE mapped."supabase_user_id" = auth_user."id"
      AND mapped."id" <> account."id"
  )
ON CONFLICT ("user_id") DO NOTHING;

UPDATE "public"."users" AS account
SET
  "supabase_user_id" = auth_user."id",
  "email_verified_at" = auth_user."email_confirmed_at",
  "updated_at" = CURRENT_TIMESTAMP
FROM "public"."profiles" AS profile
JOIN "auth"."users" AS auth_user ON auth_user."id" = profile."user_id"
WHERE lower(account."email") = lower(auth_user."email")
  AND account."supabase_user_id" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."users" AS mapped
    WHERE mapped."supabase_user_id" = auth_user."id"
      AND mapped."id" <> account."id"
  );

INSERT INTO "public"."_card_profile_migration_users" (
  "user_id",
  "was_created",
  "original_supabase_user_id",
  "original_email_verified_at",
  "original_updated_at"
)
SELECT DISTINCT
  auth_user."id",
  true,
  NULL::UUID,
  NULL::TIMESTAMPTZ(6),
  NULL::TIMESTAMPTZ(6)
FROM "public"."profiles" AS profile
JOIN "auth"."users" AS auth_user ON auth_user."id" = profile."user_id"
WHERE auth_user."email" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."users" AS account
    WHERE account."id" = auth_user."id"
      OR account."supabase_user_id" = auth_user."id"
      OR lower(account."email") = lower(auth_user."email")
  )
ON CONFLICT ("user_id") DO NOTHING;

INSERT INTO "public"."users" (
  "id",
  "supabase_user_id",
  "email",
  "role",
  "account_type",
  "email_verified_at",
  "created_at",
  "updated_at"
)
SELECT DISTINCT
  auth_user."id",
  auth_user."id",
  auth_user."email",
  'user'::"public"."Role",
  'self_employed'::"public"."user_account_type",
  auth_user."email_confirmed_at",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."profiles" AS profile
JOIN "auth"."users" AS auth_user ON auth_user."id" = profile."user_id"
WHERE auth_user."email" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."users" AS account
    WHERE account."id" = auth_user."id"
      OR account."supabase_user_id" = auth_user."id"
      OR lower(account."email") = lower(auth_user."email")
  );

UPDATE "public"."cards" AS card
SET
  "owner_id" = (
    SELECT account."id"
    FROM "public"."users" AS account
    WHERE account."id" = profile."user_id"
      OR account."supabase_user_id" = profile."user_id"
    ORDER BY CASE WHEN account."supabase_user_id" = profile."user_id" THEN 0 ELSE 1 END
    LIMIT 1
  ),
  "purpose" = CASE
    WHEN profile."profile_type"::text = 'commercial' THEN 'business_owner'::"public"."card_purpose"
    ELSE 'personal'::"public"."card_purpose"
  END,
  "created_by" = 'owner'::"public"."card_creator"
FROM "public"."profiles" AS profile
WHERE card."profile_id" = profile."id";

UPDATE "public"."cards"
SET "created_by" = 'super_admin'::"public"."card_creator"
WHERE "profile_id" IS NULL;

UPDATE "public"."audit_logs" AS audit
SET "card_id" = card."id"
FROM "public"."cards" AS card
WHERE audit."entity_type" = 'card'
  AND audit."entity_id" = card."slug";

DO $migration$
DECLARE
  legacy_profile RECORD;
  candidate_slug TEXT;
  generated_card_id UUID;
  account_id UUID;
BEGIN
  FOR legacy_profile IN
    SELECT "id", "user_id", "slug", "profile_type"
    FROM "public"."profiles"
    ORDER BY "created_at", "id"
  LOOP
    SELECT account."id"
    INTO account_id
    FROM "public"."users" AS account
    WHERE account."id" = legacy_profile."user_id"
      OR account."supabase_user_id" = legacy_profile."user_id"
    ORDER BY CASE WHEN account."supabase_user_id" = legacy_profile."user_id" THEN 0 ELSE 1 END
    LIMIT 1;

    candidate_slug := legacy_profile."slug";
    IF length(candidate_slug) > 100
      OR EXISTS (SELECT 1 FROM "public"."cards" WHERE "slug" = candidate_slug)
    THEN
      candidate_slug :=
        left(legacy_profile."slug", 66) || '-' || replace(legacy_profile."id"::text, '-', '');
    END IF;
    WHILE EXISTS (SELECT 1 FROM "public"."cards" WHERE "slug" = candidate_slug) LOOP
      candidate_slug :=
        left(legacy_profile."slug", 66) || '-' || replace(gen_random_uuid()::text, '-', '');
    END LOOP;

    generated_card_id := gen_random_uuid();
    INSERT INTO "public"."cards" (
      "id", "profile_id", "owner_id", "slug", "status", "purpose", "created_by",
      "created_at", "updated_at"
    )
    VALUES (
      generated_card_id,
      legacy_profile."id",
      account_id,
      candidate_slug,
      'active'::"public"."CardStatus",
      CASE
        WHEN legacy_profile."profile_type"::text = 'commercial'
          THEN 'business_owner'::"public"."card_purpose"
        ELSE 'personal'::"public"."card_purpose"
      END,
      'owner'::"public"."card_creator",
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
    INSERT INTO "public"."_card_profile_migration_cards" ("card_id")
    VALUES (generated_card_id);
  END LOOP;
END
$migration$;

INSERT INTO "public"."card_profiles" (
  "card_id",
  "full_name",
  "job_title",
  "skills_line",
  "tagline",
  "avatar",
  "cover",
  "contact",
  "social_links",
  "theme_color",
  "gallery",
  "is_public",
  "is_indexable"
)
SELECT
  card."id",
  left(COALESCE(NULLIF(btrim(profile."display_name"), ''), profile."slug"), 100),
  left(NULLIF(profile."title", ''), 100),
  profile."skills_line",
  COALESCE(profile."tagline", left(profile."bio", 120)),
  profile."avatar_url",
  profile."cover_image_url",
  COALESCE(profile."contact", '{}'::jsonb) ||
    jsonb_strip_nulls(jsonb_build_object(
      'phone', profile."phone",
      'email', profile."email",
      'location', profile."location",
      'website', profile."website"
    )),
  COALESCE((
    SELECT jsonb_agg(link."value" ORDER BY link."position", link."created_at")
    FROM (
      SELECT
        jsonb_build_object(
          'platform', social."platform",
          'label', social."label",
          'url', social."url",
          'position', social."position"
        ) AS "value",
        social."position",
        social."created_at"
      FROM "public"."social_links" AS social
      WHERE social."profile_id" = profile."id"
      UNION ALL
      SELECT jsonb_build_object('platform', 'linkedin', 'url', profile."linkedin_url"), -2,
        TIMESTAMPTZ 'epoch'
      WHERE profile."linkedin_url" IS NOT NULL
      UNION ALL
      SELECT jsonb_build_object('platform', 'github', 'url', profile."github_url"), -1,
        TIMESTAMPTZ 'epoch'
      WHERE profile."github_url" IS NOT NULL
    ) AS link
  ), '[]'::jsonb),
  profile."theme_color",
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'objectKey', gallery."object_key",
        'caption', gallery."caption",
        'altText', gallery."alt_text",
        'position', gallery."position"
      ) ORDER BY gallery."position", gallery."created_at"
    )
    FROM "public"."gallery_images" AS gallery
    WHERE gallery."profile_id" = profile."id"
      AND gallery."deleted_at" IS NULL
  ), '[]'::jsonb),
  profile."is_public",
  profile."is_indexable"
FROM "public"."cards" AS card
JOIN "public"."profiles" AS profile ON profile."id" = card."profile_id"
ON CONFLICT ("card_id") DO NOTHING;
