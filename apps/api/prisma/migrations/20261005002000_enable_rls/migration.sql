-- API-owned tables intentionally receive no client-access policies.
-- The legacy profiles policies are retained on existing installations.
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."refresh_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."email_verification_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."password_reset_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."oauth_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."company_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profile_widgets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."social_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."gallery_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."themes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."analytics_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."webhook_events" ENABLE ROW LEVEL SECURITY;
