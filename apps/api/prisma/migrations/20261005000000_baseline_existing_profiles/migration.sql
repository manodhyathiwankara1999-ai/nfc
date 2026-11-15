-- Baseline the legacy profile table without involving Supabase auth/storage schemas.
-- Existing Supabase deployments must mark this migration applied (see docs/HANDOFF.md).
CREATE TYPE "public"."profile_type" AS ENUM ('personal', 'commercial');

CREATE TABLE "public"."profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "display_name" TEXT,
    "title" TEXT,
    "bio" TEXT,
    "avatar_url" TEXT,
    "profile_type" "public"."profile_type" NOT NULL DEFAULT 'personal',
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "theme" JSONB NOT NULL DEFAULT '{"primary":"#4f46e5","secondary":"#0f172a","accent":"#f59e0b","background":{"type":"solid","value":"#f8fafc"},"font":"system"',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "profiles_user_id_key" ON "public"."profiles"("user_id");
CREATE UNIQUE INDEX "profiles_slug_key" ON "public"."profiles"("slug");
CREATE INDEX "profiles_is_public_slug_idx" ON "public"."profiles"("is_public", "slug");
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
