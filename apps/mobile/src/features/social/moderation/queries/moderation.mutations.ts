import type { UserReportFormInput } from '@aido/api';
import { useHaptics, useModerationService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { BlockTarget } from '../domains/user-block.model';
import { UserReportPolicy, type UserReportTarget } from '../domains/user-report.model';
import { invalidateAfterBlockChange } from './moderation-cache';

export function useBlockUserMutationOptions() {
  const haptics = useHaptics();
  const moderationService = useModerationService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const { success, error } = useAppToast();

  return mutationOptions({
    mutationFn: async ({ userId }: BlockTarget) =>
      unwrap(await moderationService.blockUser(userId)),
    onSuccess: (_result, { displayName }) => {
      haptics.notify('success');
      trackEvent('user_blocked');
      success(t('moderation:block.toast', { name: displayName }));
      return invalidateAfterBlockChange(queryClient);
    },
    onError: (blockError) => {
      haptics.notify('error');
      if (isApiError(blockError)) {
        error(blockError.message);
      }
    },
    // 네트워크·서버 장애는 화면 오류 경계가 맡는다
    throwOnError: (blockError) => !isApiError(blockError),
  });
}

export function useUnblockUserMutationOptions() {
  const haptics = useHaptics();
  const moderationService = useModerationService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const { success, error } = useAppToast();

  return mutationOptions({
    mutationFn: async ({ userId }: BlockTarget) =>
      unwrap(await moderationService.unblockUser(userId)),
    onSuccess: () => {
      haptics.notify('success');
      trackEvent('user_unblocked');
      success(t('moderation:unblock.toast'));
      return invalidateAfterBlockChange(queryClient);
    },
    onError: (unblockError) => {
      haptics.notify('error');
      if (isApiError(unblockError)) {
        error(unblockError.message);
      }
    },
    throwOnError: (unblockError) => !isApiError(unblockError),
  });
}

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
