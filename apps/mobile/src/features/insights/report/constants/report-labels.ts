import type { ReportType } from '../domains/report.model';

export const REPORT_TYPE_LABEL_KEYS = {
  WEEKLY: 'report.typeWeekly',
  MONTHLY: 'report.typeMonthly',
} as const satisfies Record<ReportType, string>;
