SET search_path TO "public";

ALTER TYPE "CardStatus" RENAME VALUE 'revoked' TO 'suspended';
ALTER TYPE "CardStatus" ADD VALUE 'lost';

ALTER TABLE "cards"
  ALTER COLUMN "profile_id" DROP NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'inactive',
  ADD COLUMN "claim_code_hash" CHAR(64);

CREATE UNIQUE INDEX "cards_claim_code_hash_key" ON "cards"("claim_code_hash");
CREATE INDEX "cards_status_deleted_at_idx" ON "cards"("status", "deleted_at");

ALTER TABLE "profiles"
  ADD COLUMN "is_indexable" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "analytics_events"
  ADD COLUMN "device_type" VARCHAR(40),
  ADD COLUMN "browser" VARCHAR(80),
  ADD COLUMN "country" CHAR(2),
  ADD COLUMN "referrer_host" VARCHAR(255);
