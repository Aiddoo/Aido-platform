import { useHaptics, useModerationApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { emitNotificationsChanged } from '@src/core/events/notifications-changed';
import { useTrack } from '@src/shared/analytics';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { toUserReportRequest } from '../apis/user-report.mapper';
import type { BlockTarget } from '../domains/user-block.model';
import type { UserReportTarget } from '../domains/user-report.model';
import type { UserReportFormValues } from '../schemas/user-report-form.schema';
import { invalidateAfterBlockChange } from './moderation-cache';

export function useBlockUserMutationOptions() {
  const haptics = useHaptics();
  const moderationApi = useModerationApi();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const toast = useAppToast();

  return mutationOptions({
    // 오프라인에 멈춰 있으면 확인 창을 닫지 못한다. 바로 실패해 알린다
    networkMode: 'always',
    mutationFn: async ({ userId }: BlockTarget) => unwrap(await moderationApi.blockUser(userId)),
    onSuccess: (_result, { displayName }) => {
      haptics.notify('success');
      trackEvent('user_blocked');
      toast.success(t('moderation:block.toast', { name: displayName }));
      emitNotificationsChanged();
      invalidateAfterBlockChange(queryClient);
    },
    meta: { errorFeedback: { feature: 'friend', fallbackKey: 'common:toast.defaultError' } },
  });
}

export function useUnblockUserMutationOptions() {
  const haptics = useHaptics();
  const moderationApi = useModerationApi();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const toast = useAppToast();

  return mutationOptions({
    // 오프라인에 멈춰 두면 해제 버튼이 연결될 때까지 돈다. 바로 실패해 알린다
    networkMode: 'always',
    mutationFn: async ({ userId }: BlockTarget) => unwrap(await moderationApi.unblockUser(userId)),
    onSuccess: async () => {
      haptics.notify('success');
      trackEvent('user_unblocked');
      toast.success(t('moderation:unblock.toast'));
      emitNotificationsChanged();
      // 화면에 머무는 차단 목록이라 행이 사라질 때까지 해제 버튼을 꺼 둔다. 다시 눌러 요청이 또 가지 않게 한다
      await invalidateAfterBlockChange(queryClient);
    },
    meta: { errorFeedback: { feature: 'friend', fallbackKey: 'common:toast.defaultError' } },
  });
}

export interface ReportContentVariables {
  target: UserReportTarget;
  form: UserReportFormValues;
}

/** 성공 안내(토스트·차단 바로가기)는 시트가 맡는다. 시트가 닫히는 순서와 함께 정해야 해서다 */
export function useReportContentMutationOptions() {
  const moderationApi = useModerationApi();
  const { trackEvent } = useTrack();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async ({ target, form }: ReportContentVariables) =>
      unwrap(await moderationApi.reportContent(toUserReportRequest(target, form))),
    onSuccess: (_result, { target, form }) => {
      trackEvent('content_reported', { target_type: target.targetType, reason: form.reason });
    },
    meta: { errorFeedback: { feature: 'friend', fallbackKey: 'common:toast.defaultError' } },
  });
}
