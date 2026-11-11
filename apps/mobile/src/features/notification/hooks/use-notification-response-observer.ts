import {
  useAppLifecycle,
  useLogger,
  useNotificationEntryStore,
  useNotificationService,
  usePushNotification,
  useSessionEpoch,
} from '@src/bootstrap/providers/di-context';
import type { PushNotificationResponse } from '@src/core/ports/push-notification-gateway';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useConsentResultToast } from '@src/features/identity/consent/hooks/use-consent-result-toast';
import { invalidateConsent } from '@src/features/identity/consent/queries/consent-cache';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { type Instant } from '@src/shared/date/instant';
import { getErrorMessage, unwrap } from '@src/shared/errors';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useIsRestoring, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react';

import type { ReadyNotificationEntry } from '../apis/notification-entry.store';
import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { NOTIFICATION_ENTRY_HOLD_MAX_MS } from '../constants/notification.constants';
import { NotificationResponsePolicy, PushNotificationPolicy } from '../domains/notification.model';
import { type PendingNotificationResponse } from '../domains/notification.model';
import { useRecordPushOpenedMutationOptions } from '../queries/notification.mutations';
import { pushNotificationPayloadSchema } from '../schemas/push-notification-payload.schema';
import { resolveNotificationDestination } from '../utils/notification-destination';
import { useNotificationEntry } from './use-notification-entry';
import { useNotificationNavigation } from './use-notification-navigation';

/** 푸시 응답의 입구 하나. 마지막 응답과 응답 리스너를 슬롯 하나로 모은다 */
export function useNotificationResponseObserver(): void {
  const status = useAuthStatus();
  const gateway = usePushNotification();
  const appLifecycle = useAppLifecycle();
  const store = useNotificationEntryStore();
  const logger = useLogger();
  const { pending, ready, optOut } = useSyncExternalStore(store.subscribe, store.getState);
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
      response: PushNotificationResponse,
      { isLaunchResponse }: { isLaunchResponse: boolean },
    ) => {
      const parsed = pushNotificationPayloadSchema.safeParse(response.data);
      if (!parsed.success) {
        logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_PAYLOAD_INVALID, {
          error: getErrorMessage(parsed.error),
        });
        return;
      }
      store.receive({
        id: response.id,
        actionIdentifier: response.actionIdentifier,
        data: parsed.data,
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
  response: PendingNotificationResponse | null,
  finishResponse: (responseId: string) => void,
) {
  const status = useAuthStatus();
  const notificationService = useNotificationService();
  const appLifecycle = useAppLifecycle();
  const logger = useLogger();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const showConsentResult = useConsentResultToast();
  const inFlightIdRef = useRef<string | null>(null);

  const send = useEffectEvent(async (target: PendingNotificationResponse) => {
    if (inFlightIdRef.current === target.id) {
      return;
    }
    const action = NotificationResponsePolicy.getResponseAction(target, {
      authStatus: status,
      now: Date.now(),
    });
    const token = target.data.marketingOptOutToken;
    if (action.type === 'drop' || !token) {
      finishResponse(target.id);
      return;
    }
    inFlightIdRef.current = target.id;
    let withdrawnAt: Instant;
    try {
      ({ withdrawnAt } = unwrap(await notificationService.optOutMarketingPush(token)));
    } catch (error) {
      logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_DEFERRED, { error: getErrorMessage(error) });
      return;
    } finally {
      inFlightIdRef.current = null;
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
    send(response);
    return appLifecycle.subscribe((state) => {
      if (state === 'active') {
        send(response);
      }
    });
  }, [appLifecycle, response]);
}

/** 인증과 복원이 끝난 탭의 소유를 확인하고 목적지를 정한다 */
function useResolveResponse(
  response: PendingNotificationResponse | null,
  finishResponse: (responseId: string) => void,
) {
  const status = useAuthStatus();
  const isRestoring = useIsRestoring();
  const store = useNotificationEntryStore();
  const notificationService = useNotificationService();
  const sessionEpoch = useSessionEpoch();
  const logger = useLogger();
  const queryClient = useQueryClient();
  const windowSizeClass = useWindowSizeClass();
  const inFlightIdRef = useRef<string | null>(null);

  const resolve = useEffectEvent(async (target: PendingNotificationResponse) => {
    if (inFlightIdRef.current === target.id) {
      return;
    }
    inFlightIdRef.current = target.id;
    const epoch = sessionEpoch.current();
    const isCurrent = () =>
      sessionEpoch.current() === epoch && store.getState().pending?.id === target.id;
    const { data } = target;
    try {
      const ownership = await notificationService.markAsReadAndCheckOwnership(data.notificationId);
      if (!isCurrent()) {
        return;
      }
      if (ownership === 'foreign') {
        finishResponse(target.id);
        return;
      }
      store.markReady(
        target.id,
        resolveNotificationDestination(data, {
          shouldOpenToday: true,
          windowSizeClass,
          viewerId: getCachedMe(queryClient)?.id,
        }),
      );
    } catch (error) {
      logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_OPEN_FAILED, { error: getErrorMessage(error) });
      finishResponse(target.id);
    } finally {
      if (inFlightIdRef.current === target.id) {
        inFlightIdRef.current = null;
      }
    }
  });

  const decide = useEffectEvent((target: PendingNotificationResponse) => {
    const action = NotificationResponsePolicy.getResponseAction(target, {
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
  entry: ReadyNotificationEntry | null,
  finishResponse: (responseId: string) => void,
) {
  const { isEnteringApp } = useNotificationEntry();
  const logger = useLogger();
  const navigate = useNotificationNavigation();
  const { trackEvent } = useTrack();
  const { mutate: recordOpened } = useMutation(useRecordPushOpenedMutationOptions());
  const openedByIndexIdRef = useRef<string | null>(null);
  const inFlightIdRef = useRef<string | null>(null);

  const open = useEffectEvent(async ({ response, destination }: ReadyNotificationEntry) => {
    if (inFlightIdRef.current === response.id) {
      return;
    }
    inFlightIdRef.current = response.id;
    const { data } = response;
    try {
      if (destination.kind !== 'route' || openedByIndexIdRef.current !== response.id) {
        await navigate(destination);
      }
      try {
        trackEvent('push_notification_opened', {
          type: data.type ?? 'UNKNOWN',
          action: data.action.type,
          app_state: NotificationResponsePolicy.getOpenAppState(response),
          ...(data.campaignKey && { campaign_key: data.campaignKey }),
          ...(data.variantId && { variant_id: data.variantId }),
          ...(data.purpose && { purpose: data.purpose }),
        });
        if (data.type === 'WEEKLY_ACHIEVEMENT') {
          trackEvent('badge_opened_from_notification');
        }
      } catch (error) {
        logger.warn(NOTIFICATION_LOG_EVENT.OPEN_ANALYTICS_FAILED, {
          error: getErrorMessage(error),
        });
      }
      if (PushNotificationPolicy.hasServerRecord(data)) {
        recordOpened(data.notificationId);
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
  const abandon = useEffectEvent(({ response }: ReadyNotificationEntry) => {
    logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_OPEN_FAILED, { responseId: response.id });
    if (PushNotificationPolicy.hasServerRecord(response.data)) {
      recordOpened(response.data.notificationId);
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
