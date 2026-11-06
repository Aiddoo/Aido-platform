import { useAuth } from '@src/bootstrap/providers/auth-provider';
import {
  useLogger,
  useNotificationEntryStore,
  useNotificationService,
  usePushNotificationGateway,
  useSessionEpoch,
} from '@src/bootstrap/providers/di-context';
import type { PushNotificationResponse } from '@src/core/ports/push-notification-gateway';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { getErrorMessage, unwrap } from '@src/shared/errors';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'expo-router';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import { AppState } from 'react-native';

import { toPushNotificationPayload } from '../apis/notification.mapper';
import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { NotificationPolicy } from '../domains/notification.model';
import { useRecordPushOpenedMutationOptions } from '../queries/notification.mutations';
import type {
  PendingNotificationResponse,
  PushNotificationPayload,
} from '../schemas/notification.schema';
import { resolveNotificationDestination } from '../utils/notification-destination';
import { useNotificationNavigation } from './use-notification-navigation';

/** 여기서 목적지를 열면 로딩이 끝날 때 라우트 가드가 `/`로 되돌려 목적지를 잃는다(꺼진 앱에서 알림을 누른 경우) */
const STARTUP_PATHNAMES: ReadonlySet<string> = new Set(['/', '/loading']);

/**
 * 푸시 응답의 입구 하나. 마지막 응답과 응답 리스너를 슬롯 하나로 모으고,
 * 판단은 NotificationPolicy, 목적지는 resolveNotificationDestination에 맡긴다.
 */
export function useNotificationResponseObserver(): void {
  const { status } = useAuth();
  const gateway = usePushNotificationGateway();
  const store = useNotificationEntryStore();
  const logger = useLogger();
  const { pending, optOut } = useSyncExternalStore(store.subscribe, store.getState);
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
    const receive = (response: PushNotificationResponse) => {
      const parsed = toPushNotificationPayload(response.data);
      if (!parsed.success) {
        logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_PAYLOAD_INVALID, {
          error: getErrorMessage(parsed.error),
        });
        return;
      }
      store.receive({
        id: response.id,
        actionIdentifier: response.actionIdentifier,
        data: parsed.payload,
        receivedAt: Date.now(),
      });
    };
    const last = gateway.getLastResponse();
    if (last != null) {
      receive(last);
    }
    return gateway.addResponseListener(receive);
  }, [gateway, logger, store]);

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
  useOpenResponse(pending, finishResponse);
}

function useMarketingOptOut(
  response: PendingNotificationResponse | null,
  finishResponse: (responseId: string) => void,
) {
  const { status } = useAuth();
  const notificationService = useNotificationService();
  const logger = useLogger();
  const { trackEvent } = useTrack();
  const inFlightIdRef = useRef<string | null>(null);

  const send = useEffectEvent(async (target: PendingNotificationResponse) => {
    if (inFlightIdRef.current === target.id) {
      return;
    }
    const action = NotificationPolicy.getResponseAction(target, {
      authStatus: status,
      now: Date.now(),
    });
    const token = target.data.marketingOptOutToken;
    if (action.type === 'drop' || !token) {
      finishResponse(target.id);
      return;
    }
    inFlightIdRef.current = target.id;
    try {
      unwrap(await notificationService.optOutMarketingPush(token));
      try {
        trackEvent('marketing_push_opted_out', { source: 'push_action' });
      } catch (error) {
        logger.warn(NOTIFICATION_LOG_EVENT.OPT_OUT_ANALYTICS_FAILED, {
          error: getErrorMessage(error),
        });
      }
      finishResponse(target.id);
    } catch (error) {
      logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_DEFERRED, { error: getErrorMessage(error) });
    } finally {
      inFlightIdRef.current = null;
    }
  });

  useEffect(() => {
    if (response == null) {
      return;
    }
    send(response);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        send(response);
      }
    });
    return () => subscription.remove();
  }, [response]);
}

function useOpenResponse(
  response: PendingNotificationResponse | null,
  finishResponse: (responseId: string) => void,
) {
  const { status } = useAuth();
  const store = useNotificationEntryStore();
  const notificationService = useNotificationService();
  const sessionEpoch = useSessionEpoch();
  const logger = useLogger();
  const queryClient = useQueryClient();
  const navigate = useNotificationNavigation();
  const today = useTodayKey();
  const windowSizeClass = useWindowSizeClass();
  const trackOpened = useTrackPushOpened();
  const { mutate: recordOpened } = useMutation(useRecordPushOpenedMutationOptions());
  const pathname = usePathname();
  const isStartupRoute = STARTUP_PATHNAMES.has(pathname);
  const inFlightIdRef = useRef<string | null>(null);

  const open = useEffectEvent(async (target: PendingNotificationResponse) => {
    if (inFlightIdRef.current === target.id) {
      return;
    }
    inFlightIdRef.current = target.id;
    const epoch = sessionEpoch.current();
    const isCurrent = () =>
      sessionEpoch.current() === epoch && store.getState().pending?.id === target.id;
    const { data } = target;
    try {
      const ownership = await notificationService.checkOwnership(data.notificationId);
      if (!isCurrent()) {
        return;
      }
      if (ownership !== 'foreign') {
        await navigate(
          resolveNotificationDestination(data, {
            today,
            windowSizeClass,
            viewerId: getCachedMe(queryClient)?.id,
          }),
        );
        trackOpened(data);
        if (data.notificationId > 0) {
          recordOpened(data.notificationId);
        }
      }
      finishResponse(target.id);
    } catch (error) {
      // 외부 링크를 열지 못한 경우다. 같은 탭을 다시 시도하지 않고 끝낸다
      logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_OPEN_FAILED, { error: getErrorMessage(error) });
      finishResponse(target.id);
    } finally {
      if (inFlightIdRef.current === target.id) {
        inFlightIdRef.current = null;
      }
    }
  });

  const decide = useEffectEvent((target: PendingNotificationResponse) => {
    const action = NotificationPolicy.getResponseAction(target, {
      authStatus: status,
      now: Date.now(),
    });
    if (action.type === 'drop') {
      finishResponse(target.id);
      return;
    }
    if (action.type === 'open' && !isStartupRoute) {
      open(target);
    }
  });

  useEffect(() => {
    if (response != null) {
      decide(response);
    }
  }, [isStartupRoute, response, status]);
}

function useTrackPushOpened() {
  const { trackEvent } = useTrack();
  const logger = useLogger();

  return (data: PushNotificationPayload) => {
    try {
      trackEvent('push_notification_opened', {
        type: data.type ?? 'UNKNOWN',
        action: data.action.type,
        ...(data.campaignKey && { campaign_key: data.campaignKey }),
        ...(data.variantId && { variant_id: data.variantId }),
        ...(data.purpose && { purpose: data.purpose }),
      });
      if (data.type === 'WEEKLY_ACHIEVEMENT') {
        trackEvent('badge_opened_from_notification');
      }
    } catch (error) {
      logger.warn(NOTIFICATION_LOG_EVENT.OPEN_ANALYTICS_FAILED, { error: getErrorMessage(error) });
    }
  };
}
