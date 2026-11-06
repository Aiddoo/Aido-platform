import type { AuthStatus } from '@src/bootstrap/providers/auth-provider';
import { useLogger, usePushNotificationGateway } from '@src/bootstrap/providers/di-context';
import type { PushNotificationResponse } from '@src/core/ports/push-notification-gateway';
import { getErrorMessage } from '@src/shared/errors';
import { useNavigationContainerRef, usePathname } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { toPushNotificationPayload } from '../apis/notification.mapper';
import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { NotificationPolicy } from '../domains/notification.model';
import { type PushNotificationPayload } from '../schemas/notification.schema';
import type { useNotificationResponseHandler } from './use-notification-response-handler';

type PendingNotificationResponse = {
  responseId: string;
  actionIdentifier: string;
  data: PushNotificationPayload;
  accountId: string | null;
  receivedAt: number;
};

const MAX_PENDING_RESPONSES = 20;
const MAX_HANDLED_RESPONSES = 100;
const PENDING_RESPONSE_LIFETIME = 10 * 60_000;
/** 여기서 목적지를 열면 로딩이 끝날 때 라우트 가드가 `/`로 되돌려 목적지를 잃는다(꺼진 앱에서 알림을 누른 경우) */
const STARTUP_PATHNAMES: ReadonlySet<string> = new Set(['/', '/loading']);

export function useNotificationResponseProcessor({
  authStatus,
  accountId,
  handleNotificationResponse,
}: {
  authStatus: AuthStatus;
  accountId: string | null;
  handleNotificationResponse: ReturnType<typeof useNotificationResponseHandler>;
}) {
  const logger = useLogger();
  const gateway = usePushNotificationGateway();
  const navigationRef = useNavigationContainerRef();
  const pathname = usePathname();
  const [isContainerReady, setIsContainerReady] = useState(() => navigationRef.isReady());
  const isNavigationReady = isContainerReady && !STARTUP_PATHNAMES.has(pathname);
  const pendingResponses = useRef(new Map<string, PendingNotificationResponse>());
  const handledResponseIds = useRef(new Set<string>());
  const processingResponseIds = useRef(new Set<string>());
  const session = useRef({ authStatus, accountId });
  const isMounted = useRef(false);

  useLayoutEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      pendingResponses.current.clear();
    };
  }, []);

  useEffect(() => {
    const updateReadiness = () => setIsContainerReady(navigationRef.isReady());
    updateReadiness();
    const unsubscribeState = navigationRef.addListener('state', updateReadiness);
    return () => {
      unsubscribeState();
    };
  }, [navigationRef]);

  useLayoutEffect(() => {
    const previous = session.current;
    session.current = { authStatus, accountId };
    if (
      (previous.authStatus === 'authenticated' && authStatus !== 'authenticated') ||
      (previous.accountId != null && accountId != null && previous.accountId !== accountId)
    ) {
      pendingResponses.current.clear();
      try {
        gateway.clearLastResponse();
      } catch (error) {
        logger.warn(NOTIFICATION_LOG_EVENT.SESSION_RESPONSE_CLEANUP_FAILED, {
          error: getErrorMessage(error),
        });
      }
    }
  }, [accountId, authStatus, gateway, logger]);

  const processPendingResponse = useCallback(
    async (response: PendingNotificationResponse) => {
      const { responseId } = response;
      if (
        handledResponseIds.current.has(responseId) ||
        processingResponseIds.current.has(responseId)
      ) {
        return;
      }
      if (Date.now() - response.receivedAt > PENDING_RESPONSE_LIFETIME) {
        pendingResponses.current.delete(responseId);
        return;
      }
      const disposition = NotificationPolicy.getResponseAction({
        authStatus,
        actionIdentifier: response.actionIdentifier,
        isNavigationReady,
      });
      if (
        disposition.status === 'defer' ||
        (response.actionIdentifier !== 'MARKETING_OPT_OUT' && accountId == null)
      ) {
        return;
      }
      if (response.accountId != null && response.accountId !== accountId) {
        pendingResponses.current.delete(responseId);
        return;
      }

      processingResponseIds.current.add(responseId);
      try {
        await handleNotificationResponse({
          data: response.data,
          actionIdentifier: response.actionIdentifier,
          isCurrentSession: () =>
            isMounted.current &&
            session.current.authStatus === 'authenticated' &&
            session.current.accountId === accountId,
        });
        pendingResponses.current.delete(responseId);
        handledResponseIds.current.add(responseId);
        if (handledResponseIds.current.size > MAX_HANDLED_RESPONSES) {
          const oldest = handledResponseIds.current.values().next().value;
          if (oldest != null) {
            handledResponseIds.current.delete(oldest);
          }
        }
        gateway.clearLastResponse();
      } catch (error) {
        logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_DEFERRED, {
          error: getErrorMessage(error),
        });
      } finally {
        processingResponseIds.current.delete(responseId);
      }
    },
    [accountId, authStatus, gateway, handleNotificationResponse, isNavigationReady, logger],
  );

  const processResponse = useCallback(
    (response: PushNotificationResponse) => {
      const responseId = response.id;
      if (handledResponseIds.current.has(responseId)) {
        return;
      }
      const parsed = toPushNotificationPayload(response.data);
      if (!parsed.success) {
        logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_PAYLOAD_INVALID, {
          error: getErrorMessage(parsed.error),
        });
        return;
      }
      const pending = pendingResponses.current.get(responseId) ?? {
        responseId,
        actionIdentifier: response.actionIdentifier,
        data: parsed.payload,
        accountId,
        receivedAt: Date.now(),
      };
      pendingResponses.current.set(responseId, pending);
      if (pendingResponses.current.size > MAX_PENDING_RESPONSES) {
        const oldest = pendingResponses.current.keys().next().value;
        if (oldest != null) {
          pendingResponses.current.delete(oldest);
        }
      }
      processPendingResponse(pending);
    },
    [accountId, logger, processPendingResponse],
  );

  useEffect(() => {
    const retryPending = () => {
      for (const response of pendingResponses.current.values()) {
        processPendingResponse(response);
      }
    };
    retryPending();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        retryPending();
      }
    });
    return () => subscription.remove();
  }, [processPendingResponse]);

  return processResponse;
}
