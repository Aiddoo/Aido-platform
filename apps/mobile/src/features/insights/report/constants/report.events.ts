import type { ReportType } from '../schemas/report.schema';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    ai_report_viewed: { report_id: number; report_type: ReportType };
  }
}
