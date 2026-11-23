import { type Instant, instantSchema } from '@src/shared/date/instant';
import { calculateCalendarDaysLeft } from '@src/shared/date/zoned';
import { match } from 'ts-pattern';
import { z } from 'zod';

import type { ReportType } from './report.model';

export const reportStatusSchema = z.object({
  nextWeeklyAt: instantSchema,
  nextMonthlyAt: instantSchema,
});
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export function getNextReportAt(status: ReportStatus, type: ReportType): Instant {
  return match(type)
    .with('WEEKLY', () => status.nextWeeklyAt)
    .with('MONTHLY', () => status.nextMonthlyAt)
    .exhaustive();
}

/** 서버가 준 도착 순간까지 남은 날(D-N)을 기기 달력으로 센다. 화면을 켜 둔 채 자정을 넘기면 하루 줄어든다 */
export function getDaysUntilReport(
  status: ReportStatus,
  type: ReportType,
  { now, timezone }: { now: Instant; timezone: string },
): number {
  return calculateCalendarDaysLeft(getNextReportAt(status, type), now, timezone);
}

export const ReportStatusPolicy = {
  getDaysUntilReport,
  getNextReportAt,
} as const;
