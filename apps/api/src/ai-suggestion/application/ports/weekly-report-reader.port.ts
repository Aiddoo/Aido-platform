export const WEEKLY_REPORT_READER = Symbol("WEEKLY_REPORT_READER");

/** 주간 보고서 읽기 프로젝션 — stats(Json) 파싱은 소비자가 담당한다 */
export interface WeeklyReportView {
	stats: unknown;
}

/**
 * 주간 보고서 읽기 포트.
 *
 * 제안 컨텍스트에 최근 주간 보고서 인사이트를 주입하기 위해 ai-report 모듈의
 * 최신 WEEKLY 보고서를 읽는다. 어댑터가 ai-report 저장소로 위임한다.
 */
export interface WeeklyReportReaderPort {
	findLatestWeekly(userId: string): Promise<WeeklyReportView | null>;
}
