import { createSessionManager } from '@src/core/session/session-manager';
import { AchievementService } from '@src/features/achievement/apis/achievement.service';
import { createActivationProgressRepository } from '@src/features/activation/apis/activation-progress.repository';
import { ActivationService } from '@src/features/activation/apis/activation.service';
import { AiService } from '@src/features/ai/apis/ai.service';
import { AppIconService } from '@src/features/app-icon/apis/app-icon.service';
import { AppVersionService } from '@src/features/app-version/apis/app-version.service';
import { AuthService } from '@src/features/auth/apis/auth.service';
import { createFeatureDiscoveryStateRepository } from '@src/features/feature-discovery/apis/feature-discovery-state.repository';
import { FeatureDiscoveryStateService } from '@src/features/feature-discovery/apis/feature-discovery-state.service';
import { FeatureDiscoveryService } from '@src/features/feature-discovery/apis/feature-discovery.service';
import { FriendService } from '@src/features/friend/apis/friend.service';
import { InquiryService } from '@src/features/inquiry/apis/inquiry.service';
import { createInstallReferrerRepository } from '@src/features/invite/apis/install-referrer.repository';
import { InviteShareService } from '@src/features/invite/apis/invite-share.service';
import { InviteService } from '@src/features/invite/apis/invite.service';
import { createPawPrintCelebrationRepository } from '@src/features/invite/apis/paw-print-celebration.repository';
import { createPendingRedemptionRepository } from '@src/features/invite/apis/pending-redemption.repository';
import { MemoService } from '@src/features/memo/apis/memo.service';
import { DeviceIdRepository } from '@src/features/notification/apis/device-id.repository';
import { DeviceIdService } from '@src/features/notification/apis/device-id.service';
import { NotificationService } from '@src/features/notification/apis/notification.service';
import { PushTokenService } from '@src/features/notification/apis/push-token.service';
import { TodoNudgeService } from '@src/features/nudge/apis/todo-nudge.service';
import { PreferenceService } from '@src/features/preference/apis/preference.service';
import { RevenueCatSdkManager } from '@src/features/subscription/apis/revenuecat-sdk-manager';
import { SubscriptionService } from '@src/features/subscription/apis/subscription.service';
import { TodoCommentService } from '@src/features/todo-comment/apis/todo-comment.service';
import { createReorderCoachmarkRepository } from '@src/features/todo/apis/reorder-coachmark.repository';
import { ReorderCoachmarkService } from '@src/features/todo/apis/reorder-coachmark.service';
import { createStoreReviewPromptRepository } from '@src/features/todo/apis/store-review-prompt.repository';
import { StoreReviewPromptService } from '@src/features/todo/apis/store-review-prompt.service';
import { SubTodoService } from '@src/features/todo/apis/sub-todo.service';
import { TodoCategoryService } from '@src/features/todo/apis/todo-category.service';
import { TodoService } from '@src/features/todo/apis/todo.service';
import { UserService } from '@src/features/user/apis/user.service';
import { createWeatherLocationStateRepository } from '@src/features/weather/apis/weather-location-state.repository';
import { WeatherLocationStateService } from '@src/features/weather/apis/weather-location-state.service';
import { WeatherService } from '@src/features/weather/apis/weather.service';
import { createWidgetNavigationRepository } from '@src/features/widget/apis/widget-navigation.repository';
import { WidgetSyncService } from '@src/features/widget/apis/widget-sync.service';
import { createWidgetBridge } from '@src/features/widget/bridge/create-widget-bridge';
import { createFeatureAttributionStore } from '@src/shared/analytics/feature-attribution';
import { ENV } from '@src/shared/config/env';
import { createDraftRepository } from '@src/shared/draft/draft.repository';
import { DraftService } from '@src/shared/draft/draft.service';
import { toError } from '@src/shared/errors';
import { expoAppIconGateway } from '@src/shared/infra/app-icon/expo-app-icon.gateway';
import { expoAppStoreGateway } from '@src/shared/infra/app-store/expo-app-store.gateway';
import { expoApplicationMetadataGateway } from '@src/shared/infra/application/expo-application-metadata.gateway';
import { expoInstallReferrerGateway } from '@src/shared/infra/application/expo-install-referrer.gateway';
import { expoInstallationIdGateway } from '@src/shared/infra/application/expo-installation-id.gateway';
import { expoClipboardGateway } from '@src/shared/infra/clipboard/expo-clipboard.gateway';
import { setGlobalErrorReporter } from '@src/shared/infra/error-reporter';
import { createAuthClient } from '@src/shared/infra/http/auth-client';
import { KyHttpClient } from '@src/shared/infra/http/ky-client';
import { KyJsonFetcher } from '@src/shared/infra/http/ky-json-fetcher';
import { createPublicClient } from '@src/shared/infra/http/public-client';
import { requestRefreshTokens } from '@src/shared/infra/http/refresh-tokens-request';
import { createTokenRefresher } from '@src/shared/infra/http/token-refresher';
import { createKakaoShareClient } from '@src/shared/infra/kakao/kakao-share.client';
import { expoLocationGateway } from '@src/shared/infra/location/expo-location.gateway';
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
import { rnSystemShareGateway } from '@src/shared/infra/share/rn-system-share.gateway';
import type { DraftStorageBootstrap } from '@src/shared/infra/storage/mmkv-draft-storage';
import { mmkvSyncStorage } from '@src/shared/infra/storage/mmkv-storage';
import { SecureStorage } from '@src/shared/infra/storage/secure-storage';
import { createSecureTokenStore } from '@src/shared/infra/storage/secure-token-store';
import { widgetNavigationStorage } from '@src/shared/infra/storage/widget-navigation-storage';
import { type PropsWithChildren, useState } from 'react';

import { type DIContainer, DIContext } from './di-context';

interface DIProviderProps extends PropsWithChildren {
  /** 암호화 키 조회가 끝난 초안 저장소. 비동기 준비는 앱 부트스트랩에서 마친다. */
  draftStorageBootstrap: DraftStorageBootstrap;
}

export function DIProvider({ children, draftStorageBootstrap }: DIProviderProps) {
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
    const featureAttribution = createFeatureAttributionStore(mmkvSyncStorage);
    const draftService = new DraftService(createDraftRepository(draftStorageBootstrap.storage));
    draftService.removeExpired();

    // 앱 레벨 에러/이벤트는 Sentry로 리포팅(검색가능 이벤트 + severity + breadcrumb).
    const errorReporter = createEnvironmentErrorReporter();

    // DI 밖(HTTP 훅·화면 추적 등 인프라)에서 breadcrumb를 남길 수 있도록 전역 접근자에 주입.
    setGlobalErrorReporter(errorReporter);

    if (draftStorageBootstrap.failure !== undefined) {
      errorReporter.captureException(toError(draftStorageBootstrap.failure), { feature: 'draft' });
    }

    const appVersion =
      expoApplicationMetadataGateway.getInstallation()?.currentVersion ?? ENV.APP_VERSION;
    const publicKyInstance = createPublicClient({ appVersion });
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
      appVersion,
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
    const preferenceService = new PreferenceService(authHttpClient);
    const activationService = new ActivationService(
      createActivationProgressRepository(mmkvSyncStorage),
    );

    // Friend
    const friendService = new FriendService(authHttpClient);

    // Feature discovery — app-config 응답은 기존 API envelope 없이 원문 JSON을 반환한다.
    const featureDiscoveryService = new FeatureDiscoveryService(publicJsonFetcher);
    const appVersionService = new AppVersionService(
      publicJsonFetcher,
      expoApplicationMetadataGateway,
      expoAppStoreGateway,
    );
    const featureDiscoveryStateRepository = createFeatureDiscoveryStateRepository(mmkvSyncStorage);
    const featureDiscoveryStateService = new FeatureDiscoveryStateService(
      featureDiscoveryStateRepository,
    );

    // Invite
    const inviteService = new InviteService({
      publicHttpClient,
      authHttpClient,
      pendingRedemptionRepository: createPendingRedemptionRepository(mmkvSyncStorage),
      installReferrerRepository: createInstallReferrerRepository(
        mmkvSyncStorage,
        expoInstallReferrerGateway,
      ),
      pawPrintCelebrationRepository: createPawPrintCelebrationRepository(mmkvSyncStorage),
      installationIdGateway: expoInstallationIdGateway,
    });
    const inviteShareService = new InviteShareService({
      kakaoShare: createKakaoShareClient(ENV.KAKAO_NATIVE_APP_KEY),
      systemShare: rnSystemShareGateway,
      clipboard: expoClipboardGateway,
      errorReporter,
    });

    // Inquiry
    const inquiryService = new InquiryService(authHttpClient);

    // Memo
    const memoService = new MemoService(authHttpClient);

    // Todo
    const subTodoService = new SubTodoService(authHttpClient);
    const todoService = new TodoService(authHttpClient);
    const todoCommentService = new TodoCommentService(authHttpClient);

    // Todo Category
    const todoCategoryService = new TodoCategoryService(authHttpClient);

    // Notification
    const deviceIdRepository = new DeviceIdRepository();
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
    const reorderCoachmarkService = new ReorderCoachmarkService(
      createReorderCoachmarkRepository(mmkvSyncStorage),
    );
    const storeReviewPromptService = new StoreReviewPromptService(
      createStoreReviewPromptRepository(mmkvSyncStorage),
      expoAppStoreGateway,
    );

    // User
    const userService = new UserService(authHttpClient);

    // Subscription
    const revenueCatSdkManager = new RevenueCatSdkManager(logger);
    const subscriptionService = new SubscriptionService(revenueCatSdkManager, logger);

    // Weather
    const weatherService = new WeatherService(authHttpClient);

    // Widget (홈 위젯 스냅샷 동기화 — 위젯은 순수 렌더러, 토큰/네트워크 접근 없음)
    const widgetBridge = createWidgetBridge();
    const widgetSyncService = new WidgetSyncService(widgetBridge, errorReporter);
    const widgetNavigationRepository = createWidgetNavigationRepository(widgetNavigationStorage);

    return {
      storage,
      logger,
      analytics,
      errorReporter,
      tokenStore,
      sessionManager,
      tokenRefresher,
      featureAttribution,
      draftService,
      achievementService,
      aiService,
      authService,
      preferenceService,
      activationService,
      appVersionService,
      appIconService: new AppIconService(expoAppIconGateway),
      friendService,
      featureDiscoveryService,
      featureDiscoveryStateService,
      inviteService,
      inviteShareService,
      inquiryService,
      memoService,
      subTodoService,
      todoService,
      todoCommentService,
      todoCategoryService,
      notificationService,
      todoNudgeService,
      reorderCoachmarkService,
      storeReviewPromptService,
      userService,
      revenueCatSdkManager,
      subscriptionService,
      weatherService,
      weatherLocationStateService: new WeatherLocationStateService(
        createWeatherLocationStateRepository(mmkvSyncStorage),
      ),
      locationGateway: expoLocationGateway,
      clipboard: expoClipboardGateway,
      widgetSyncService,
      widgetNavigationRepository,
    };
  });

  return <DIContext.Provider value={di}>{children}</DIContext.Provider>;
}
