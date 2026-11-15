import { z } from 'zod';
import { apiRequest } from '@/lib/api/client';

const AnalyticsSummarySchema = z.object({
  range: z.enum(['7d', '30d', '90d']),
  totalViews: z.number().int().nonnegative(),
  uniqueVisitors: z.number().int().nonnegative(),
  viewsPerDay: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      views: z.number().int().nonnegative(),
    }),
  ),
  devices: z.array(
    z.object({
      device: z.string().min(1),
      views: z.number().int().nonnegative(),
    }),
  ),
  topReferrers: z.array(
    z.object({
      host: z.string().min(1),
      views: z.number().int().nonnegative(),
    }),
  ),
  topCountries: z.array(
    z.object({
      country: z.string().min(1),
      views: z.number().int().nonnegative(),
    }),
  ),
});

export type AnalyticsRange = z.infer<typeof AnalyticsSummarySchema>['range'];
export type AnalyticsSummary = z.infer<typeof AnalyticsSummarySchema>;

export async function getAnalyticsSummary(range: AnalyticsRange): Promise<AnalyticsSummary> {
  const result = await apiRequest<unknown>(`/analytics/summary?range=${range}`);
  return AnalyticsSummarySchema.parse(result);
}
