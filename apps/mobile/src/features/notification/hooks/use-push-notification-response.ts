import {
  useAppLifecycle,
  useLogger,
  useNotificationApi,
  usePushNotification,
  usePushNotificationEntryStore,
  useSessionEpoch,
} from '@src/bootstrap/providers/di-context';
import type { PushNotificationResponse as OsPushNotificationResponse } from '@src/core/ports/push-notification-gateway';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useConsentResultToast } from '@src/features/identity/consent/hooks/use-consent-result-toast';
import { invalidateConsent } from '@src/features/identity/consent/queries/consent-cache';
import { useTrack } from '@src/shared/analytics';
import { type Instant } from '@src/shared/date/instant';
import { getErrorMessage, unwrap } from '@src/shared/errors';
import { useIsRestoring, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react';

import { parsePushNotification } from '../apis/push-notification.mapper';
import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { NOTIFICATION_ENTRY_HOLD_MAX_MS } from '../constants/notification.constants';
import {
  type PushNotificationResponse,
  PushNotificationResponsePolicy,
} from '../domains/push-notification-response.model';
import {
  createUnreadablePushNotification,
  PushNotificationPolicy,
} from '../domains/push-notification.model';
import { useRecordPushOpenedMutationOptions } from '../queries/notification.mutations';
import type { ReadyPushNotificationEntry } from '../stores/push-notification-entry.store';
import {
  useOpenNotificationDestination,
  useResolveNotificationDestination,
} from './use-notification-destination';
import { usePushNotificationEntry } from './use-push-notification-entry';

/** 푸시 응답의 입구 하나. 마지막 응답과 응답 리스너를 슬롯 하나로 모은다 */
export function usePushNotificationResponse(): void {
  const status = useAuthStatus();
  const gateway = usePushNotification();
  const appLifecycle = useAppLifecycle();
  const store = usePushNotificationEntryStore();
  const logger = useLogger();
  const { pending, ready, optOut } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const clearLastResponse = useCallback(() => {
    try {
      gateway.clearLastResponse();
    } catch (error) {
      logger.warn(NOTIFICATION_LOG_EVENT.SESSION_RESPONSE_CLEANUP_FAILED, {
        error: getErrorMessage(error),
      });
    }
  }, [gateway, logger]);
  const finishResponse = useCallback(
    (responseId: string) => {
      store.settle(responseId);
      clearLastResponse();
    },
    [clearLastResponse, store],
  );

  useLayoutEffect(() => {
    let activeSince = appLifecycle.getCurrentState() === 'active' ? Date.now() : null;
    const removeAppStateListener = appLifecycle.subscribe((state) => {
      activeSince = state === 'active' ? Date.now() : null;
    });
    const receive = (
      response: OsPushNotificationResponse,
      { isLaunchResponse }: { isLaunchResponse: boolean },
    ) => {
      const { notification, droppedPaths } = parsePushNotification(response.data);
      if (droppedPaths.length > 0) {
        logger.warn(NOTIFICATION_LOG_EVENT.PUSH_PAYLOAD_DROPPED, {
          source: 'response',
          responseId: response.id,
          droppedPaths,
          isReadable: notification != null,
        });
      }
      store.receive({
        id: response.id,
        actionIdentifier: response.actionIdentifier,
        notification: notification ?? createUnreadablePushNotification(),
        receivedAt: Date.now(),
        isLaunchResponse,
        appState: appLifecycle.getCurrentState(),
        activeSince,
      });
    };
    const launchResponse = gateway.getLastResponse();
    if (launchResponse != null) {
      receive(launchResponse, { isLaunchResponse: true });
    }
    const removeResponseListener = gateway.subscribeResponse((response) =>
      receive(response, { isLaunchResponse: false }),
    );
    return () => {
      removeAppStateListener();
      removeResponseListener();
    };
  }, [appLifecycle, gateway, logger, store]);

  const wasAuthenticatedRef = useRef(status === 'authenticated');
  useLayoutEffect(() => {
    const wasAuthenticated = wasAuthenticatedRef.current;
    wasAuthenticatedRef.current = status === 'authenticated';
    if (!wasAuthenticated || status === 'authenticated') {
      return;
    }
    store.clear();
    clearLastResponse();
  }, [clearLastResponse, status, store]);

  useMarketingOptOut(optOut, finishResponse);
  useResolveResponse(pending, finishResponse);
  useOpenReadyEntry(ready, finishResponse);
}

function useMarketingOptOut(
  response: PushNotificationResponse | null,
  finishResponse: (responseId: string) => void,
) {
  const status = useAuthStatus();
  const notificationApi = useNotificationApi();
  const appLifecycle = useAppLifecycle();
  const logger = useLogger();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const showConsentResult = useConsentResultToast();
  const inFlightIdRef = useRef<string | null>(null);

  const send = useEffectEvent(async (target: PushNotificationResponse, signal: AbortSignal) => {
    if (inFlightIdRef.current === target.id) {
      return;
    }
    const action = PushNotificationResponsePolicy.getResponseAction(target, {
      authStatus: status,
      now: Date.now(),
    });
    const token = target.notification.marketingOptOutToken;
    if (action.type === 'drop' || !token) {
      finishResponse(target.id);
      return;
    }
    inFlightIdRef.current = target.id;
    let withdrawnAt: Instant;
    try {
      ({ withdrawnAt } = unwrap(await notificationApi.optOutMarketingPush(token)));
    } catch (error) {
      logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_DEFERRED, { error: getErrorMessage(error) });
      return;
    } finally {
      inFlightIdRef.current = null;
    }
    // 보내는 사이 로그아웃으로 슬롯이 비었거나 훅이 내려갔으면 끝난 화면·캐시에 안내와 무효화를 남기지 않는다
    if (signal.aborted) {
      return;
    }
    try {
      trackEvent('marketing_push_opted_out', { source: 'push_action' });
    } catch (error) {
      logger.warn(NOTIFICATION_LOG_EVENT.OPT_OUT_ANALYTICS_FAILED, {
        error: getErrorMessage(error),
      });
    }
    finishResponse(target.id);
    // 설정 토글과 같은 결과 안내(처리 일시는 서버 값)를 띄우고, 설정 화면의 토글도 서버 값으로 맞춘다
    showConsentResult('marketingPush', { type: 'withdrawn', at: withdrawnAt });
    invalidateConsent(queryClient);
  });

  useEffect(() => {
    if (response == null) {
      return;
    }
    const controller = new AbortController();
    send(response, controller.signal);
    const removeAppStateListener = appLifecycle.subscribe((state) => {
      if (state === 'active') {
        send(response, controller.signal);
      }
    });
    return () => {
      controller.abort();
      removeAppStateListener();
    };
  }, [appLifecycle, response]);
}

/** 인증과 복원이 끝난 탭의 소유를 확인하고 목적지를 정한다 */
function useResolveResponse(
  response: PushNotificationResponse | null,
  finishResponse: (responseId: string) => void,
) {
  const status = useAuthStatus();
  const isRestoring = useIsRestoring();
  const store = usePushNotificationEntryStore();
  const notificationApi = useNotificationApi();
  const sessionEpoch = useSessionEpoch();
  const logger = useLogger();
  const resolveDestination = useResolveNotificationDestination();
  const inFlightIdRef = useRef<string | null>(null);

  const resolve = useEffectEvent(async (target: PushNotificationResponse) => {
    if (inFlightIdRef.current === target.id) {
      return;
    }
    inFlightIdRef.current = target.id;
    const epoch = sessionEpoch.current();
    const isCurrent = () =>
      sessionEpoch.current() === epoch && store.getSnapshot().pending?.id === target.id;
    const { notification } = target;
    try {
      const ownership = await notificationApi.markAsReadAndCheckOwnership(
        notification.notificationId,
      );
      if (!isCurrent()) {
        return;
      }
      if (ownership === 'foreign') {
        finishResponse(target.id);
        return;
      }
      store.markReady(target.id, resolveDestination(notification.target));
    } catch (error) {
      logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_OPEN_FAILED, { error: getErrorMessage(error) });
      // 끝난 세션이나 밀려난 탭의 실패로 새 탭의 마지막 응답을 지우지 않는다
      if (isCurrent()) {
        finishResponse(target.id);
      }
    } finally {
      if (inFlightIdRef.current === target.id) {
        inFlightIdRef.current = null;
      }
    }
  });

  const decide = useEffectEvent((target: PushNotificationResponse) => {
    const action = PushNotificationResponsePolicy.getResponseAction(target, {
      authStatus: status,
      now: Date.now(),
    });
    if (action.type === 'drop') {
      finishResponse(target.id);
      return;
    }
    if (action.type === 'open' && !isRestoring) {
      resolve(target);
    }
  });

  useEffect(() => {
    if (response != null) {
      decide(response);
    }
  }, [isRestoring, response, status]);
}

/** 앱에 들어가는 중이면 Index가 경로를 열고, 앱 안이면 여기서 연다 */
function useOpenReadyEntry(
  entry: ReadyPushNotificationEntry | null,
  finishResponse: (responseId: string) => void,
) {
  const { isEnteringApp } = usePushNotificationEntry();
  const logger = useLogger();
  const openDestination = useOpenNotificationDestination();
  const { trackEvent } = useTrack();
  const { mutate: recordOpened } = useMutation(useRecordPushOpenedMutationOptions());
  const openedByIndexIdRef = useRef<string | null>(null);
  const inFlightIdRef = useRef<string | null>(null);

  const open = useEffectEvent(async ({ response, destination }: ReadyPushNotificationEntry) => {
    if (inFlightIdRef.current === response.id) {
      return;
    }
    inFlightIdRef.current = response.id;
    const { notification } = response;
    try {
      if (destination.kind !== 'route' || openedByIndexIdRef.current !== response.id) {
        await openDestination(destination);
      }
      try {
        trackEvent('push_notification_opened', {
          type: notification.type ?? 'UNKNOWN',
          action: notification.actionType,
          app_state: PushNotificationResponsePolicy.getOpenAppState(response),
          ...(notification.campaignKey && { campaign_key: notification.campaignKey }),
          ...(notification.variantId && { variant_id: notification.variantId }),
          ...(notification.purpose && { purpose: notification.purpose }),
        });
        if (notification.type === 'WEEKLY_ACHIEVEMENT') {
          trackEvent('badge_opened_from_notification');
        }
      } catch (error) {
        logger.warn(NOTIFICATION_LOG_EVENT.OPEN_ANALYTICS_FAILED, {
          error: getErrorMessage(error),
        });
      }
      if (PushNotificationPolicy.hasServerRecord(notification)) {
        recordOpened(notification.notificationId);
      }
    } catch (error) {
      // 외부 링크를 열지 못한 경우다. 같은 탭을 다시 시도하지 않고 끝낸다
      logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_OPEN_FAILED, { error: getErrorMessage(error) });
    } finally {
      inFlightIdRef.current = null;
      finishResponse(response.id);
    }
  });

  // 목적지로 못 가 피드로 보내도 사용자는 알림을 열었으므로 열람(읽음 포함)은 남긴다
  const abandon = useEffectEvent(({ response }: ReadyPushNotificationEntry) => {
    logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_OPEN_FAILED, { responseId: response.id });
    if (PushNotificationPolicy.hasServerRecord(response.notification)) {
      recordOpened(response.notification.notificationId);
    }
    finishResponse(response.id);
  });

  useEffect(() => {
    if (entry == null) {
      return;
    }
    if (!isEnteringApp) {
      open(entry);
      return;
    }
    openedByIndexIdRef.current = entry.response.id;
    // Index가 이동하지 못하면 슬롯을 비워 피드로 보낸다
    const timer = setTimeout(() => abandon(entry), NOTIFICATION_ENTRY_HOLD_MAX_MS);
    return () => clearTimeout(timer);
  }, [entry, isEnteringApp]);
}
