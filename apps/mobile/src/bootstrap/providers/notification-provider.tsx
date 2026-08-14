import { useAutomaticPushRegistration } from '@src/features/activation/presentations/hooks/use-automatic-push-registration';
import { useNotificationHandler } from '@src/features/notification/presentations/hooks/use-notification-handler';
import { toError } from '@src/shared/errors';
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
  const canRegisterPushAutomatically = useAutomaticPushRegistration();

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
        void Notifications.clearLastNotificationResponseAsync();
        handleNotificationResponse(responseToProcess).catch((e) =>
          logger.error('[Notification] Response handling failed', toError(e)),
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
    void Notifications.setNotificationCategoryAsync('MARKETING', [
      {
        identifier: 'MARKETING_OPT_OUT',
        buttonTitle: i18n.t('notification:actions.marketingOptOut'),
        // 종료 상태에서도 응답 listener가 확실히 실행되도록 앱을 열어 처리한다.
        options: { opensAppToForeground: true },
      },
    ]);

    receivedListener.current = Notifications.addNotificationReceivedListener((notification) => {
      logger.info('[Notification] Received in foreground', {
        title: notification.request.content.title,
      });
      handleForegroundNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const responseId = response.notification.request.identifier;
      if (lastResponseHandled.current === responseId) return;
      lastResponseHandled.current = responseId;
      void Notifications.clearLastNotificationResponseAsync();
      handleNotificationResponse(response).catch((e) =>
        logger.error('[Notification] Response handling failed', toError(e)),
      );
    });

    return () => {
      receivedListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [handleForegroundNotification, handleNotificationResponse, logger]);

  // 언어 변경 시 토큰 재등록 — 재등록 요청의 Accept-Language 헤더를
  // 서버가 UserPreference.locale로 upsert해 푸시 알림 언어가 즉시 동기화된다
  useEffect(() => {
    if (!isAuthenticated || !canRegisterPushAutomatically) {
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
  }, [canRegisterPushAutomatically, isAuthenticated, notificationService, logger]);

  // Effect 3: 배지 동기화
  useEffect(() => {
    if (isAuthenticated) {
      notificationService
        .syncBadgeCount()
        .catch((e) => logger.error('[Notification] Badge sync failed', toError(e)));
    } else {
      notificationService
        .clearBadge()
        .catch((e) => logger.error('[Notification] Badge clear failed', toError(e)));
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
