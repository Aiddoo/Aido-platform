import type { ReportType } from '../domains/report.model';

const REPORT_TYPE_LABEL_KEYS = {
  WEEKLY: 'report.typeWeekly',
  MONTHLY: 'report.typeMonthly',
} as const satisfies Record<ReportType, string>;

export function getReportTypeLabelKey(type: ReportType) {
  return REPORT_TYPE_LABEL_KEYS[type];
}
