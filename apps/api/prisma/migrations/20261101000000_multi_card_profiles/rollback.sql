-- Roll back only before the application writes against the new card model.
SET search_path TO "public";

DROP INDEX "audit_logs_card_id_created_at_idx";
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_card_id_fkey";
ALTER TABLE "audit_logs" DROP COLUMN "card_id";

DROP TABLE "card_products";
DROP TABLE "card_offices";
DROP TABLE "card_profiles";

DELETE FROM "cards"
WHERE "id" IN (SELECT "card_id" FROM "_card_profile_migration_cards");
DROP TABLE "_card_profile_migration_cards";

DROP INDEX "cards_owner_id_deleted_at_idx";
ALTER TABLE "cards"
  DROP CONSTRAINT "cards_owner_id_fkey",
  DROP COLUMN "created_by",
  DROP COLUMN "custom_purpose",
  DROP COLUMN "purpose",
  DROP COLUMN "owner_id";

UPDATE "users" AS account
SET
  "supabase_user_id" = migration_user."original_supabase_user_id",
  "email_verified_at" = migration_user."original_email_verified_at",
  "updated_at" = migration_user."original_updated_at"
FROM "_card_profile_migration_users" AS migration_user
WHERE migration_user."was_created" = false
  AND migration_user."user_id" = account."id";

DELETE FROM "users"
WHERE "id" IN (
  SELECT "user_id"
  FROM "_card_profile_migration_users"
  WHERE "was_created" = true
);
DROP TABLE "_card_profile_migration_users";

ALTER TABLE "users"
  DROP COLUMN "phone",
  DROP COLUMN "name";

UPDATE "cards"
SET "status" = 'inactive'
WHERE "status"::text = 'deleted';

ALTER TABLE "cards" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "cards" ALTER COLUMN "status" TYPE TEXT USING "status"::text;
DROP TYPE "CardStatus";
CREATE TYPE "CardStatus" AS ENUM ('active', 'inactive', 'suspended', 'lost');
ALTER TABLE "cards"
  ALTER COLUMN "status" TYPE "CardStatus" USING "status"::"CardStatus",
  ALTER COLUMN "status" SET DEFAULT 'inactive';

DROP TYPE "card_creator";
DROP TYPE "card_purpose";
