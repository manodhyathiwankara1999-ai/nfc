CREATE TABLE "public"."analytics_daily" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "profile_id" UUID NOT NULL,
  "day" DATE NOT NULL,
  "views" INTEGER NOT NULL DEFAULT 0,
  "unique_visitors" INTEGER NOT NULL DEFAULT 0,
  "device_split" JSONB NOT NULL DEFAULT '{}',
  "top_referrers" JSONB NOT NULL DEFAULT '{}',
  "top_countries" JSONB NOT NULL DEFAULT '{}',
  "rolled_up_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_daily_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "analytics_daily_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "analytics_daily_profile_id_day_key" ON "public"."analytics_daily"("profile_id", "day");
CREATE INDEX "analytics_daily_day_idx" ON "public"."analytics_daily"("day");
CREATE INDEX "analytics_events_created_at_idx" ON "public"."analytics_events"("created_at");
ALTER TABLE "public"."analytics_daily" ENABLE ROW LEVEL SECURITY;
