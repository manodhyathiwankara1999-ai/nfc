import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalyticsEventType, Prisma } from '@prisma/client';
import { createHmac, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Request } from 'express';
import type { ApiEnvironment } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
const SUMMARY_RANGES = { '7d': 7, '30d': 30, '90d': 90 } as const;

const AnalyticsSummarySchema = z.object({
  range: z.enum(['7d', '30d', '90d']),
  totalViews: z.number().int().nonnegative(),
  uniqueVisitors: z.number().int().nonnegative(),
  viewsPerDay: z.array(z.object({ date: z.string(), views: z.number().int().nonnegative() })),
  devices: z.array(z.object({ device: z.string(), views: z.number().int().nonnegative() })),
  topReferrers: z.array(z.object({ host: z.string(), views: z.number().int().nonnegative() })),
  topCountries: z.array(z.object({ country: z.string(), views: z.number().int().nonnegative() })),
});

type AnalyticsSummary = z.infer<typeof AnalyticsSummarySchema>;
type TotalRow = { totalViews: bigint | number; uniqueVisitors: bigint | number };
type DailyRow = { day: Date | string; views: bigint | number };
type DimensionRow = { dimension: string; value: string; views: bigint | number };

@Injectable()
export class AnalyticsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsService.name);
  private maintenanceTimer?: NodeJS.Timeout;
  private maintenanceRunning = false;
  private readonly rawRetentionDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<ApiEnvironment, true>,
  ) {
    this.rawRetentionDays = config.get('ANALYTICS_RAW_RETENTION_DAYS', { infer: true });
  }

  onModuleInit(): void {
    this.scheduleMaintenance();
  }

  onModuleDestroy(): void {
    if (this.maintenanceTimer) clearTimeout(this.maintenanceTimer);
  }

  async getSummary(userId: string, range: keyof typeof SUMMARY_RANGES): Promise<AnalyticsSummary> {
    const rangeDays = SUMMARY_RANGES[range];
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - rangeDays + 1);
    const [totals, daily, dimensions] = await Promise.all([
      this.prisma.$queryRaw<TotalRow[]>(Prisma.sql`
        WITH owned_profiles AS (
          SELECT id FROM "public"."profiles" WHERE "user_id" = ${userId}::uuid
        )
        SELECT
          COALESCE((SELECT SUM(d.views) FROM "public"."analytics_daily" d
            JOIN owned_profiles p ON p.id = d.profile_id
            WHERE d.day >= ${start}::date AND d.day < ${today}::date), 0)
          + COALESCE((SELECT COUNT(*) FROM "public"."analytics_events" e
            JOIN owned_profiles p ON p.id = e.profile_id
            WHERE e.type = 'PROFILE_VIEW' AND e.created_at >= ${today}::timestamptz
              AND e.created_at < ${tomorrow}::timestamptz), 0) AS "totalViews",
          COALESCE((SELECT COUNT(DISTINCT visitors.visitor_hash) FROM (
            SELECT hashes.visitor_hash
            FROM "public"."analytics_daily" d
            JOIN owned_profiles p ON p.id = d.profile_id
            CROSS JOIN LATERAL unnest(d.visitor_hashes) AS hashes(visitor_hash)
            WHERE d.day >= ${start}::date AND d.day < ${today}::date
            UNION ALL
            SELECT e.hashed_ip::text
            FROM "public"."analytics_events" e
            JOIN owned_profiles p ON p.id = e.profile_id
            WHERE e.type = 'PROFILE_VIEW' AND e.hashed_ip IS NOT NULL
              AND e.created_at >= ${today}::timestamptz
              AND e.created_at < ${tomorrow}::timestamptz
          ) visitors), 0) AS "uniqueVisitors"
      `),
      this.prisma.$queryRaw<DailyRow[]>(Prisma.sql`
        WITH owned_profiles AS (
          SELECT id FROM "public"."profiles" WHERE "user_id" = ${userId}::uuid
        ), days AS (
          SELECT d.day, SUM(d.views)::bigint AS views
          FROM "public"."analytics_daily" d
          JOIN owned_profiles p ON p.id = d.profile_id
          WHERE d.day >= ${start}::date AND d.day < ${today}::date
          GROUP BY d.day
          UNION ALL
          SELECT ${today}::date, COUNT(*)::bigint
          FROM "public"."analytics_events" e
          JOIN owned_profiles p ON p.id = e.profile_id
          WHERE e.type = 'PROFILE_VIEW' AND e.created_at >= ${today}::timestamptz
            AND e.created_at < ${tomorrow}::timestamptz
          HAVING COUNT(*) > 0
        )
        SELECT day, SUM(views)::bigint AS views FROM days GROUP BY day ORDER BY day
      `),
      this.prisma.$queryRaw<DimensionRow[]>(Prisma.sql`
        WITH owned_profiles AS (
          SELECT id FROM "public"."profiles" WHERE "user_id" = ${userId}::uuid
        ), rollup_dimensions AS (
          SELECT 'device'::text AS dimension, item.key AS value, SUM(item.value::bigint)::bigint AS views
          FROM "public"."analytics_daily" d
          JOIN owned_profiles p ON p.id = d.profile_id
          CROSS JOIN LATERAL jsonb_each_text(d.device_split) item
          WHERE d.day >= ${start}::date AND d.day < ${today}::date
          GROUP BY item.key
          UNION ALL
          SELECT 'referrer', item.key, SUM(item.value::bigint)::bigint
          FROM "public"."analytics_daily" d
          JOIN owned_profiles p ON p.id = d.profile_id
          CROSS JOIN LATERAL jsonb_each_text(d.top_referrers) item
          WHERE d.day >= ${start}::date AND d.day < ${today}::date
          GROUP BY item.key
          UNION ALL
          SELECT 'country', item.key, SUM(item.value::bigint)::bigint
          FROM "public"."analytics_daily" d
          JOIN owned_profiles p ON p.id = d.profile_id
          CROSS JOIN LATERAL jsonb_each_text(d.top_countries) item
          WHERE d.day >= ${start}::date AND d.day < ${today}::date
          GROUP BY item.key
        ), today_dimensions AS (
          SELECT 'device'::text AS dimension, COALESCE(e.device_type, 'unknown') AS value, COUNT(*)::bigint AS views
          FROM "public"."analytics_events" e
          JOIN owned_profiles p ON p.id = e.profile_id
          WHERE e.type = 'PROFILE_VIEW' AND e.created_at >= ${today}::timestamptz
            AND e.created_at < ${tomorrow}::timestamptz
          GROUP BY COALESCE(e.device_type, 'unknown')
          UNION ALL
          SELECT 'referrer', e.referrer_host, COUNT(*)::bigint
          FROM "public"."analytics_events" e
          JOIN owned_profiles p ON p.id = e.profile_id
          WHERE e.type = 'PROFILE_VIEW' AND e.referrer_host IS NOT NULL
            AND e.created_at >= ${today}::timestamptz AND e.created_at < ${tomorrow}::timestamptz
          GROUP BY e.referrer_host
          UNION ALL
          SELECT 'country', e.country, COUNT(*)::bigint
          FROM "public"."analytics_events" e
          JOIN owned_profiles p ON p.id = e.profile_id
          WHERE e.type = 'PROFILE_VIEW' AND e.country IS NOT NULL
            AND e.created_at >= ${today}::timestamptz AND e.created_at < ${tomorrow}::timestamptz
          GROUP BY e.country
        )
        SELECT dimension, value, SUM(views)::bigint AS views
        FROM (SELECT * FROM rollup_dimensions UNION ALL SELECT * FROM today_dimensions) all_dimensions
        GROUP BY dimension, value
      `),
    ]);

    const days = new Map<string, number>();
    for (const row of daily) days.set(this.dayString(row.day), Number(row.views));
    const viewsPerDay = Array.from({ length: rangeDays }, (_, index) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      return { date: key, views: days.get(key) ?? 0 };
    });
    const grouped = (dimension: string) =>
      dimensions
        .filter((item) => item.dimension === dimension)
        .map((item) => ({ value: item.value, views: Number(item.views) }))
        .sort((left, right) => right.views - left.views || left.value.localeCompare(right.value));
    const totalRow = totals[0] ?? { totalViews: 0, uniqueVisitors: 0 };
    const result = AnalyticsSummarySchema.parse({
      range,
      totalViews: Number(totalRow.totalViews),
      uniqueVisitors: Number(totalRow.uniqueVisitors),
      viewsPerDay,
      devices: grouped('device').map(({ value, views }) => ({ device: value, views })),
      topReferrers: grouped('referrer')
        .slice(0, 5)
        .map(({ value, views }) => ({ host: value, views })),
      topCountries: grouped('country')
        .slice(0, 5)
        .map(({ value, views }) => ({ country: value, views })),
    });
    return result;
  }

  async recordPublicView(
    profileId: string,
    cardId: string | null,
    request: Request,
  ): Promise<void> {
    const dnt = this.header(request, 'dnt')?.toLowerCase();
    if (dnt === '1' || dnt === 'yes') return;

    const userAgent = this.header(request, 'user-agent')?.slice(0, 512) ?? null;
    if (
      userAgent &&
      /\b(bot|crawler|spider|headless|preview|facebookexternalhit|slackbot)\b/i.test(userAgent)
    ) {
      return;
    }

    const ip = this.clientIp(request);
    const hashedIp = ip
      ? createHmac('sha256', this.config.get('IP_HASH_SALT', { infer: true }))
          .update(ip)
          .digest('hex')
      : null;
    const now = new Date();
    const referrer = this.header(request, 'referer');
    let referrerHost: string | null = null;
    if (referrer) {
      try {
        referrerHost = new URL(referrer).hostname.slice(0, 255);
      } catch {
        referrerHost = null;
      }
    }
    const countryHeader = this.header(request, 'cf-ipcountry')?.toUpperCase();
    const country = countryHeader && /^[A-Z]{2}$/.test(countryHeader) ? countryHeader : null;
    await this.prisma.analyticsEvent.create({
      data: {
        id: randomUUID(),
        profileId,
        cardId,
        type: AnalyticsEventType.PROFILE_VIEW,
        hashedIp,
        userAgent,
        deviceType: userAgent ? this.deviceType(userAgent) : null,
        browser: userAgent ? this.browser(userAgent) : null,
        country,
        referrerHost,
        createdAt: now,
      },
    });
  }

  private clientIp(request: Request): string | null {
    return request.ip || null;
  }

  private header(request: Request, name: string): string | undefined {
    const value = request.headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }

  private deviceType(userAgent: string): string {
    if (/ipad|tablet/i.test(userAgent)) return 'tablet';
    return /mobile|android|iphone/i.test(userAgent) ? 'mobile' : 'desktop';
  }

  private browser(userAgent: string): string {
    if (/edg\//i.test(userAgent)) return 'Edge';
    if (/firefox\//i.test(userAgent)) return 'Firefox';
    if (/chrome\//i.test(userAgent) && !/chromium/i.test(userAgent)) return 'Chrome';
    if (/safari\//i.test(userAgent) && !/chrome\//i.test(userAgent)) return 'Safari';
    return 'Other';
  }

  async runNightlyMaintenance(): Promise<void> {
    if (this.maintenanceRunning) return;
    this.maintenanceRunning = true;
    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw(Prisma.sql`
            WITH event_totals AS (
              SELECT e.profile_id,
                (e.created_at AT TIME ZONE 'UTC')::date AS day,
                COUNT(*)::integer AS views,
                COUNT(DISTINCT e.hashed_ip)::integer AS unique_visitors,
                ARRAY_AGG(DISTINCT e.hashed_ip::text)
                  FILTER (WHERE e.hashed_ip IS NOT NULL) AS visitor_hashes
              FROM "public"."analytics_events" e
              WHERE e.type = 'PROFILE_VIEW'
                AND e.created_at < (date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
              GROUP BY e.profile_id, (e.created_at AT TIME ZONE 'UTC')::date
            ), device_counts AS (
              SELECT profile_id, day, jsonb_object_agg(value, view_count) AS aggregate_json
              FROM (
                SELECT e.profile_id, (e.created_at AT TIME ZONE 'UTC')::date AS day,
                  COALESCE(e.device_type, 'unknown') AS value, COUNT(*)::integer AS view_count
                FROM "public"."analytics_events" e
                WHERE e.type = 'PROFILE_VIEW'
                  AND e.created_at < (date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
                GROUP BY e.profile_id, (e.created_at AT TIME ZONE 'UTC')::date, COALESCE(e.device_type, 'unknown')
              ) grouped
              GROUP BY profile_id, day
            ), referrer_counts AS (
              SELECT profile_id, day, jsonb_object_agg(value, view_count) AS aggregate_json
              FROM (
                SELECT e.profile_id, (e.created_at AT TIME ZONE 'UTC')::date AS day,
                  e.referrer_host AS value, COUNT(*)::integer AS view_count
                FROM "public"."analytics_events" e
                WHERE e.type = 'PROFILE_VIEW' AND e.referrer_host IS NOT NULL
                  AND e.created_at < (date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
                GROUP BY e.profile_id, (e.created_at AT TIME ZONE 'UTC')::date, e.referrer_host
              ) grouped
              GROUP BY profile_id, day
            ), country_counts AS (
              SELECT profile_id, day, jsonb_object_agg(value, view_count) AS aggregate_json
              FROM (
                SELECT e.profile_id, (e.created_at AT TIME ZONE 'UTC')::date AS day,
                  e.country AS value, COUNT(*)::integer AS view_count
                FROM "public"."analytics_events" e
                WHERE e.type = 'PROFILE_VIEW' AND e.country IS NOT NULL
                  AND e.created_at < (date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
                GROUP BY e.profile_id, (e.created_at AT TIME ZONE 'UTC')::date, e.country
              ) grouped
              GROUP BY profile_id, day
            )
            INSERT INTO "public"."analytics_daily"
              (id, profile_id, day, views, unique_visitors, visitor_hashes, device_split, top_referrers, top_countries, rolled_up_at)
            SELECT gen_random_uuid(), totals.profile_id, totals.day, totals.views, totals.unique_visitors,
              COALESCE(totals.visitor_hashes, ARRAY[]::TEXT[]),
              COALESCE(devices.aggregate_json, '{}'::jsonb), COALESCE(referrers.aggregate_json, '{}'::jsonb),
              COALESCE(countries.aggregate_json, '{}'::jsonb), CURRENT_TIMESTAMP
            FROM event_totals totals
            LEFT JOIN device_counts devices USING (profile_id, day)
            LEFT JOIN referrer_counts referrers USING (profile_id, day)
            LEFT JOIN country_counts countries USING (profile_id, day)
            ON CONFLICT (profile_id, day) DO UPDATE SET
              views = EXCLUDED.views,
              unique_visitors = EXCLUDED.unique_visitors,
              visitor_hashes = ARRAY(
                SELECT DISTINCT visitor_hash
                FROM unnest(
                  "analytics_daily".visitor_hashes || EXCLUDED.visitor_hashes
                ) AS hashes(visitor_hash)
                ORDER BY visitor_hash
              ),
              device_split = EXCLUDED.device_split,
              top_referrers = EXCLUDED.top_referrers,
              top_countries = EXCLUDED.top_countries,
              rolled_up_at = CURRENT_TIMESTAMP
          `);
        await transaction.$executeRaw(Prisma.sql`
            DELETE FROM "public"."analytics_events"
            WHERE created_at < CURRENT_TIMESTAMP - (${this.rawRetentionDays} * INTERVAL '1 day')
          `);
      });
    } finally {
      this.maintenanceRunning = false;
    }
  }

  private scheduleMaintenance(): void {
    const now = new Date();
    const next = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 1, 15),
    );
    this.maintenanceTimer = setTimeout(() => {
      void this.runNightlyMaintenance()
        .catch((error: unknown) => {
          this.logger.error(error instanceof Error ? error.stack : 'Analytics maintenance failed.');
        })
        .finally(() => this.scheduleMaintenance());
    }, next.getTime() - now.getTime());
    this.maintenanceTimer.unref();
  }

  private dayString(value: Date | string): string {
    return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
  }
}
