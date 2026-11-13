import { match } from 'ts-pattern';
import { z } from 'zod';

import type { ReportType } from './report.model';

export const reportStatusSchema = z.object({
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

export const ReportStatusPolicy = {
  getDaysUntilReport,
} as const;
