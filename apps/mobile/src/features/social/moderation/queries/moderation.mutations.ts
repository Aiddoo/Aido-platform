import { useHaptics, useModerationService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useTrack } from '@src/shared/analytics';
import { getUserFacingMessage } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { toUserReportRequest } from '../apis/user-report.mapper';
import type { BlockTarget } from '../schemas/user-block.schema';
import type { UserReportFormInput, UserReportTarget } from '../schemas/user-report.schema';
import { invalidateAfterBlockChange } from './moderation-cache';

export function useBlockUserMutationOptions() {
  const haptics = useHaptics();
  const moderationService = useModerationService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const { success, error: showError } = useAppToast();

  return mutationOptions({
    // 오프라인에 멈춰 있으면 확인 창을 닫지 못한다. 바로 실패해 알린다
    networkMode: 'always',
    mutationFn: async ({ userId }: BlockTarget) =>
      unwrap(await moderationService.blockUser(userId)),
    onSuccess: (_result, { displayName }) => {
      haptics.notify('success');
      trackEvent('user_blocked');
      success(t('moderation:block.toast', { name: displayName }));
      invalidateAfterBlockChange(queryClient);
    },
    onError: (error) => {
      haptics.notify('error');
      showError(getUserFacingMessage(error));
    },
  });
}

export function useUnblockUserMutationOptions() {
  const haptics = useHaptics();
  const moderationService = useModerationService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const { success, error: showError } = useAppToast();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async ({ userId }: BlockTarget) =>
      unwrap(await moderationService.unblockUser(userId)),
    onSuccess: () => {
      haptics.notify('success');
      trackEvent('user_unblocked');
      success(t('moderation:unblock.toast'));
      invalidateAfterBlockChange(queryClient);
    },
    onError: (error) => {
      haptics.notify('error');
      showError(getUserFacingMessage(error));
    },
  });
}

export interface ReportContentVariables {
  target: UserReportTarget;
  form: UserReportFormInput;
}

/** 성공 안내(토스트·차단 바로가기)는 시트가 맡는다. 시트가 닫히는 순서와 함께 정해야 해서다 */
export function useReportContentMutationOptions() {
  const haptics = useHaptics();
  const { error: showError } = useAppToast();
  const moderationService = useModerationService();
  const { trackEvent } = useTrack();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async ({ target, form }: ReportContentVariables) =>
      unwrap(await moderationService.reportContent(toUserReportRequest(target, form))),
    onSuccess: (_result, { target, form }) => {
      trackEvent('content_reported', { target_type: target.targetType, reason: form.reason });
    },
    onError: (error) => {
      haptics.notify('error');
      showError(getUserFacingMessage(error));
    },
  });
}
