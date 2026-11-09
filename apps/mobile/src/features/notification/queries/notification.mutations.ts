import {
  useExternalLink,
  useHaptics,
  useLogger,
  useNotificationBadgeService,
  useNotificationService,
  usePushDeviceService,
  useSessionEpoch,
} from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useUpdatePreferenceMutationOptions } from '@src/features/identity/preference/queries/preference.mutations';
import {
  getErrorMessage,
  getUserFacingMessage,
  isConnectivityError,
  ServerError,
  toError,
} from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';
import { isPushReportRetryableError } from '../domains/notification.error';
import {
  invalidateNotifications,
  invalidatePushPermission,
  optimisticallyMarkNotificationsRead,
  restoreNotificationCache,
  setCachedPushPermission,
} from './notification-cache';

const PUSH_OPENED_RETRIES = 3;

export function useMarkAllAsReadMutationOptions() {
  const notificationBadgeService = useNotificationBadgeService();
  const haptics = useHaptics();
  const toast = useAppToast();
  const notificationService = useNotificationService();
  const logger = useLogger();
  const queryClient = useQueryClient();

  // 일부 Android 런처는 배지 호출을 거부하므로 그 실패로 읽음 처리가 실패하지 않게 한다
  const clearBadgeQuietly = () => {
    notificationBadgeService
      .clearBadge()
      .catch((error) =>
        logger.warn(NOTIFICATION_LOG_EVENT.BADGE_CLEAR_FAILED, { error: getErrorMessage(error) }),
      );
  };

  return mutationOptions({
    mutationFn: async () => unwrap(await notificationService.markAllAsRead()),
    onMutate: async () => {
      const snapshot = await optimisticallyMarkNotificationsRead(queryClient);
      clearBadgeQuietly();
      return { snapshot };
    },
    onSuccess: () => {
      clearBadgeQuietly();
    },
    onError: (error, _variables, context) => {
      if (context != null) {
        restoreNotificationCache(queryClient, context.snapshot);
      }
      notificationBadgeService
        .syncBadgeCount()
        .catch((error) =>
          logger.warn(NOTIFICATION_LOG_EVENT.BADGE_SYNC_FAILED, { error: getErrorMessage(error) }),
        );
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), {
        fallback: t('notification:list.markAllReadFailed'),
      });
    },
    // 실패로 되돌린 뒤에도 서버 값으로 맞춘다
    onSettled: () => invalidateNotifications(queryClient),
  });
}

export function useMarkAsReadMutationOptions() {
  const notificationBadgeService = useNotificationBadgeService();
  const haptics = useHaptics();
  const notificationService = useNotificationService();
  const logger = useLogger();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async (notificationId: number) =>
      unwrap(await notificationService.markAsRead(notificationId)),
    onMutate: async (notificationId) => {
      const snapshot = await optimisticallyMarkNotificationsRead(queryClient, notificationId);
      const count = queryClient.getQueryData(NOTIFICATION_QUERY_KEYS.unreadCount());
      // 수를 모르면 배지를 0으로 지우지 않는다. 일부 Android 런처는 배지 호출을 거부해 경고만 남긴다
      if (count != null) {
        notificationBadgeService.setBadgeCount(count).catch((error) =>
          logger.warn(NOTIFICATION_LOG_EVENT.BADGE_SYNC_FAILED, {
            error: getErrorMessage(error),
          }),
        );
      }
      return { snapshot, hasBadgeCount: count != null };
    },
    onSuccess: (_data, _notificationId, context) => {
      if (!context.hasBadgeCount) {
        notificationBadgeService.syncBadgeCount().catch((error) =>
          logger.warn(NOTIFICATION_LOG_EVENT.BADGE_SYNC_FAILED, {
            error: getErrorMessage(error),
          }),
        );
      }
    },
    onError: (_error, _variables, context) => {
      if (context != null) {
        restoreNotificationCache(queryClient, context.snapshot);
      }
      notificationBadgeService
        .syncBadgeCount()
        .catch((error) =>
          logger.warn(NOTIFICATION_LOG_EVENT.BADGE_SYNC_FAILED, { error: getErrorMessage(error) }),
        );
      // 읽음은 다음 탭에 다시 보내므로 이어서 이동한 화면을 토스트로 가리지 않는다
      haptics.notify('error');
    },
    onSettled: () => invalidateNotifications(queryClient),
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
  });
}

/** 화면 뒤에서 기기 상태를 서버에 알린다. 실패는 다음 동기화 때 다시 보내므로 사용자에게 보이지 않는다 */
export function useReportPushDeviceMutationOptions() {
  const pushDeviceService = usePushDeviceService();
  const logger = useLogger();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async ({ force }: { force: boolean }) =>
      unwrap(await pushDeviceService.report({ force })),
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
  });
}

export function useRequestPushPermissionMutationOptions() {
  const pushDeviceService = usePushDeviceService();
  const logger = useLogger();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: () => pushDeviceService.requestPermission(),
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
  const notificationBadgeService = useNotificationBadgeService();
  const notificationService = useNotificationService();
  const sessionEpoch = useSessionEpoch();
  const logger = useLogger();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async (notificationId: number) =>
      unwrap(await notificationService.markOpened(notificationId)),
    retry: shouldRetryPushOpened,
    onMutate: (notificationId) => {
      const epoch = sessionEpoch.current();
      const isSameSession = () => sessionEpoch.current() === epoch;
      optimisticallyMarkNotificationsRead(queryClient, notificationId, {
        shouldApply: isSameSession,
      })
        .then(() => (isSameSession() ? notificationBadgeService.syncBadgeCount() : undefined))
        .catch((error) =>
          logger.warn(NOTIFICATION_LOG_EVENT.LOCAL_READ_SYNC_FAILED, {
            error: getErrorMessage(error),
          }),
        );
      return { epoch };
    },
    // onMutate의 배지는 느린 망이나 오프라인이면 읽음 처리 전 수다. 서버가 처리한 뒤의 수로 다시 맞춘다
    onSuccess: (_opened, _notificationId, { epoch }) =>
      sessionEpoch.current() === epoch
        ? Promise.all([
            invalidateNotifications(queryClient),
            notificationBadgeService.syncBadgeCount().catch((error) =>
              logger.warn(NOTIFICATION_LOG_EVENT.LOCAL_READ_SYNC_FAILED, {
                error: getErrorMessage(error),
              }),
            ),
          ])
        : undefined,
    onError: (error) =>
      logger.warn(NOTIFICATION_LOG_EVENT.OPEN_RECORDING_FAILED, {
        error: getErrorMessage(error),
      }),
  });
}

// 권한 창이 닫힐 때까지 pending이라 토글을 두 번 누를 수 없다
export function useUpdatePushEnabledAndAskPermissionMutationOptions() {
  const updatePreferenceOptions = useUpdatePreferenceMutationOptions();
  const pushDeviceService = usePushDeviceService();
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
      await pushDeviceService.requestPermission().then(
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
