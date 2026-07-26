import { createSessionManager } from '@src/core/session/session-manager';
import { AchievementService } from '@src/features/achievement/services/achievement.service';
import { AiService } from '@src/features/ai/services/ai.service';
import { AuthService } from '@src/features/auth/services/auth.service';
import { createFeatureDiscoveryStateRepository } from '@src/features/feature-discovery/repositories/feature-discovery-state.repository';
import { FeatureDiscoveryService } from '@src/features/feature-discovery/services/feature-discovery.service';
import { FeatureDiscoveryStateService } from '@src/features/feature-discovery/services/feature-discovery-state.service';
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
import { createWidgetBridge } from '@src/features/widget/bridge/create-widget-bridge';
import { WidgetSnapshotRepositoryImpl } from '@src/features/widget/repositories/widget-snapshot.repository';
import { widgetSyncStorage } from '@src/features/widget/repositories/widget-storage';
import { WidgetSyncService } from '@src/features/widget/services/widget-sync.service';
import { ENV } from '@src/shared/config/env';
import { setGlobalErrorReporter } from '@src/shared/infra/error-reporter';
import { createAuthClient } from '@src/shared/infra/http/auth-client';
import { KyHttpClient } from '@src/shared/infra/http/ky-client';
import { KyJsonFetcher } from '@src/shared/infra/http/ky-json-fetcher';
import { createPublicClient } from '@src/shared/infra/http/public-client';
import { requestRefreshTokens } from '@src/shared/infra/http/refresh-tokens-request';
import { createTokenRefresher } from '@src/shared/infra/http/token-refresher';
import {
  createCompositeLogger,
  createConsoleLogger,
  createSentryLogger,
  setGlobalLogger,
} from '@src/shared/infra/logger';
import {
  createEnvironmentAnalytics,
  createEnvironmentErrorReporter,
} from '@src/shared/infra/observability-env';
import { mmkvSyncStorage } from '@src/shared/infra/storage/mmkv-storage';
import { SecureStorage } from '@src/shared/infra/storage/secure-storage';
import { createSecureTokenStore } from '@src/shared/infra/storage/secure-token-store';

import { type PropsWithChildren, useState } from 'react';
import { type DIContainer, DIContext } from './di-context';

export const DIProvider = ({ children }: PropsWithChildren) => {
  const [di] = useState<DIContainer>(() => {
    const storage = new SecureStorage();
    const tokenStore = createSecureTokenStore(storage);

    // Observability — 크래시/에러/이벤트/로그는 Sentry로 일원화(네이티브 크래시 포함),
    // Firebase는 Analytics(제품 지표)만 담당. Sentry init은 앱 루트(initSentry)에서 1회.
    const consoleLogger = createConsoleLogger({ minLevel: ENV.IS_PRODUCTION ? 'warn' : 'debug' });

    const logger = ENV.IS_PRODUCTION
      ? createCompositeLogger([consoleLogger, createSentryLogger()])
      : consoleLogger;

    setGlobalLogger(logger);

    const analytics = createEnvironmentAnalytics(logger);

    // 앱 레벨 에러/이벤트는 Sentry로 리포팅(검색가능 이벤트 + severity + breadcrumb).
    const errorReporter = createEnvironmentErrorReporter();

    // DI 밖(HTTP 훅·화면 추적 등 인프라)에서 breadcrumb를 남길 수 있도록 전역 접근자에 주입.
    setGlobalErrorReporter(errorReporter);

    const publicKyInstance = createPublicClient();
    const publicHttpClient = new KyHttpClient(publicKyInstance);
    const publicJsonFetcher = new KyJsonFetcher(publicKyInstance);

    // 세션 종료(토큰 삭제 + 이벤트)의 유일한 소유자. 갱신기는 세션을 끝낼 수 없다.
    const sessionManager = createSessionManager(tokenStore);

    // 단일 리프레셔: 인스턴스가 갈라지면 single-flight mutex가 분리되어
    // 동시 회전이 서버의 토큰 패밀리를 소모한다.
    const tokenRefresher = createTokenRefresher({
      tokenStore,
      requestRefresh: requestRefreshTokens,
    });

    const authKyInstance = createAuthClient({
      tokenStore,
      refresh: tokenRefresher,
      endSession: (reason) => sessionManager.end(reason),
    });
    const authHttpClient = new KyHttpClient(authKyInstance);

    // Achievement
    const achievementService = new AchievementService(authHttpClient);

    // AI
    const aiService = new AiService(authHttpClient, logger);

    // Auth
    const authService = new AuthService(publicHttpClient, authHttpClient, tokenStore);

    // Friend
    const friendService = new FriendService(authHttpClient);

    // Feature discovery — app-config 응답은 기존 API envelope 없이 원문 JSON을 반환한다.
    const featureDiscoveryService = new FeatureDiscoveryService(publicJsonFetcher);
    const featureDiscoveryStateRepository = createFeatureDiscoveryStateRepository(mmkvSyncStorage);
    const featureDiscoveryStateService = new FeatureDiscoveryStateService(
      featureDiscoveryStateRepository,
    );

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
      publicHttpClient,
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

    // Widget (홈 위젯 스냅샷 동기화 — 위젯은 순수 렌더러, 토큰/네트워크 접근 없음)
    const widgetSnapshotRepository = new WidgetSnapshotRepositoryImpl(widgetSyncStorage);
    const widgetBridge = createWidgetBridge(widgetSnapshotRepository);
    const widgetSyncService = new WidgetSyncService(widgetBridge, errorReporter);

    return {
      storage,
      logger,
      analytics,
      errorReporter,
      tokenStore,
      sessionManager,
      tokenRefresher,
      achievementService,
      aiService,
      authService,
      friendService,
      featureDiscoveryService,
      featureDiscoveryStateService,
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
      widgetSyncService,
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
  useFeatureDiscoveryService,
  useFeatureDiscoveryStateService,
  useFriendService,
  useInquiryService,
  useLogger,
  useMemoService,
  useNotificationService,
  useRevenueCatSdkManager,
  useSessionManager,
  useStorage,
  useSubscriptionService,
  useSubTodoService,
  useTodoCategoryService,
  useTodoNudgeService,
  useTodoService,
  useTokenRefresher,
  useTokenStore,
  useUserService,
  useWeatherService,
  useWidgetSyncService,
} from './di-context';
