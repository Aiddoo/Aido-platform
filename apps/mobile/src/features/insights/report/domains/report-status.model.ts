import { type Instant, instantSchema } from '@src/shared/date/instant';
import { match } from 'ts-pattern';
import { z } from 'zod';

import type { ReportType } from './report.model';

export const reportStatusSchema = z.object({
  nextWeeklyAt: instantSchema,
  nextMonthlyAt: instantSchema,
  daysUntilWeekly: z.int().nonnegative(),
  daysUntilMonthly: z.int().nonnegative(),
});
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export function getDaysUntilReport(status: ReportStatus, type: ReportType): number {
  return match(type)
    .with('WEEKLY', () => status.daysUntilWeekly)
    .with('MONTHLY', () => status.daysUntilMonthly)
    .exhaustive();
}

export function getNextReportAt(status: ReportStatus, type: ReportType): Instant {
  return match(type)
    .with('WEEKLY', () => status.nextWeeklyAt)
    .with('MONTHLY', () => status.nextMonthlyAt)
    .exhaustive();
}

export const ReportStatusPolicy = {
  getDaysUntilReport,
  getNextReportAt,
} as const;
