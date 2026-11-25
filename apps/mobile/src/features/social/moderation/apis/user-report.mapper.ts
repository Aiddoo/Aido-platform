import type { CreateUserReportInput } from '@aido/api/contracts/user-report/v1';
import { toOptionalText } from '@src/shared/utils/to-optional-text';

import type { UserReportTarget } from '../domains/user-report.model';
import type { UserReportFormValues } from '../schemas/user-report-form.schema';

/** 공백만 적은 상세 내용은 보내지 않아 서버가 상세 없이 접수한다 */
export function toUserReportRequest(
  target: UserReportTarget,
  form: UserReportFormValues,
): CreateUserReportInput {
  return {
    targetUserId: target.targetUserId,
    targetType: target.targetType,
    // 계약은 targetId를 optional로만 받아 null을 실으면 400이다. 프로필 신고는 칸을 뺀다
    ...(target.targetId != null && { targetId: target.targetId }),
    reason: form.reason,
    detail: toOptionalText(form.detail),
  };
}
