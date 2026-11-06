import type { UserReportFormInput } from '@aido/api';
import { useModerationService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions } from '@tanstack/react-query';

import { UserReportPolicy, type UserReportTarget } from '../domains/user-report.model';

export interface ReportContentVariables {
  target: UserReportTarget;
  form: UserReportFormInput;
}

/** 신고 결과 안내(토스트·차단 바로가기)는 시트가 맡는다. 시트가 닫히는 순서와 함께 정해야 해서다 */
export function useReportContentMutationOptions() {
  const moderationService = useModerationService();
  const { trackEvent } = useTrack();

  return mutationOptions({
    mutationFn: async ({ target, form }: ReportContentVariables) =>
      unwrap(await moderationService.reportContent(UserReportPolicy.toRequest(target, form))),
    onSuccess: (_result, { target, form }) => {
      trackEvent('content_reported', { target_type: target.targetType, reason: form.reason });
    },
  });
}
