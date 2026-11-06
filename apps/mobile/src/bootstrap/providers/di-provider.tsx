import { createSessionEpoch, withSessionEpoch } from '@src/core/session/session-epoch';
import { createSessionManager } from '@src/core/session/session-manager';
import { AppVersionService } from '@src/features/app-config/app-version/apis/app-version.service';
import { FeatureCampaignService } from '@src/features/app-config/feature-campaign/apis/feature-campaign.service';
import { createWhatsNewStateRepository } from '@src/features/app-config/whats-new/apis/whats-new-state.repository';
import { WhatsNewStateService } from '@src/features/app-config/whats-new/apis/whats-new-state.service';
import { SuggestionService } from '@src/features/assistant/suggestion/apis/suggestion.service';
import { EntitlementService } from '@src/features/billing/subscription/apis/entitlement.service';
import { PurchasesSdkManager } from '@src/features/billing/subscription/apis/purchases-sdk-manager';
import { SubscriptionService } from '@src/features/billing/subscription/apis/subscription.service';
import { createActivationProgressRepository } from '@src/features/device/activation/apis/activation-progress.repository';
import { ActivationService } from '@src/features/device/activation/apis/activation.service';
import { AppIconService } from '@src/features/device/app-icon/apis/app-icon.service';
import { createCoachmarkRepository } from '@src/features/device/coachmark/apis/coachmark.repository';
import { CoachmarkService } from '@src/features/device/coachmark/apis/coachmark.service';
import { createStoreReviewRepository } from '@src/features/device/store-review/apis/store-review.repository';
import { StoreReviewService } from '@src/features/device/store-review/apis/store-review.service';
import { createWidgetNavigationRepository } from '@src/features/device/widget/apis/widget-navigation.repository';
import { WidgetSyncService } from '@src/features/device/widget/apis/widget-sync.service';
import { createWidgetBridge } from '@src/features/device/widget/bridge/create-widget-bridge';
import { TodoCommentService } from '@src/features/engagement/comment/apis/todo-comment.service';
import { AuthService } from '@src/features/identity/auth/apis/auth.service';
import { createPendingRevocationRepository } from '@src/features/identity/auth/apis/pending-revocation.repository';
import { SessionCleanupService } from '@src/features/identity/auth/apis/session-cleanup.service';
import { createSessionQueryCache } from '@src/features/identity/auth/apis/session-query-cache';
import { SessionRevocationService } from '@src/features/identity/auth/apis/session-revocation.service';
import { ConsentService } from '@src/features/identity/consent/apis/consent.service';
import { PreferenceService } from '@src/features/identity/preference/apis/preference.service';
import { UserService } from '@src/features/identity/user/apis/user.service';
import { AchievementService } from '@src/features/insights/achievement/apis/achievement.service';
import { ReportService } from '@src/features/insights/report/apis/report.service';
import { MemoService } from '@src/features/notes/memo/apis/memo.service';
import { DeviceIdRepository } from '@src/features/notification/apis/device-id.repository';
import { DeviceIdService } from '@src/features/notification/apis/device-id.service';
import { createDeviceTimezoneRepository } from '@src/features/notification/apis/device-timezone.repository';
import { DeviceTimezoneService } from '@src/features/notification/apis/device-timezone.service';
import { createMarketingPushPromptRepository } from '@src/features/notification/apis/marketing-push-prompt.repository';
import { MarketingPushPromptService } from '@src/features/notification/apis/marketing-push-prompt.service';
import { NotificationService } from '@src/features/notification/apis/notification.service';
import { PushDeviceService } from '@src/features/notification/apis/push-device.service';
import { createPushPromptRepository } from '@src/features/notification/apis/push-prompt.repository';
import { PushPromptService } from '@src/features/notification/apis/push-prompt.service';
import { TodoCategoryService } from '@src/features/planning/category/apis/todo-category.service';
import { createFriendStripHintRepository } from '@src/features/planning/todo/apis/friend-strip-hint.repository';
import { FriendStripHintService } from '@src/features/planning/todo/apis/friend-strip-hint.service';
import { SubTodoService } from '@src/features/planning/todo/apis/sub-todo.service';
import { TodoService } from '@src/features/planning/todo/apis/todo.service';
import { FriendService } from '@src/features/social/friend/apis/friend.service';
import { createAllDoneBannerRepository } from '@src/features/social/invite/apis/all-done-banner.repository';
import { createInstallReferrerRepository } from '@src/features/social/invite/apis/install-referrer.repository';
import { InviteShareService } from '@src/features/social/invite/apis/invite-share.service';
import { InviteService } from '@src/features/social/invite/apis/invite.service';
import { createPawPrintCelebrationRepository } from '@src/features/social/invite/apis/paw-print-celebration.repository';
import { createPendingRedemptionRepository } from '@src/features/social/invite/apis/pending-redemption.repository';
import { ModerationService } from '@src/features/social/moderation/apis/moderation.service';
import { TodoNudgeService } from '@src/features/social/nudge/apis/todo-nudge.service';
import { InquiryService } from '@src/features/support/inquiry/apis/inquiry.service';
import { createOfflineModelPromptRepository } from '@src/features/voice/apis/offline-model-prompt.repository';
import { createRecognitionLanguageRepository } from '@src/features/voice/apis/recognition-language.repository';
import { createVoiceNoteDraftRepository } from '@src/features/voice/apis/voice-note-draft.repository';
import { VoiceNoteStorageService } from '@src/features/voice/apis/voice-note-storage.service';
import { createVoiceRecordingRepository } from '@src/features/voice/apis/voice-recording.repository';
import { VoiceService } from '@src/features/voice/apis/voice.service';
import { createWeatherIntroductionRepository } from '@src/features/weather/apis/weather-introduction.repository';
import { WeatherIntroductionService } from '@src/features/weather/apis/weather-introduction.service';
import { WeatherService } from '@src/features/weather/apis/weather.service';
import { createFeatureAttributionStore } from '@src/shared/analytics/feature-attribution';
import { DEVICE_MODEL_NAME } from '@src/shared/config/device';
import { ENV } from '@src/shared/config/env';
import { createDraftRepository } from '@src/shared/draft/draft.repository';
import { DraftService } from '@src/shared/draft/draft.service';
import { getErrorMessage, isKeychainLockedError, toError } from '@src/shared/errors';
import { expoAppIconGateway } from '@src/shared/infra/app-icon/expo-app-icon.gateway';
import { expoAppStoreGateway } from '@src/shared/infra/app-store/expo-app-store.gateway';
import { expoApplicationMetadataGateway } from '@src/shared/infra/application/expo-application-metadata.gateway';
import { expoInstallReferrerGateway } from '@src/shared/infra/application/expo-install-referrer.gateway';
import { expoInstallationIdGateway } from '@src/shared/infra/application/expo-installation-id.gateway';
import { expoClipboardGateway } from '@src/shared/infra/clipboard/expo-clipboard.gateway';
import { getDeviceTimezone } from '@src/shared/infra/device-clock';
import { setGlobalErrorReporter } from '@src/shared/infra/error-reporter';
import { expoLocalFileSystemGateway } from '@src/shared/infra/file-system/expo-local-file-system.gateway';
import { expoHapticsGateway } from '@src/shared/infra/haptics/expo-haptics.gateway';
import { createAuthClient } from '@src/shared/infra/http/auth-client';
import { KyHttpClient } from '@src/shared/infra/http/ky-client';
import { KyJsonFetcher } from '@src/shared/infra/http/ky-json-fetcher';
import { createPublicClient } from '@src/shared/infra/http/public-client';
import { createRefreshTokensRequest } from '@src/shared/infra/http/refresh-tokens-request';
import { createTokenRefresher } from '@src/shared/infra/http/token-refresher';
import { expoIdGenerator } from '@src/shared/infra/id-generator/expo-id-generator';
import { createKakaoShareClient } from '@src/shared/infra/kakao/kakao-share.client';
import { expoLocationGateway } from '@src/shared/infra/location/expo-location.gateway';
import {
  createCompositeLogger,
  createConsoleLogger,
  createSentryLogger,
  setGlobalLogger,
} from '@src/shared/infra/logger';
import { expoNetworkStatusGateway } from '@src/shared/infra/network/expo-network-status.gateway';
import { expoPushNotificationGateway } from '@src/shared/infra/notification/expo-push-notification.gateway';
import {
  createEnvironmentAnalytics,
  createEnvironmentErrorReporter,
} from '@src/shared/infra/observability-env';
import { revenueCatPurchasesGateway } from '@src/shared/infra/purchases/revenuecat-purchases.gateway';
import { rnSystemShareGateway } from '@src/shared/infra/share/rn-system-share.gateway';
import { expoSpeechRecognizerGateway } from '@src/shared/infra/speech/expo-speech-recognizer.gateway';
import type { EncryptedStorageBootstrap } from '@src/shared/infra/storage/mmkv-draft-storage';
import { mmkvSyncStorage } from '@src/shared/infra/storage/mmkv-storage';
import { SecureStorage } from '@src/shared/infra/storage/secure-storage';
import { createSecureTokenStore } from '@src/shared/infra/storage/secure-token-store';
import { widgetNavigationStorage } from '@src/shared/infra/storage/widget-navigation-storage';
import { useQueryClient } from '@tanstack/react-query';
import { type PropsWithChildren, useState } from 'react';

import { type DIContainer, DIContext } from './di-context';
import { QUERY_CACHE_LOG_EVENT } from './query-cache-log-events';
import type { QueryCacheStorage } from './query-cache-persistence';

interface DIProviderProps extends PropsWithChildren {
  /** 암호화 키 조회가 끝난 초안·조회 캐시 저장소. 비동기 준비는 앱 부트스트랩에서 마친다. */
  encryptedStorageBootstrap: EncryptedStorageBootstrap;
  /** `QueryProvider`와 같은 조회 캐시 저장소. 주인 지정·삭제는 인증 상태를 아는 쪽이 쓴다 */
  queryCacheStorage: QueryCacheStorage;
}

export function DIProvider({
  children,
  encryptedStorageBootstrap,
  queryCacheStorage,
}: DIProviderProps) {
  const queryClient = useQueryClient();
  const [di] = useState<DIContainer>(() => {
    const storage = new SecureStorage();
    const sessionEpoch = createSessionEpoch();
    const tokenStore = withSessionEpoch(createSecureTokenStore(storage), sessionEpoch);

    // Observability — 크래시/에러/이벤트/로그는 Sentry로 일원화(네이티브 크래시 포함),
    // Firebase는 Analytics(제품 지표)만 담당. Sentry init은 앱 루트(initSentry)에서 1회.
    const consoleLogger = createConsoleLogger({ minLevel: ENV.IS_PRODUCTION ? 'warn' : 'debug' });

    const logger = ENV.IS_PRODUCTION
      ? createCompositeLogger([consoleLogger, createSentryLogger()])
      : consoleLogger;

    setGlobalLogger(logger);

    const analytics = createEnvironmentAnalytics(logger);
    const featureAttribution = createFeatureAttributionStore(mmkvSyncStorage);
    const draftService = new DraftService(
      createDraftRepository(encryptedStorageBootstrap.draftStorage),
    );
    draftService.removeExpired();

    // 앱 레벨 에러/이벤트는 Sentry로 리포팅(검색가능 이벤트 + severity + breadcrumb).
    const errorReporter = createEnvironmentErrorReporter();

    // DI 밖(HTTP 훅·화면 추적 등 인프라)에서 breadcrumb를 남길 수 있도록 전역 접근자에 주입.
    setGlobalErrorReporter(errorReporter);

    const storageFailure = encryptedStorageBootstrap.failure;
    if (storageFailure != null) {
      // 이번 실행은 초안·조회 캐시를 기기에 남기지 않는다. 앱은 서버 값만으로 동작한다
      logger.warn(QUERY_CACHE_LOG_EVENT.ENCRYPTED_STORAGE_UNAVAILABLE, {
        error: getErrorMessage(storageFailure),
      });
      // 잠금 해제 전 실행처럼 키체인을 잠시 못 읽는 것은 예상된 상태라 이벤트로 올리지 않는다
      if (!isKeychainLockedError(storageFailure)) {
        errorReporter.captureException(toError(storageFailure), { feature: 'draft' });
      }
    }

    const installation = expoApplicationMetadataGateway.getInstallation();
    const appVersion = installation?.currentVersion ?? ENV.APP_VERSION;
    const appBuild = installation?.currentBuild;
    const publicKyInstance = createPublicClient({ appVersion, appBuild });
    const publicHttpClient = new KyHttpClient(publicKyInstance);
    const publicJsonFetcher = new KyJsonFetcher(publicKyInstance);

    // 세션 종료(토큰 삭제 + 이벤트)의 유일한 소유자. 갱신기는 세션을 끝낼 수 없다.
    const sessionManager = createSessionManager(tokenStore);

    // 단일 리프레셔: 인스턴스가 갈라지면 single-flight mutex가 분리되어
    // 동시 회전이 서버의 토큰 패밀리를 소모한다.
    const requestRefresh = createRefreshTokensRequest({ appVersion, appBuild });
    const tokenRefresher = createTokenRefresher({ tokenStore, requestRefresh, sessionEpoch });
    const sessionRevocationService = new SessionRevocationService({
      repository: createPendingRevocationRepository(storage),
      requestRefresh,
      publicHttpClient,
      logger,
    });

    const authKyInstance = createAuthClient({
      appVersion,
      appBuild,
      tokenStore,
      refresh: tokenRefresher,
      endSession: (reason) => sessionManager.end(reason),
      sessionEpoch,
    });
    const authHttpClient = new KyHttpClient(authKyInstance);

    // Achievement
    const achievementService = new AchievementService(authHttpClient);

    // AI
    const reportService = new ReportService(authHttpClient, logger);
    const suggestionService = new SuggestionService(authHttpClient, logger);
    const consentService = new ConsentService(authHttpClient);

    // Auth
    const authService = new AuthService(publicHttpClient, authHttpClient, tokenStore);
    const preferenceService = new PreferenceService(authHttpClient);
    const activationService = new ActivationService(
      createActivationProgressRepository(mmkvSyncStorage),
    );

    // Friend
    const friendService = new FriendService(authHttpClient);

    // 소개 캠페인 설정: app-config 응답은 기존 API envelope 없이 원문 JSON을 반환한다.
    const featureCampaignService = new FeatureCampaignService(publicJsonFetcher);
    const appVersionService = new AppVersionService(
      publicJsonFetcher,
      expoApplicationMetadataGateway,
      expoAppStoreGateway,
    );
    const whatsNewStateRepository = createWhatsNewStateRepository(mmkvSyncStorage);
    const whatsNewStateService = new WhatsNewStateService(whatsNewStateRepository);

    // Invite
    const pendingRedemptionRepository = createPendingRedemptionRepository(mmkvSyncStorage);
    const inviteService = new InviteService({
      publicHttpClient,
      authHttpClient,
      pendingRedemptionRepository,
      installReferrerRepository: createInstallReferrerRepository(
        mmkvSyncStorage,
        expoInstallReferrerGateway,
      ),
      pawPrintCelebrationRepository: createPawPrintCelebrationRepository(mmkvSyncStorage),
      installationIdGateway: expoInstallationIdGateway,
      allDoneBannerRepository: createAllDoneBannerRepository(mmkvSyncStorage),
      logger,
    });
    const inviteShareService = new InviteShareService({
      socialShare: createKakaoShareClient(ENV.KAKAO_NATIVE_APP_KEY),
      systemShare: rnSystemShareGateway,
      clipboard: expoClipboardGateway,
      errorReporter,
    });

    // Inquiry
    const inquiryService = new InquiryService(authHttpClient);

    // Memo
    const memoService = new MemoService(authHttpClient, logger);
    const voiceService = new VoiceService(authHttpClient, logger);
    const moderationService = new ModerationService(authHttpClient);

    // Todo
    const subTodoService = new SubTodoService(authHttpClient);
    const todoService = new TodoService(authHttpClient);
    const todoCommentService = new TodoCommentService(authHttpClient);

    // Todo Category
    const todoCategoryService = new TodoCategoryService(authHttpClient);

    // Notification
    const deviceIdRepository = new DeviceIdRepository();
    const deviceIdService = new DeviceIdService(deviceIdRepository);
    const notificationService = new NotificationService(
      authHttpClient,
      expoPushNotificationGateway,
      publicHttpClient,
    );
    const pushDeviceService = new PushDeviceService(
      expoPushNotificationGateway,
      deviceIdService,
      authHttpClient,
      logger,
      getDeviceTimezone,
    );
    const deviceTimezoneService = new DeviceTimezoneService(
      createDeviceTimezoneRepository(mmkvSyncStorage),
    );
    const pushPromptService = new PushPromptService(createPushPromptRepository(mmkvSyncStorage));
    const marketingPushPromptService = new MarketingPushPromptService(
      createMarketingPushPromptRepository(mmkvSyncStorage),
    );

    // Todo Nudge
    const todoNudgeService = new TodoNudgeService(authHttpClient);
    const coachmarkService = new CoachmarkService(createCoachmarkRepository(mmkvSyncStorage));
    const friendStripHintService = new FriendStripHintService(
      createFriendStripHintRepository(mmkvSyncStorage),
    );

    // Store review
    const storeReviewService = new StoreReviewService(
      createStoreReviewRepository(mmkvSyncStorage),
      expoAppStoreGateway,
    );

    // User
    const userService = new UserService(authHttpClient);

    // Subscription
    const purchasesSdkManager = new PurchasesSdkManager({
      purchases: revenueCatPurchasesGateway,
      logger,
      analytics,
      subscriberAttributes: {
        appVersion: installation?.currentVersion ?? null,
        deviceModel: DEVICE_MODEL_NAME,
      },
      isDebugLogEnabled: __DEV__,
    });
    const subscriptionService = new SubscriptionService(
      purchasesSdkManager,
      revenueCatPurchasesGateway,
      logger,
    );
    const entitlementService = new EntitlementService(authHttpClient, logger);

    // Weather
    const weatherService = new WeatherService(authHttpClient);

    // Voice note — 녹음은 기기 밖으로 나가지 않는다. 초안은 암호화 초안 저장소, 녹음은 문서 폴더에 둔다
    const voiceNoteStorageService = new VoiceNoteStorageService(
      createVoiceNoteDraftRepository({
        storage: encryptedStorageBootstrap.draftStorage,
        logger,
      }),
      createVoiceRecordingRepository(expoLocalFileSystemGateway, logger),
    );

    // Widget (홈 위젯 스냅샷 동기화 — 위젯은 순수 렌더러, 토큰/네트워크 접근 없음)
    const widgetBridge = createWidgetBridge();
    const widgetSyncService = new WidgetSyncService(widgetBridge, errorReporter);
    const widgetNavigationRepository = createWidgetNavigationRepository(widgetNavigationStorage);

    const sessionCleanupService = new SessionCleanupService({
      queryCache: createSessionQueryCache(queryClient),
      persistedQueryCache: queryCacheStorage,
      drafts: draftService,
      voiceNotes: voiceNoteStorageService,
      deviceTimezone: deviceTimezoneService,
      pendingRedemption: pendingRedemptionRepository,
      logger,
    });

    return {
      storage,
      logger,
      analytics,
      errorReporter,
      haptics: expoHapticsGateway,
      idGenerator: expoIdGenerator,
      speechRecognizer: expoSpeechRecognizerGateway,
      purchasesGateway: revenueCatPurchasesGateway,
      pushNotificationGateway: expoPushNotificationGateway,
      tokenStore,
      sessionManager,
      sessionCleanupService,
      sessionRevocationService,
      tokenRefresher,
      featureAttribution,
      draftService,
      queryCacheStorage,
      recognitionLanguageRepository: createRecognitionLanguageRepository(
        encryptedStorageBootstrap.draftStorage,
      ),
      offlineModelPromptRepository: createOfflineModelPromptRepository(
        encryptedStorageBootstrap.draftStorage,
      ),
      achievementService,
      reportService,
      suggestionService,
      consentService,
      authService,
      preferenceService,
      activationService,
      appVersionService,
      appIconService: new AppIconService(expoAppIconGateway),
      friendService,
      featureCampaignService,
      whatsNewStateService,
      inviteService,
      inviteShareService,
      inquiryService,
      memoService,
      voiceService,
      moderationService,
      subTodoService,
      todoService,
      todoCommentService,
      todoCategoryService,
      notificationService,
      pushDeviceService,
      deviceTimezoneService,
      pushPromptService,
      marketingPushPromptService,
      todoNudgeService,
      coachmarkService,
      friendStripHintService,
      storeReviewService,
      userService,
      purchasesSdkManager,
      subscriptionService,
      entitlementService,
      weatherService,
      weatherIntroductionService: new WeatherIntroductionService(
        createWeatherIntroductionRepository(mmkvSyncStorage),
      ),
      locationGateway: expoLocationGateway,
      clipboard: expoClipboardGateway,
      networkStatus: expoNetworkStatusGateway,
      widgetSyncService,
      widgetNavigationRepository,
      voiceNoteStorageService,
    };
  });

  return <DIContext.Provider value={di}>{children}</DIContext.Provider>;
}
