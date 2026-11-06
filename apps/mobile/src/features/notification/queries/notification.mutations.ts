import {
  useHaptics,
  useLogger,
  useNotificationService,
  usePushDeviceService,
} from '@src/bootstrap/providers/di-context';
import { getErrorMessage, isApiError, isConnectivityError, toError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';
import {
  invalidatePushPermission,
  optimisticallyMarkNotificationsRead,
  restoreNotificationCache,
  setCachedPushPermission,
} from './notification-cache';

export function useMarkAllAsReadMutationOptions() {
  const haptics = useHaptics();
  const notificationService = useNotificationService();
  const logger = useLogger();
  const queryClient = useQueryClient();

  // 배지는 겉모습이다 — 일부 안드로이드 런처에서 이 네이티브 호출이 거부하는데,
  // 그것 때문에 읽음 처리가 통째로 실패하면 안 된다.
  const clearBadgeQuietly = () => {
    notificationService
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all });
      clearBadgeQuietly();
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshot) {
        restoreNotificationCache(queryClient, context.snapshot);
      }
      notificationService
        .syncBadgeCount()
        .catch((error) =>
          logger.warn(NOTIFICATION_LOG_EVENT.BADGE_SYNC_FAILED, { error: getErrorMessage(error) }),
        );
      haptics.notify('error');
    },
  });
}

export function useMarkAsReadMutationOptions() {
  const haptics = useHaptics();
  const notificationService = useNotificationService();
  const logger = useLogger();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async (notificationId: number) =>
      unwrap(await notificationService.markAsRead(notificationId)),
    onMutate: async (notificationId) => {
      const snapshot = await optimisticallyMarkNotificationsRead(queryClient, notificationId);
      const count = queryClient.getQueryData<number>(NOTIFICATION_QUERY_KEYS.unreadCount());
      // 읽지 않은 수를 아직 모르면 배지를 0으로 지우지 않고 성공 뒤 서버 값으로 맞춘다.
      // 일부 Android 런처는 배지 호출을 거부하므로 그 실패로 읽음 처리가 멈추지 않게 한다
      if (count != null) {
        notificationService.setBadgeCount(count).catch((error) =>
          logger.warn(NOTIFICATION_LOG_EVENT.BADGE_SYNC_FAILED, {
            error: getErrorMessage(error),
          }),
        );
      }
      return { snapshot, hasBadgeCount: count != null };
    },
    onSuccess: async (_data, _notificationId, context) => {
      await queryClient.invalidateQueries({
        queryKey: NOTIFICATION_QUERY_KEYS.all,
      });
      if (!context.hasBadgeCount) {
        notificationService.syncBadgeCount().catch((error) =>
          logger.warn(NOTIFICATION_LOG_EVENT.BADGE_SYNC_FAILED, {
            error: getErrorMessage(error),
          }),
        );
      }
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshot) {
        restoreNotificationCache(queryClient, context.snapshot);
      }
      notificationService
        .syncBadgeCount()
        .catch((error) =>
          logger.warn(NOTIFICATION_LOG_EVENT.BADGE_SYNC_FAILED, { error: getErrorMessage(error) }),
        );
      haptics.notify('error');
    },
  });
}

/** 알림을 거절해 시스템 창을 다시 띄울 수 없을 때 이 앱의 설정 화면을 연다. 돌아오면 권한 쿼리가 다시 읽는다 */
export function useOpenPushSettingsMutationOptions() {
  const pushDeviceService = usePushDeviceService();
  const logger = useLogger();

  return mutationOptions({
    mutationFn: () => pushDeviceService.openSettings(),
    networkMode: 'always',
    onError: (error) => {
      logger.warn(NOTIFICATION_LOG_EVENT.PUSH_PERMISSION_SETTINGS_OPEN_FAILED, {
        error: getErrorMessage(error),
      });
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
      if (isApiError(error) || isConnectivityError(error)) {
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
    },
  });
}
