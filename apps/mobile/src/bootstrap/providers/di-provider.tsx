import { AchievementService } from '@src/features/achievement/services/achievement.service';
import { AiService } from '@src/features/ai/services/ai.service';
import { AuthService } from '@src/features/auth/services/auth.service';
import { FriendService } from '@src/features/friend/services/friend.service';
import { InquiryService } from '@src/features/inquiry/services/inquiry.service';
import { MemoService } from '@src/features/memo/services/memo.service';
import { DeviceIdRepositoryImpl } from '@src/features/notification/repositories/device-id.repository.impl';
import { DeviceIdService } from '@src/features/notification/services/device-id.service';
import { NotificationService } from '@src/features/notification/services/notification.service';
import { PushTokenService } from '@src/features/notification/services/push-token.service';
import { RevenueCatSdkManager } from '@src/features/subscription/services/revenuecat-sdk-manager';
import { SubscriptionService } from '@src/features/subscription/services/subscription.service';
import { SubTodoService } from '@src/features/todo/services/sub-todo.service';
import { TodoService } from '@src/features/todo/services/todo.service';
import { TodoCategoryService } from '@src/features/todo/services/todo-category.service';
import { TodoNudgeService } from '@src/features/todo/services/todo-nudge.service';
import { UserService } from '@src/features/user/services/user.service';
import { WeatherService } from '@src/features/weather/services/weather.service';

import { ENV } from '@src/shared/config/env';
import { createConsoleAnalytics, createFirebaseAnalytics } from '@src/shared/infra/analytics';
import {
  createConsoleErrorReporter,
  createSentryErrorReporter,
  setGlobalErrorReporter,
} from '@src/shared/infra/error-reporter';
import { createAuthClient } from '@src/shared/infra/http/auth-client';
import { KyHttpClient } from '@src/shared/infra/http/ky-client';
import { createPublicClient } from '@src/shared/infra/http/public-client';
import { createTokenRefresher } from '@src/shared/infra/http/token-refresher';
import {
  createCompositeLogger,
  createConsoleLogger,
  createSentryLogger,
  setGlobalLogger,
} from '@src/shared/infra/logger';
import { SecureStorage } from '@src/shared/infra/storage/secure-storage';

import { type PropsWithChildren, useState } from 'react';
import { type DIContainer, DIContext } from './di-context';

export const DIProvider = ({ children }: PropsWithChildren) => {
  const [di] = useState<DIContainer>(() => {
    const storage = new SecureStorage();

    // Observability — 크래시/에러/이벤트/로그는 Sentry로 일원화(네이티브 크래시 포함),
    // Firebase는 Analytics(제품 지표)만 담당. Sentry init은 앱 루트(initSentry)에서 1회.
    const consoleLogger = createConsoleLogger({ minLevel: ENV.IS_PRODUCTION ? 'warn' : 'debug' });

    const logger = ENV.IS_PRODUCTION
      ? createCompositeLogger([consoleLogger, createSentryLogger()])
      : consoleLogger;

    setGlobalLogger(logger);

    const analytics = ENV.IS_PRODUCTION
      ? createFirebaseAnalytics(logger)
      : createConsoleAnalytics();

    // 앱 레벨 에러/이벤트는 Sentry로 리포팅(검색가능 이벤트 + severity + breadcrumb).
    const errorReporter = ENV.IS_PRODUCTION
      ? createSentryErrorReporter()
      : createConsoleErrorReporter();

    // DI 밖(HTTP 훅·화면 추적 등 인프라)에서 breadcrumb를 남길 수 있도록 전역 접근자에 주입.
    setGlobalErrorReporter(errorReporter);

    const publicKyInstance = createPublicClient();
    const publicHttpClient = new KyHttpClient(publicKyInstance);

    // 단일 리프레셔: 401 훅(auth-client)과 부팅 세션 검증(auth-provider)이 공유해
    // single-flight mutex가 갈라지지 않도록 한다.
    const tokenRefresher = createTokenRefresher(storage);

    const authKyInstance = createAuthClient(storage, tokenRefresher);
    const authHttpClient = new KyHttpClient(authKyInstance);

    // Achievement
    const achievementService = new AchievementService(authHttpClient);

    // AI
    const aiService = new AiService(authHttpClient, logger);

    // Auth
    const authService = new AuthService(publicHttpClient, authHttpClient, storage);

    // Friend
    const friendService = new FriendService(authHttpClient);

    // Inquiry
    const inquiryService = new InquiryService(authHttpClient);

    // Memo
    const memoService = new MemoService(authHttpClient);

    // Todo
    const subTodoService = new SubTodoService(authHttpClient);
    const todoService = new TodoService(authHttpClient);

    // Todo Category
    const todoCategoryService = new TodoCategoryService(authHttpClient);

    // Notification
    const deviceIdRepository = new DeviceIdRepositoryImpl();
    const deviceIdService = new DeviceIdService(deviceIdRepository);
    const pushTokenService = new PushTokenService();
    const notificationService = new NotificationService(
      authHttpClient,
      deviceIdService,
      pushTokenService,
      logger,
    );

    // Todo Nudge
    const todoNudgeService = new TodoNudgeService(authHttpClient);

    // User
    const userService = new UserService(authHttpClient);

    // Subscription
    const revenueCatSdkManager = new RevenueCatSdkManager(logger);
    const subscriptionService = new SubscriptionService(revenueCatSdkManager, logger);

    // Weather
    const weatherService = new WeatherService(authHttpClient);

    return {
      storage,
      logger,
      analytics,
      errorReporter,
      tokenRefresher,
      achievementService,
      aiService,
      authService,
      friendService,
      inquiryService,
      memoService,
      subTodoService,
      todoService,
      todoCategoryService,
      notificationService,
      todoNudgeService,
      userService,
      revenueCatSdkManager,
      subscriptionService,
      weatherService,
    };
  });

  return <DIContext.Provider value={di}>{children}</DIContext.Provider>;
};

// DI 컨텍스트/훅은 di-context로 분리 — 기존 import 경로 호환을 위해 re-export
export {
  type DIContainer,
  StaticDIProvider,
  useAchievementService,
  useAiService,
  useAnalytics,
  useAuthService,
  useDI,
  useErrorReporter,
  useFriendService,
  useInquiryService,
  useLogger,
  useMemoService,
  useNotificationService,
  useRevenueCatSdkManager,
  useStorage,
  useSubscriptionService,
  useSubTodoService,
  useTodoCategoryService,
  useTodoNudgeService,
  useTodoService,
  useTokenRefresher,
  useUserService,
  useWeatherService,
} from './di-context';
