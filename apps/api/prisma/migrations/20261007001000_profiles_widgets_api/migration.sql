SET search_path TO "public";

UPDATE "profile_widgets" SET "type" = 'social' WHERE "type" = 'social_links';
UPDATE "profile_widgets" SET "type" = 'vcard' WHERE "type" = 'vcard_download';

ALTER TABLE "profiles" ADD COLUMN "contact" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "profile_slug_redirects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "old_slug" VARCHAR(48) NOT NULL,
    "new_slug" VARCHAR(48) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "profile_slug_redirects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "profile_slug_redirects_old_slug_key" ON "profile_slug_redirects"("old_slug");
CREATE INDEX "profile_slug_redirects_profile_id_idx" ON "profile_slug_redirects"("profile_id");
ALTER TABLE "profile_slug_redirects"
  ADD CONSTRAINT "profile_slug_redirects_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_slug_redirects" ENABLE ROW LEVEL SECURITY;
