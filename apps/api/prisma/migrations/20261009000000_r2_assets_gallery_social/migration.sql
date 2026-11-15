ALTER TABLE "public"."social_links"
  ADD COLUMN "platform" VARCHAR(40) NOT NULL DEFAULT 'website';

ALTER TABLE "public"."gallery_images"
  ADD COLUMN "asset_id" UUID,
  ADD COLUMN "caption" VARCHAR(300);

CREATE TABLE "public"."assets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "profile_id" UUID,
  "kind" VARCHAR(20) NOT NULL,
  "object_key" TEXT NOT NULL,
  "content_type" VARCHAR(80) NOT NULL,
  "size" INTEGER NOT NULL,
  "confirmed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "assets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "assets_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "assets_object_key_key" ON "public"."assets"("object_key");
CREATE INDEX "assets_user_id_kind_confirmed_at_idx" ON "public"."assets"("user_id", "kind", "confirmed_at");
CREATE INDEX "assets_profile_id_kind_idx" ON "public"."assets"("profile_id", "kind");
CREATE UNIQUE INDEX "gallery_images_asset_id_key" ON "public"."gallery_images"("asset_id");
ALTER TABLE "public"."gallery_images"
  ADD CONSTRAINT "gallery_images_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."assets" ENABLE ROW LEVEL SECURITY;
