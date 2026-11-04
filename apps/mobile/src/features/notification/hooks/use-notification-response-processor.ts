import { pushNotificationDataSchema, type PushNotificationData } from '@aido/api';
import { useLogger } from '@src/bootstrap/providers/di-context';
import { toError } from '@src/shared/errors';
import * as Notifications from 'expo-notifications';
import { useNavigationContainerRef } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import {
  getNotificationResponseDisposition,
  type NotificationAuthStatus,
} from '../utils/navigation/notification-response-disposition';
import type { useNotificationResponseHandler } from './use-notification-response-handler';

type PendingNotificationResponse = {
  responseId: string;
  actionIdentifier: string;
  data: PushNotificationData;
  accountId: string | null;
  receivedAt: number;
};

const MAX_PENDING_RESPONSES = 20;
const MAX_HANDLED_RESPONSES = 100;
const PENDING_RESPONSE_LIFETIME = 10 * 60_000;

export function useNotificationResponseProcessor({
  authStatus,
  accountId,
  handleNotificationResponse,
}: {
  authStatus: NotificationAuthStatus;
  accountId: string | null;
  handleNotificationResponse: ReturnType<typeof useNotificationResponseHandler>;
}) {
  const logger = useLogger();
  const navigationRef = useNavigationContainerRef();
  const [isNavigationReady, setIsNavigationReady] = useState(() => navigationRef.isReady());
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
    const updateReadiness = () => setIsNavigationReady(navigationRef.isReady());
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
        Notifications.clearLastNotificationResponse();
      } catch (error) {
        logger.warn(NOTIFICATION_LOG_EVENT.SESSION_RESPONSE_CLEANUP_FAILED, { error });
      }
    }
  }, [accountId, authStatus, logger]);

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
      const disposition = getNotificationResponseDisposition({
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
        Notifications.clearLastNotificationResponse();
      } catch (error) {
        logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_DEFERRED, {
          error: toError(error),
        });
      } finally {
        processingResponseIds.current.delete(responseId);
      }
    },
    [accountId, authStatus, handleNotificationResponse, isNavigationReady, logger],
  );

  const processResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const responseId = response.notification.request.identifier;
      if (handledResponseIds.current.has(responseId)) {
        return;
      }
      const parsed = pushNotificationDataSchema.safeParse(
        response.notification.request.content.data,
      );
      if (!parsed.success) {
        logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_PAYLOAD_INVALID, { error: parsed.error });
        return;
      }
      const pending = pendingResponses.current.get(responseId) ?? {
        responseId,
        actionIdentifier: response.actionIdentifier,
        data: parsed.data,
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
