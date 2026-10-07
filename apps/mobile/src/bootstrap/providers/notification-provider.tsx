import { pushNotificationDataSchema, type PushNotificationData } from '@aido/api';
import { useAutomaticPushRegistration } from '@src/features/activation/presentations/hooks/use-automatic-push-registration';
import { useNotificationHandler } from '@src/features/notification/presentations/hooks/use-notification-handler';
import { getNotificationResponseDisposition } from '@src/features/notification/presentations/navigation/notification-response-disposition';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/get-me-query-options';
import { toError } from '@src/shared/errors';
import { i18n } from '@src/shared/i18n';
import { useQuery } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useNavigationContainerRef } from 'expo-router';
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
} from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from './auth-provider';
import { useLogger, useNotificationService } from './di-context';

type NotificationResponseHandler = ReturnType<
  typeof useNotificationHandler
>['handleNotificationResponse'];

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function NativeNotificationProvider({ children }: PropsWithChildren) {
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';
  const canRegisterPushAutomatically = useAutomaticPushRegistration();
  const { handleNotificationResponse, handleForegroundNotification } = useNotificationHandler({
    isAuthenticated,
  });
  const { data: me } = useQuery({ ...useGetMeQueryOptions(), enabled: isAuthenticated });
  const processResponse = useNotificationResponseProcessor({
    accountId: isAuthenticated ? (me?.id ?? null) : null,
    authStatus: status,
    handleNotificationResponse,
  });
  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  useColdStartNotificationResponse({
    response: lastNotificationResponse,
    processResponse,
  });
  useNativeNotificationListeners({
    processResponse,
    handleForegroundNotification,
  });
  useMarketingNotificationCategory();
  usePushLocaleSync({
    isAuthenticated,
    canRegisterPushAutomatically,
  });
  useNotificationBadgeSync(isAuthenticated);

  return children;
}

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

function useNotificationResponseProcessor({
  authStatus,
  accountId,
  handleNotificationResponse,
}: {
  authStatus: 'loading' | 'locked' | 'authenticated' | 'unauthenticated';
  accountId: string | null;
  handleNotificationResponse: NotificationResponseHandler;
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
      (previous.accountId !== null && accountId !== null && previous.accountId !== accountId)
    ) {
      pendingResponses.current.clear();
      try {
        Notifications.clearLastNotificationResponse();
      } catch (error) {
        logger.warn('[Notification] Session response cleanup failed', { error });
      }
    }
  }, [accountId, authStatus, logger]);

  const processPendingResponse = useCallback(
    async (response: PendingNotificationResponse) => {
      const { responseId } = response;
      if (
        handledResponseIds.current.has(responseId) ||
        processingResponseIds.current.has(responseId)
      )
        return;
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
        (response.actionIdentifier !== 'MARKETING_OPT_OUT' && accountId === null)
      )
        return;
      if (response.accountId !== null && response.accountId !== accountId) {
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
          if (oldest !== undefined) handledResponseIds.current.delete(oldest);
        }
        Notifications.clearLastNotificationResponse();
      } catch (error) {
        logger.warn('[Notification] Response deferred after a failed attempt', {
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
      if (handledResponseIds.current.has(responseId)) return;
      const parsed = pushNotificationDataSchema.safeParse(
        response.notification.request.content.data,
      );
      if (!parsed.success) {
        logger.warn('[Notification] Invalid response payload', { error: parsed.error });
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
        if (oldest !== undefined) pendingResponses.current.delete(oldest);
      }
      void processPendingResponse(pending);
    },
    [accountId, logger, processPendingResponse],
  );

  useEffect(() => {
    const retryPending = () => {
      for (const response of pendingResponses.current.values())
        void processPendingResponse(response);
    };
    retryPending();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') retryPending();
    });
    return () => subscription.remove();
  }, [processPendingResponse]);

  return processResponse;
}

function useColdStartNotificationResponse({
  response,
  processResponse,
}: {
  response: Notifications.NotificationResponse | null | undefined;
  processResponse: (response: Notifications.NotificationResponse) => void;
}) {
  useEffect(() => {
    if (!response) {
      return;
    }

    processResponse(response);
  }, [processResponse, response]);
}

function useNativeNotificationListeners({
  processResponse,
  handleForegroundNotification,
}: {
  processResponse: (response: Notifications.NotificationResponse) => void;
  handleForegroundNotification: (notification?: Notifications.Notification) => void;
}) {
  const logger = useLogger();

  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      logger.info('[Notification] Received in foreground', {
        title: notification.request.content.title,
      });
      handleForegroundNotification(notification);
    });
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener(processResponse);

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [handleForegroundNotification, logger, processResponse]);
}

function useMarketingNotificationCategory() {
  const logger = useLogger();

  useEffect(() => {
    Notifications.setNotificationCategoryAsync('MARKETING', [
      {
        identifier: 'MARKETING_OPT_OUT',
        buttonTitle: i18n.t('notification:actions.marketingOptOut'),
        options: { opensAppToForeground: true },
      },
    ]).catch((error) =>
      logger.warn('[Notification] Marketing category registration failed', { error }),
    );
  }, [logger]);
}

function usePushLocaleSync({
  isAuthenticated,
  canRegisterPushAutomatically,
}: {
  isAuthenticated: boolean;
  canRegisterPushAutomatically: boolean;
}) {
  const notificationService = useNotificationService();
  const logger = useLogger();

  useEffect(() => {
    if (!isAuthenticated || !canRegisterPushAutomatically) {
      return;
    }

    const handleLanguageChanged = () => {
      notificationService
        .setupPushNotifications()
        .catch((error) =>
          logger.warn('[Notification] Push token re-registration skipped', { error }),
        );
    };

    i18n.on('languageChanged', handleLanguageChanged);
    return () => i18n.off('languageChanged', handleLanguageChanged);
  }, [canRegisterPushAutomatically, isAuthenticated, logger, notificationService]);
}

function useNotificationBadgeSync(isAuthenticated: boolean) {
  const notificationService = useNotificationService();
  const logger = useLogger();

  useEffect(() => {
    const task = isAuthenticated
      ? notificationService.syncBadgeCount()
      : notificationService.clearBadge();
    task.catch((error) =>
      logger.error(
        isAuthenticated ? '[Notification] Badge sync failed' : '[Notification] Badge clear failed',
        toError(error),
      ),
    );
  }, [isAuthenticated, logger, notificationService]);
}

function WebNotificationProvider({ children }: PropsWithChildren) {
  return children;
}

export const NotificationProvider =
  Platform.OS === 'web' ? WebNotificationProvider : NativeNotificationProvider;
