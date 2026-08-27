import { useAutomaticPushRegistration } from '@src/features/activation/presentations/hooks/use-automatic-push-registration';
import { useNotificationHandler } from '@src/features/notification/presentations/hooks/use-notification-handler';
import { toError } from '@src/shared/errors';
import { i18n } from '@src/shared/i18n';
import * as Notifications from 'expo-notifications';
import {
  createContext,
  type PropsWithChildren,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { Platform } from 'react-native';

import { useAuth } from './auth-provider';
import { useLogger, useNotificationService } from './di-context';

interface NotificationContextValue {
  handleNotificationResponse: (response: Notifications.NotificationResponse) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

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
  const processResponse = useNotificationResponseProcessor(handleNotificationResponse);
  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  useColdStartNotificationResponse({
    response: lastNotificationResponse,
    isAuthResolved: status !== 'loading',
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

  const value = useMemo(() => ({ handleNotificationResponse }), [handleNotificationResponse]);

  return <NotificationContext value={value}>{children}</NotificationContext>;
}

function useNotificationResponseProcessor(
  handleNotificationResponse: NotificationContextValue['handleNotificationResponse'],
) {
  const logger = useLogger();
  const handledResponseIdRef = useRef<string | null>(null);

  return useCallback(
    (response: Notifications.NotificationResponse) => {
      const responseId = response.notification.request.identifier;
      if (handledResponseIdRef.current === responseId) {
        return;
      }

      handledResponseIdRef.current = responseId;
      void Notifications.clearLastNotificationResponseAsync();
      handleNotificationResponse(response).catch((error) =>
        logger.error('[Notification] Response handling failed', toError(error)),
      );
    },
    [handleNotificationResponse, logger],
  );
}

function useColdStartNotificationResponse({
  response,
  isAuthResolved,
  processResponse,
}: {
  response: Notifications.NotificationResponse | null | undefined;
  isAuthResolved: boolean;
  processResponse: (response: Notifications.NotificationResponse) => void;
}) {
  const pendingResponseRef = useRef<Notifications.NotificationResponse | null>(null);

  useEffect(() => {
    const responseToProcess = pendingResponseRef.current ?? response;
    if (!responseToProcess) {
      return;
    }
    if (!isAuthResolved) {
      pendingResponseRef.current = responseToProcess;
      return;
    }

    pendingResponseRef.current = null;
    processResponse(responseToProcess);
  }, [isAuthResolved, processResponse, response]);
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
  useEffect(() => {
    void Notifications.setNotificationCategoryAsync('MARKETING', [
      {
        identifier: 'MARKETING_OPT_OUT',
        buttonTitle: i18n.t('notification:actions.marketingOptOut'),
        options: { opensAppToForeground: true },
      },
    ]);
  }, []);
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
  const { status } = useAuth();
  const { handleNotificationResponse } = useNotificationHandler({
    isAuthenticated: status === 'authenticated',
  });
  const value = useMemo(() => ({ handleNotificationResponse }), [handleNotificationResponse]);

  return <NotificationContext value={value}>{children}</NotificationContext>;
}

export const NotificationProvider =
  Platform.OS === 'web' ? WebNotificationProvider : NativeNotificationProvider;

export function useNotificationContext(): NotificationContextValue {
  const context = use(NotificationContext);

  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }

  return context;
}
