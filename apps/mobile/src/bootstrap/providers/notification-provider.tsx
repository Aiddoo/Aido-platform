import { useNotificationHandler } from '@src/features/notification/presentations/hooks/use-notification-handler';
import { i18n } from '@src/shared/i18n';
import * as Notifications from 'expo-notifications';
import { createContext, type PropsWithChildren, use, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';

import { useAuth } from './auth-provider';
import { useLogger, useNotificationService } from './di-context';

interface NotificationContextValue {
  handleNotificationResponse: (response: Notifications.NotificationResponse) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

// 포그라운드 알림 동작 설정 (웹 제외)
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

// Native 전용 Provider 구현
const NativeNotificationProvider = ({ children }: PropsWithChildren) => {
  const { status } = useAuth();
  const notificationService = useNotificationService();
  const logger = useLogger();
  const isAuthenticated = status === 'authenticated';

  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const receivedListener = useRef<Notifications.EventSubscription | null>(null);
  const lastResponseHandled = useRef<string | null>(null);
  const pendingColdStartResponse = useRef<Notifications.NotificationResponse | null>(null);

  const isAuthResolved = status !== 'loading';

  const { handleNotificationResponse, handleForegroundNotification } = useNotificationHandler({
    isAuthenticated,
  });

  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  // Cold start 및 일반 알림 통합 처리
  useEffect(() => {
    const responseToProcess = pendingColdStartResponse.current ?? lastNotificationResponse;
    if (!responseToProcess) {
      return;
    }

    const responseId = responseToProcess.notification.request.identifier;

    if (isAuthResolved) {
      if (lastResponseHandled.current !== responseId) {
        lastResponseHandled.current = responseId;
        pendingColdStartResponse.current = null;
        handleNotificationResponse(responseToProcess).catch((e) =>
          logger.error(
            '[Notification] Response handling failed',
            e instanceof Error ? e : undefined,
          ),
        );
      }
    } else if (
      lastNotificationResponse &&
      lastResponseHandled.current !== lastNotificationResponse.notification.request.identifier
    ) {
      // 인증 미완료: 최신 응답을 큐잉
      pendingColdStartResponse.current = lastNotificationResponse;
    }
  }, [lastNotificationResponse, isAuthResolved, handleNotificationResponse, logger]);

  // Effect 1: 알림 리스너 등록
  useEffect(() => {
    receivedListener.current = Notifications.addNotificationReceivedListener((notification) => {
      logger.info('[Notification] Received in foreground', {
        title: notification.request.content.title,
      });
      handleForegroundNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response).catch((e) =>
        logger.error('[Notification] Response handling failed', e instanceof Error ? e : undefined),
      );
    });

    return () => {
      receivedListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [handleForegroundNotification, handleNotificationResponse, logger]);

  // Effect 2: 푸시 토큰 관리
  useEffect(() => {
    if (isAuthenticated) {
      notificationService.setupPushNotifications().catch((error) => {
        logger.warn('[Notification] Push token registration skipped', { error });
      });
    } else {
      notificationService.unregisterPushToken().catch((error) => {
        logger.warn('[Notification] Push token unregister skipped', { error });
      });
    }
  }, [isAuthenticated, notificationService, logger]);

  // Effect 2-1: 언어 변경 시 토큰 재등록 — 재등록 요청의 Accept-Language 헤더를
  // 서버가 UserPreference.locale로 upsert해 푸시 알림 언어가 즉시 동기화된다
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const handleLanguageChanged = () => {
      notificationService.setupPushNotifications().catch((error) => {
        logger.warn('[Notification] Push token re-registration skipped', { error });
      });
    };

    i18n.on('languageChanged', handleLanguageChanged);
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [isAuthenticated, notificationService, logger]);

  // Effect 3: 배지 동기화
  useEffect(() => {
    if (isAuthenticated) {
      notificationService
        .syncBadgeCount()
        .catch((e) =>
          logger.error('[Notification] Badge sync failed', e instanceof Error ? e : undefined),
        );
    } else {
      notificationService
        .clearBadge()
        .catch((e) =>
          logger.error('[Notification] Badge clear failed', e instanceof Error ? e : undefined),
        );
    }
  }, [isAuthenticated, notificationService, logger]);

  const value = useMemo(() => ({ handleNotificationResponse }), [handleNotificationResponse]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

// Web 전용 간단한 Provider
const WebNotificationProvider = ({ children }: PropsWithChildren) => {
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';

  const { handleNotificationResponse } = useNotificationHandler({
    isAuthenticated,
  });

  const value: NotificationContextValue = {
    handleNotificationResponse,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

// Platform에 따라 적절한 Provider 선택
export const NotificationProvider =
  Platform.OS === 'web' ? WebNotificationProvider : NativeNotificationProvider;

export const useNotificationContext = (): NotificationContextValue => {
  const context = use(NotificationContext);

  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }

  return context;
};
