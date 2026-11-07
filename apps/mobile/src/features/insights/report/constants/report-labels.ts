import type { ReportType } from '../schemas/report.schema';

export const REPORT_TYPE_LABEL_KEYS = {
  WEEKLY: 'report.typeWeekly',
  MONTHLY: 'report.typeMonthly',
} as const satisfies Record<ReportType, string>;
