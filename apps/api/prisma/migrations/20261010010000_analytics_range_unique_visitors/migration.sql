ALTER TABLE "public"."analytics_daily"
  ADD COLUMN "visitor_hashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "public"."analytics_daily" d
SET "visitor_hashes" = COALESCE(
  (
    SELECT ARRAY_AGG(DISTINCT e."hashed_ip"::text)
    FROM "public"."analytics_events" e
    WHERE e."profile_id" = d."profile_id"
      AND e."type" = 'PROFILE_VIEW'
      AND e."hashed_ip" IS NOT NULL
      AND (e."created_at" AT TIME ZONE 'UTC')::date = d."day"
  ),
  ARRAY[]::TEXT[]
);

ALTER TABLE "public"."analytics_daily" ENABLE ROW LEVEL SECURITY;
