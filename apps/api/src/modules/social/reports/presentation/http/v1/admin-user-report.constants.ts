/** 운영자 신고 처리 API. 신고 접수 이메일의 처리 링크도 이 값으로 만든다 */
export const RESOLVE_USER_REPORT_OPERATION_ID = "resolveUserReport";

export function resolveUserReportPath(reportId: string): string {
  return `/v1/admin/reports/${reportId}/resolution`;
}
