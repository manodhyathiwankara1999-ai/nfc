-- API users are separate from Supabase Auth users. Preserve profile owner UUIDs
-- while removing the legacy FK so new API accounts can create profiles.
ALTER TABLE "public"."profiles"
  DROP CONSTRAINT IF EXISTS "profiles_user_id_fkey";
