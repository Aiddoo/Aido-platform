import { useHaptics, useModerationService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useTrack } from '@src/shared/analytics';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useMutationFailure } from '@src/shared/hooks/use-mutation-failure';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { UserReportPolicy } from '../domains/user-report.model';
import type { BlockTarget } from '../schemas/user-block.schema';
import type { UserReportFormInput, UserReportTarget } from '../schemas/user-report.schema';
import { invalidateAfterBlockChange } from './moderation-cache';

export function useBlockUserMutationOptions() {
  const haptics = useHaptics();
  const moderationService = useModerationService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const { success } = useAppToast();
  const showFailure = useMutationFailure();

  return mutationOptions({
    // 오프라인에 멈춰 있으면 확인 창을 닫지 못한다. 바로 실패해 알린다
    networkMode: 'always',
    mutationFn: async ({ userId }: BlockTarget) =>
      unwrap(await moderationService.blockUser(userId)),
    onSuccess: (_result, { displayName }) => {
      haptics.notify('success');
      trackEvent('user_blocked');
      success(t('moderation:block.toast', { name: displayName }));
      return invalidateAfterBlockChange(queryClient);
    },
    onError: (error) => showFailure(error),
  });
}

export function useUnblockUserMutationOptions() {
  const haptics = useHaptics();
  const moderationService = useModerationService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const { success } = useAppToast();
  const showFailure = useMutationFailure();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async ({ userId }: BlockTarget) =>
      unwrap(await moderationService.unblockUser(userId)),
    onSuccess: () => {
      haptics.notify('success');
      trackEvent('user_unblocked');
      success(t('moderation:unblock.toast'));
      return invalidateAfterBlockChange(queryClient);
    },
    onError: (error) => showFailure(error),
  });
}

export interface ReportContentVariables {
  target: UserReportTarget;
  form: UserReportFormInput;
}

/** 성공 안내(토스트·차단 바로가기)는 시트가 맡는다. 시트가 닫히는 순서와 함께 정해야 해서다 */
export function useReportContentMutationOptions() {
  const moderationService = useModerationService();
  const { trackEvent } = useTrack();
  const showFailure = useMutationFailure();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async ({ target, form }: ReportContentVariables) =>
      unwrap(
        await moderationService.reportContent(
          UserReportPolicy.createUserReportRequest(target, form),
        ),
      ),
    onSuccess: (_result, { target, form }) => {
      trackEvent('content_reported', { target_type: target.targetType, reason: form.reason });
    },
    onError: (error) => showFailure(error),
  });
}
