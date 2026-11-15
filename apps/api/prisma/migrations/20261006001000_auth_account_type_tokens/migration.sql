SET search_path TO "public";

CREATE TYPE "user_account_type" AS ENUM ('self_employed', 'company');

ALTER TABLE "users" ALTER COLUMN "account_type" DROP DEFAULT;
ALTER TABLE "users"
  ALTER COLUMN "account_type" TYPE "user_account_type"
  USING (
    CASE "account_type"::text
      WHEN 'commercial' THEN 'company'
      ELSE 'self_employed'
    END
  )::"user_account_type";
ALTER TABLE "users" ALTER COLUMN "account_type" SET DEFAULT 'self_employed';
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user';
ALTER TABLE "users"
  ADD COLUMN "password_hash_algo" VARCHAR(20) NOT NULL DEFAULT 'argon2id';

ALTER TABLE "refresh_tokens" ADD COLUMN "family_id" UUID;
UPDATE "refresh_tokens" SET "family_id" = "id" WHERE "family_id" IS NULL;
ALTER TABLE "refresh_tokens" ALTER COLUMN "family_id" SET NOT NULL;
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");
