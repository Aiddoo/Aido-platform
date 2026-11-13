import {
  useHaptics,
  useLogger,
  useNotificationApi,
  useSessionEpoch,
} from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useConsentResultToast } from '@src/features/identity/consent/hooks/use-consent-result-toast';
import { invalidateConsent } from '@src/features/identity/consent/queries/consent-cache';
import { useTrack } from '@src/shared/analytics';
import { getErrorMessage, isConnectivityError, ServerError, toError } from '@src/shared/errors';
import { isLastMutation } from '@src/shared/query/is-last-mutation';
import { mutationOptions, type QueryClient, useQueryClient } from '@tanstack/react-query';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import {
  invalidateNotifications,
  optimisticallyMarkNotificationsRead,
  revertNotificationsRead,
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
  const logger = useLogger();
  const notificationApi = useNotificationApi();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationKey: NOTIFICATION_MUTATION_KEYS.writes(),
    mutationFn: async (notificationId: number) =>
      unwrap(await notificationApi.markAsRead(notificationId)),
    onMutate: async (notificationId) => ({
      change: await optimisticallyMarkNotificationsRead(queryClient, notificationId),
    }),
    onError: (error, _variables, context) => {
      if (context?.change != null) {
        revertNotificationsRead(queryClient, context.change);
      }
      // 읽음은 다음 탭에 다시 보내므로 이어서 이동한 화면을 토스트로 가리지 않고, 예상하지 못한 실패만 보고한다
      haptics.notify('error');
      logger.error(NOTIFICATION_LOG_EVENT.MARK_READ_FAILED, toError(error));
    },
    onSettled: () => invalidateAfterLastNotificationWrite(queryClient),
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

/** 알림의 [광고 알림 끄기]를 보낸다. 실패는 알리지 않고 응답을 남겨 앱이 다시 앞에 오면 또 보낸다 */
export function useOptOutMarketingPushMutationOptions() {
  const notificationApi = useNotificationApi();
  const sessionEpoch = useSessionEpoch();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const showConsentResult = useConsentResultToast();

  return mutationOptions({
    mutationFn: async (token: string) => unwrap(await notificationApi.optOutMarketingPush(token)),
    onMutate: () => ({ epoch: sessionEpoch.current() }),
    // 보내는 사이 로그아웃했으면 끝난 화면·캐시에 안내와 무효화를 남기지 않는다
    onSuccess: ({ withdrawnAt }, _token, context) => {
      if (sessionEpoch.current() !== context.epoch) {
        return;
      }
      trackEvent('marketing_push_opted_out', { source: 'push_action' });
      // 설정 토글과 같은 결과 안내(처리 일시는 서버 값)를 띄운다
      showConsentResult('marketingPush', { type: 'withdrawn', at: withdrawnAt });
    },
    onSettled: (_result, _error, _token, context) =>
      sessionEpoch.current() === context?.epoch ? invalidateConsent(queryClient) : undefined,
    meta: { errorFeedback: false },
  });
}
