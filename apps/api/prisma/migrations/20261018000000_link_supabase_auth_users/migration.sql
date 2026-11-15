ALTER TABLE "public"."users"
  ADD COLUMN "supabase_user_id" UUID;

UPDATE "public"."users" AS app_user
SET "supabase_user_id" = app_user."id"
WHERE EXISTS (
  SELECT 1
  FROM "auth"."users" AS auth_user
  WHERE auth_user."id" = app_user."id"
);

CREATE UNIQUE INDEX "users_supabase_user_id_key"
  ON "public"."users"("supabase_user_id");
