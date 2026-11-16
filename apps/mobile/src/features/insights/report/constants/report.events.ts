import type { ReportType } from '../domains/report.model';

export type ReportChart = 'daily_completions' | 'completion_hours';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    ai_report_viewed: { report_id: number; report_type: ReportType };
    /** 실제 리포트·이번 주 기록의 차트를 처음 눌렀다. 무료 예시 리포트는 보내지 않는다 */
    ai_report_chart_tapped: { chart: ReportChart };
  }
}
