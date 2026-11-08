import type {
  UserReportFormValues,
  UserReportRequest,
  UserReportTarget,
} from '../schemas/user-report.schema';

/** 공백만 적은 상세 내용은 보내지 않아 서버가 상세 없이 접수한다 */
export function toUserReportRequest(
  target: UserReportTarget,
  form: UserReportFormValues,
): UserReportRequest {
  const detail = form.detail?.trim();

  return {
    ...target,
    reason: form.reason,
    detail: detail == null || detail.length === 0 ? undefined : detail,
  };
}
