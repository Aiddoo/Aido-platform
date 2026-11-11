import {
  useExternalLink,
  useHaptics,
  useLogger,
  useNotificationApi,
  usePushRegistrationService,
  useSessionEpoch,
} from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useUpdatePreferenceMutationOptions } from '@src/features/identity/preference/queries/preference.mutations';
import { getErrorMessage, isConnectivityError, ServerError, toError } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { isLastMutation } from '@src/shared/query/is-last-mutation';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, type QueryClient, useQueryClient } from '@tanstack/react-query';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { isPushReportRetryableError } from '../domains/notification.error';
import {
  invalidateNotifications,
  invalidatePushPermission,
  optimisticallyMarkNotificationsRead,
  revertNotificationsRead,
  setCachedPushPermission,
} from './notification-cache';
import { NOTIFICATION_MUTATION_KEYS } from './notification-mutation-keys';

const PUSH_OPENED_RETRIES = 3;

/**
 * 응답은 읽은 개수만 주어 안 읽은 수를 확정하지 못해 다시 받아야 하는데, 앞 처리 뒤에 다시 받으면
 * 뒤 처리의 낙관적 수가 덮여 앱 아이콘 배지가 깜빡인다. 같은 키의 마지막 처리만 다시 받는다
 */
function invalidateAfterLastNotificationWrite(queryClient: QueryClient) {
  return isLastMutation(queryClient, NOTIFICATION_MUTATION_KEYS.writes())
    ? invalidateNotifications(queryClient)
    : undefined;
}

// 앱 아이콘 배지는 안 읽은 수 캐시를 따라가므로(`useNotificationBadgeSync`) 캐시만 고친다
export function useMarkAllAsReadMutationOptions() {
  const notificationApi = useNotificationApi();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationKey: NOTIFICATION_MUTATION_KEYS.writes(),
    mutationFn: async () => unwrap(await notificationApi.markAllAsRead()),
    onMutate: async () => ({ change: await optimisticallyMarkNotificationsRead(queryClient) }),
    onError: (_error, _variables, context) => {
      if (context?.change != null) {
        revertNotificationsRead(queryClient, context.change);
      }
    },
    onSettled: () => invalidateAfterLastNotificationWrite(queryClient),
    meta: {
      errorFeedback: {
        feature: 'notification',
        fallbackKey: 'notification:list.markAllReadFailed',
      },
    },
  });
}

export function useMarkAsReadMutationOptions() {
  const haptics = useHaptics();
  const notificationApi = useNotificationApi();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationKey: NOTIFICATION_MUTATION_KEYS.writes(),
    mutationFn: async (notificationId: number) =>
      unwrap(await notificationApi.markAsRead(notificationId)),
    onMutate: async (notificationId) => ({
      change: await optimisticallyMarkNotificationsRead(queryClient, notificationId),
    }),
    onError: (_error, _variables, context) => {
      if (context?.change != null) {
        revertNotificationsRead(queryClient, context.change);
      }
      // 읽음은 다음 탭에 다시 보내므로 이어서 이동한 화면을 토스트로 가리지 않는다
      haptics.notify('error');
    },
    onSettled: () => invalidateAfterLastNotificationWrite(queryClient),
    meta: { errorFeedback: false },
  });
}

/** 알림을 거절해 시스템 창을 다시 띄울 수 없을 때 이 앱의 설정 화면을 연다. 돌아오면 권한 쿼리가 다시 읽는다 */
export function useOpenPushSettingsMutationOptions() {
  const externalLink = useExternalLink();
  const logger = useLogger();
  const haptics = useHaptics();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: () => externalLink.openSettings(),
    networkMode: 'always',
    onError: (error) => {
      logger.warn(NOTIFICATION_LOG_EVENT.PUSH_PERMISSION_SETTINGS_OPEN_FAILED, {
        error: getErrorMessage(error),
      });
      haptics.notify('error');
      toast.error(t('notification:permission.toasts.settingsOpenFailed'));
    },
    meta: { errorFeedback: false },
  });
}

/** 화면 뒤에서 기기 상태를 서버에 알린다. 실패는 다음 동기화 때 다시 보내므로 사용자에게 보이지 않는다 */
export function useReportPushDeviceMutationOptions() {
  const pushRegistrationService = usePushRegistrationService();
  const logger = useLogger();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async ({ force }: { force: boolean }) =>
      unwrap(await pushRegistrationService.report({ force })),
    onSuccess: () => invalidatePushPermission(queryClient),
    onError: (error) => {
      if (isPushReportRetryableError(error)) {
        logger.warn(NOTIFICATION_LOG_EVENT.PUSH_DEVICE_REPORT_FAILED, {
          error: getErrorMessage(error),
        });
        return;
      }
      logger.error(NOTIFICATION_LOG_EVENT.PUSH_DEVICE_REPORT_FAILED, toError(error));
    },
    meta: { errorFeedback: false },
  });
}

export function useRequestPushPermissionMutationOptions() {
  const pushRegistrationService = usePushRegistrationService();
  const logger = useLogger();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: () => pushRegistrationService.requestPermission(),
    // 권한 창은 기기 안에서 뜨므로 오프라인에서도 멈추지 않는다
    networkMode: 'always',
    onSuccess: (permission) => {
      setCachedPushPermission(queryClient, permission);
    },
    onError: (error) => {
      logger.warn(NOTIFICATION_LOG_EVENT.PUSH_PERMISSION_REQUEST_FAILED, {
        error: getErrorMessage(error),
      });
      haptics.notify('error');
      toast.error(t('notification:permission.toasts.requestFailed'));
    },
    meta: { errorFeedback: false },
  });
}

function shouldRetryPushOpened(failureCount: number, error: unknown) {
  return (
    failureCount < PUSH_OPENED_RETRIES &&
    (isConnectivityError(error) || error instanceof ServerError)
  );
}

/** 서버의 opened는 읽음도 처리하므로 예산 안에 읽음을 확인하지 못한 탭도 여기서 뒤늦게 읽음이 된다 */
export function useRecordPushOpenedMutationOptions() {
  const notificationApi = useNotificationApi();
  const sessionEpoch = useSessionEpoch();
  const logger = useLogger();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationKey: NOTIFICATION_MUTATION_KEYS.writes(),
    mutationFn: async (notificationId: number) =>
      unwrap(await notificationApi.markOpened(notificationId)),
    retry: shouldRetryPushOpened,
    onMutate: (notificationId) => {
      const epoch = sessionEpoch.current();
      const isSameSession = () => sessionEpoch.current() === epoch;
      optimisticallyMarkNotificationsRead(queryClient, notificationId, {
        shouldApply: isSameSession,
      }).catch((error) =>
        logger.warn(NOTIFICATION_LOG_EVENT.LOCAL_READ_SYNC_FAILED, {
          error: getErrorMessage(error),
        }),
      );
      return { epoch };
    },
    onError: (error) =>
      logger.warn(NOTIFICATION_LOG_EVENT.OPEN_RECORDING_FAILED, {
        error: getErrorMessage(error),
      }),
    // onMutate의 수는 느린 망이나 오프라인이면 읽음 처리 전 수다. 서버가 처리한 뒤(실패면 되돌린 뒤)의 수로 다시 맞춘다
    onSettled: (_opened, _error, _notificationId, context) =>
      sessionEpoch.current() === context?.epoch
        ? invalidateAfterLastNotificationWrite(queryClient)
        : undefined,
    meta: { errorFeedback: false },
  });
}

// 권한 창이 닫힐 때까지 pending이라 토글을 두 번 누를 수 없다
export function useUpdatePushEnabledAndAskPermissionMutationOptions() {
  const updatePreferenceOptions = useUpdatePreferenceMutationOptions();
  const pushRegistrationService = usePushRegistrationService();
  const logger = useLogger();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const toast = useAppToast();

  return mutationOptions({
    ...updatePreferenceOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await updatePreferenceOptions.onSuccess?.(data, variables, onMutateResult, context);
      if (variables.pushEnabled !== true) {
        return;
      }
      await pushRegistrationService.requestPermission().then(
        (permission) => {
          setCachedPushPermission(queryClient, permission);
        },
        (error: unknown) => {
          logger.warn(NOTIFICATION_LOG_EVENT.PUSH_PERMISSION_REQUEST_FAILED, {
            error: getErrorMessage(error),
          });
          haptics.notify('error');
          toast.error(t('notification:permission.toasts.requestFailed'));
        },
      );
    },
  });
}
