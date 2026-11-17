import type { ReportType } from '../domains/report.model';

/** 리포트 상세 두 차트, 목록 최근 카드의 주간 추세, 리포트가 없을 때도 보이는 이번 주 기록 */
export type ReportChart =
  | 'daily_completions'
  | 'completion_hours'
  | 'completion_trend'
  | 'this_week_record';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    ai_report_viewed: { report_id: number; report_type: ReportType };
    /** 차트를 처음 눌렀다. 무료 예시 리포트는 보내지 않는다 */
    ai_report_chart_tapped: { chart: ReportChart };
  }
}
