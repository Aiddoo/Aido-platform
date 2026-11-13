import type { CreateUserReportInput } from '@aido/api';

import type { UserReportTarget } from '../domains/user-report.model';
import type { UserReportFormValues } from '../schemas/user-report-form.schema';

/** 공백만 적은 상세 내용은 보내지 않아 서버가 상세 없이 접수한다 */
export function toUserReportRequest(
  target: UserReportTarget,
  form: UserReportFormValues,
): CreateUserReportInput {
  const detail = form.detail?.trim();

  return {
    ...target,
    reason: form.reason,
    detail: detail == null || detail.length === 0 ? undefined : detail,
  };
}
