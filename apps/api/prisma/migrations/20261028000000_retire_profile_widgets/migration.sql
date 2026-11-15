SET search_path TO "public";

ALTER TABLE "profile_widgets" RENAME TO "legacy_profile_widgets";
ALTER TABLE "legacy_profile_widgets"
  ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;

DROP TYPE "WidgetType";
