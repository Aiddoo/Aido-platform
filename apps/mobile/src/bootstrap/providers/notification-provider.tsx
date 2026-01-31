import { useNotificationHandler } from '@src/features/notification/presentations/hooks/use-notification-handler';
import * as Notifications from 'expo-notifications';
import { createContext, type PropsWithChildren, use, useEffect, useRef } from 'react';

import { useAuth } from './auth-provider';
import { useNotificationService } from './di-provider';

interface NotificationContextValue {
  handleNotificationResponse: (response: Notifications.NotificationResponse) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

// 포그라운드 알림 동작 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const NotificationProvider = ({ children }: PropsWithChildren) => {
  const { status } = useAuth();
  const notificationService = useNotificationService();
  const isAuthenticated = status === 'authenticated';

  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const receivedListener = useRef<Notifications.EventSubscription | null>(null);
  const lastResponseHandled = useRef<string | null>(null);

  const { handleNotificationResponse, handleForegroundNotification } = useNotificationHandler({
    isAuthenticated,
  });

  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  // Cold start 알림 처리
  useEffect(() => {
    if (lastNotificationResponse) {
      const responseId = lastNotificationResponse.notification.request.identifier;

      if (lastResponseHandled.current !== responseId) {
        lastResponseHandled.current = responseId;
        handleNotificationResponse(lastNotificationResponse).catch(console.error);
      }
    }
  }, [lastNotificationResponse, handleNotificationResponse]);

  // 리스너 설정 및 인증 기반 초기화
  useEffect(() => {
    // 포그라운드 알림 수신 리스너
    receivedListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[Notification] Received in foreground:', notification.request.content.title);
      handleForegroundNotification();
    });

    // 알림 탭 응답 리스너
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response).catch(console.error);
    });

    // 인증 상태 변경에 따른 초기화
    if (isAuthenticated) {
      // 로그인: 푸시 토큰 등록 + 배지 동기화
      notificationService.setupPushNotifications().catch((error) => {
        console.log('[Notification] Push token registration skipped:', error);
      });
      notificationService.syncBadgeCount().catch(console.error);
    } else {
      // 로그아웃: 푸시 토큰 해제 + 배지 초기화
      notificationService.unregisterPushToken().catch((error) => {
        console.log('[Notification] Push token unregister skipped:', error);
      });
      notificationService.clearBadge().catch(console.error);
    }

    return () => {
      receivedListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [
    isAuthenticated,
    notificationService,
    handleNotificationResponse,
    handleForegroundNotification,
  ]);

  const value: NotificationContextValue = {
    handleNotificationResponse,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotificationContext = (): NotificationContextValue => {
  const context = use(NotificationContext);

  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }

  return context;
};
