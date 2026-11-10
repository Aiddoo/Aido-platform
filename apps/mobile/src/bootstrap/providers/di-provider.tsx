import { cleanStartupKeys } from '@src/bootstrap/startup/startup-key-cleanup';
import { createSessionEpoch, withSessionEpoch } from '@src/core/session/session-epoch';
import { createSessionManager } from '@src/core/session/session-manager';
import { AppVersionService } from '@src/features/app-config/app-version/apis/app-version.service';
import { FeatureCampaignService } from '@src/features/app-config/feature-campaign/apis/feature-campaign.service';
import { createWhatsNewRepository } from '@src/features/app-config/whats-new/apis/whats-new.repository';
import { RELEASES } from '@src/features/app-config/whats-new/constants/releases';
import { SuggestionService } from '@src/features/assistant/suggestion/apis/suggestion.service';
import { EntitlementService } from '@src/features/billing/subscription/apis/entitlement.service';
import { PurchasesSession } from '@src/features/billing/subscription/apis/purchases-session';
import { SubscriptionService } from '@src/features/billing/subscription/apis/subscription.service';
import { createUpsellDismissalRepository } from '@src/features/billing/subscription/apis/upsell-dismissal.repository';
import { createActivationProgressRepository } from '@src/features/device/activation/apis/activation-progress.repository';
import { ActivationService } from '@src/features/device/activation/apis/activation.service';
import { AppIconService } from '@src/features/device/app-icon/apis/app-icon.service';
import { createCoachmarkRepository } from '@src/features/device/coachmark/apis/coachmark.repository';
import { CoachmarkService } from '@src/features/device/coachmark/apis/coachmark.service';
import { createStoreReviewRepository } from '@src/features/device/store-review/apis/store-review.repository';
import { StoreReviewService } from '@src/features/device/store-review/apis/store-review.service';
import { createWidgetHeadlessFailureRepository } from '@src/features/device/widget/apis/widget-headless-failure.repository';
import { createWidgetNavigationRepository } from '@src/features/device/widget/apis/widget-navigation.repository';
import { WidgetSyncService } from '@src/features/device/widget/apis/widget-sync.service';
import { createWidgetBridge } from '@src/features/device/widget/bridge/create-widget-bridge';
import { TodoCommentService } from '@src/features/engagement/comment/apis/todo-comment.service';
import { createAuthSessionStore } from '@src/features/identity/auth/apis/auth-session.store';
import { AuthService } from '@src/features/identity/auth/apis/auth.service';
import { LogOutDeviceService } from '@src/features/identity/auth/apis/log-out-device.service';
import { createPendingRevocationRepository } from '@src/features/identity/auth/apis/pending-revocation.repository';
import { SessionCleanupService } from '@src/features/identity/auth/apis/session-cleanup.service';
import { createSessionQueryCache } from '@src/features/identity/auth/apis/session-query-cache';
import { SessionRevocationService } from '@src/features/identity/auth/apis/session-revocation.service';
import { UserDeviceDataService } from '@src/features/identity/auth/apis/user-device-data.service';
import { ConsentService } from '@src/features/identity/consent/apis/consent.service';
import { PreferenceService } from '@src/features/identity/preference/apis/preference.service';
import { UserService } from '@src/features/identity/user/apis/user.service';
import { AchievementService } from '@src/features/insights/achievement/apis/achievement.service';
import { ReportService } from '@src/features/insights/report/apis/report.service';
import { MemoService } from '@src/features/notes/memo/apis/memo.service';
import { DeviceIdService } from '@src/features/notification/apis/device-id.service';
import { createDeviceTimezoneRepository } from '@src/features/notification/apis/device-timezone.repository';
import { DeviceTimezoneService } from '@src/features/notification/apis/device-timezone.service';
import { createMarketingPushPromptRepository } from '@src/features/notification/apis/marketing-push-prompt.repository';
import { NotificationBadgeService } from '@src/features/notification/apis/notification-badge.service';
import { createNotificationEntryStore } from '@src/features/notification/apis/notification-entry.store';
import { NotificationService } from '@src/features/notification/apis/notification.service';
import { PushDeviceService } from '@src/features/notification/apis/push-device.service';
import { createPushPermissionPromptRepository } from '@src/features/notification/apis/push-permission-prompt.repository';
import { createPushRegistrationRepository } from '@src/features/notification/apis/push-registration.repository';
import { TodoCategoryService } from '@src/features/planning/category/apis/todo-category.service';
import { createCalendarViewModeRepository } from '@src/features/planning/todo/apis/calendar-view-mode.repository';
import { SubTodoService } from '@src/features/planning/todo/apis/sub-todo.service';
import { TodoService } from '@src/features/planning/todo/apis/todo.service';
import { FriendService } from '@src/features/social/friend/apis/friend.service';
import { createAllDoneBannerRepository } from '@src/features/social/invite/apis/all-done-banner.repository';
import { createInstallReferrerRepository } from '@src/features/social/invite/apis/install-referrer.repository';
import { InviteShareService } from '@src/features/social/invite/apis/invite-share.service';
import { InviteService } from '@src/features/social/invite/apis/invite.service';
import { createPawPrintCelebrationRepository } from '@src/features/social/invite/apis/paw-print-celebration.repository';
import { createPendingRedemptionRepository } from '@src/features/social/invite/apis/pending-redemption.repository';
import { PendingRedemptionService } from '@src/features/social/invite/apis/pending-redemption.service';
import { ModerationService } from '@src/features/social/moderation/apis/moderation.service';
import { TodoNudgeService } from '@src/features/social/nudge/apis/todo-nudge.service';
import { InquiryService } from '@src/features/support/inquiry/apis/inquiry.service';
import { createOfflineModelPromptRepository } from '@src/features/voice/apis/offline-model-prompt.repository';
import { createRecognitionLanguageRepository } from '@src/features/voice/apis/recognition-language.repository';
import { createVoiceNoteDraftRepository } from '@src/features/voice/apis/voice-note-draft.repository';
import { VoiceNoteStorageService } from '@src/features/voice/apis/voice-note-storage.service';
import { createVoiceRecordingRepository } from '@src/features/voice/apis/voice-recording.repository';
import { VoiceService } from '@src/features/voice/apis/voice.service';
import { WeatherLocationService } from '@src/features/weather/apis/weather-location.service';
import { WeatherService } from '@src/features/weather/apis/weather.service';
import { createFeatureAttributionStore } from '@src/shared/analytics/feature-attribution';
import { ENV } from '@src/shared/config/env';
import { getNowInstant } from '@src/shared/date/instant';
import { createDraftRepository } from '@src/shared/draft/draft.repository';
import { DraftService } from '@src/shared/draft/draft.service';
import { getErrorMessage, isKeychainLockedError, toError } from '@src/shared/errors';
import { i18n } from '@src/shared/i18n';
import { expoAppIconGateway } from '@src/shared/infra/app-icon/expo-app-icon-gateway';
import { reactNativeAppLifecycleGateway } from '@src/shared/infra/app-lifecycle/react-native-app-lifecycle-gateway';
import { expoAppStoreListingGateway } from '@src/shared/infra/app-store/expo-app-store-listing-gateway';
import { expoAppStoreReviewGateway } from '@src/shared/infra/app-store/expo-app-store-review-gateway';
import { expoInstallReferrerGateway } from '@src/shared/infra/application/expo-install-referrer-gateway';
import { expoInstallationIdGateway } from '@src/shared/infra/application/expo-installation-id-gateway';
import { expoNativeApplicationMetadataGateway } from '@src/shared/infra/application/expo-native-application-metadata-gateway';
import { expoVendorIdGateway } from '@src/shared/infra/application/expo-vendor-id-gateway';
import { expoClipboardGateway } from '@src/shared/infra/clipboard/expo-clipboard-gateway';
import { DEVICE_MODEL_NAME } from '@src/shared/infra/device/device-info';
import { createEnvironmentErrorReporter } from '@src/shared/infra/error-reporter/create-environment-error-reporter';
import { expoLocalFileSystem } from '@src/shared/infra/file-system/expo-local-file-system';
import { expoHapticsGateway } from '@src/shared/infra/haptics/expo-haptics-gateway';
import { createAuthClient } from '@src/shared/infra/http/auth-client';
import { KyHttpClient } from '@src/shared/infra/http/ky-client';
import { KyJsonFetcher } from '@src/shared/infra/http/ky-json-fetcher';
import { createPublicClient } from '@src/shared/infra/http/public-client';
import { createRefreshTokensRequest } from '@src/shared/infra/http/refresh-tokens-request';
import { createTokenRefresher } from '@src/shared/infra/http/token-refresher';
import { expoIdGenerator } from '@src/shared/infra/id-generator/expo-id-generator';
import { createKakaoSocialShareGateway } from '@src/shared/infra/kakao/kakao-social-share-gateway';
import { expoExternalLinkGateway } from '@src/shared/infra/linking/expo-external-link-gateway';
import { expoIncomingLinkGateway } from '@src/shared/infra/linking/expo-incoming-link-gateway';
import { getDeviceTimezone } from '@src/shared/infra/localization/device-timezone';
import { expoLocationGateway } from '@src/shared/infra/location/expo-location-gateway';
import {
  createCompositeLogger,
  createConsoleLogger,
  createSentryLogger,
  setGlobalLogger,
} from '@src/shared/infra/logger';
import { createExpoNetworkStatusGateway } from '@src/shared/infra/network/expo-network-status-gateway';
import { createExpoPushNotificationGateway } from '@src/shared/infra/notification/expo-push-notification-gateway';
import { createEnvironmentAnalytics } from '@src/shared/infra/observability/observability-env';
import { createRevenueCatPurchasesGateway } from '@src/shared/infra/purchases/revenuecat-purchases-gateway';
import { expoScreenOrientationGateway } from '@src/shared/infra/screen-orientation/expo-screen-orientation-gateway';
import { expoSystemShareGateway } from '@src/shared/infra/share/expo-system-share-gateway';
import { expoSocialAuthGateway } from '@src/shared/infra/social-auth/expo-social-auth-gateway';
import { expoSpeechRecognizer } from '@src/shared/infra/speech/expo-speech-recognizer';
import { deviceSyncStorage } from '@src/shared/infra/storage/device-sync-storage';
import type { EncryptedStorageBootstrap } from '@src/shared/infra/storage/encrypted-draft-storage';
import { secureDeviceIdStore } from '@src/shared/infra/storage/secure-device-id-store';
import { SecureStorage } from '@src/shared/infra/storage/secure-storage';
import { createSecureTokenStore } from '@src/shared/infra/storage/secure-token-store';
import { widgetStorage } from '@src/shared/infra/storage/widget-storage';
import { viewShotViewCaptureGateway } from '@src/shared/infra/view-capture/view-shot-view-capture-gateway';
import { useQueryClient } from '@tanstack/react-query';
import { type PropsWithChildren, useState } from 'react';

import { useEventListenerErrorReporting } from '../hooks/use-event-listener-error-reporting';
import { QUERY_CACHE_LOG_EVENT } from '../query/query-cache-log-events';
import type { QueryCacheStorage } from '../query/query-cache-persistence';
import { type DIContainer, StaticDIProvider } from './di-context';

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
    // Firebase는 Analytics(제품 지표)만 담당. Sentry init은 앱 루트(initErrorReporting)에서 1회.
    const consoleLogger = createConsoleLogger({ minLevel: ENV.IS_PRODUCTION ? 'warn' : 'debug' });

    const logger = ENV.IS_PRODUCTION
      ? createCompositeLogger([consoleLogger, createSentryLogger()])
      : consoleLogger;

    setGlobalLogger(logger);

    const analytics = createEnvironmentAnalytics(logger);
    const featureAttribution = createFeatureAttributionStore(deviceSyncStorage);
    const draftService = new DraftService(
      createDraftRepository(encryptedStorageBootstrap.draftStorage),
      Date.now,
    );
    draftService.removeExpired();

    const errorReporter = createEnvironmentErrorReporter();

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

    const installation = expoNativeApplicationMetadataGateway.getInstallation();
    const appVersion = installation?.currentVersion ?? ENV.APP_VERSION;
    const appBuild = installation?.currentBuild;
    const publicKyInstance = createPublicClient({ appVersion, appBuild, errorReporter });
    const publicHttpClient = new KyHttpClient(publicKyInstance);
    const publicJsonFetcher = new KyJsonFetcher(publicKyInstance);

    const sessionManager = createSessionManager(tokenStore);

    // 단일 리프레셔: 인스턴스가 갈라지면 single-flight mutex가 분리되어
    // 동시 회전이 서버의 토큰 패밀리를 소모한다.
    const requestRefresh = createRefreshTokensRequest({ appVersion, appBuild });
    const tokenRefresher = createTokenRefresher({
      tokenStore,
      requestRefresh,
      sessionEpoch,
      logger,
    });
    const sessionRevocationService = new SessionRevocationService({
      repository: createPendingRevocationRepository(storage),
      requestRefresh,
      publicHttpClient,
      logger,
      now: Date.now,
    });

    const authKyInstance = createAuthClient({
      appVersion,
      appBuild,
      tokenStore,
      refresh: tokenRefresher,
      endSession: (reason) => sessionManager.end(reason),
      sessionEpoch,
      logger,
      errorReporter,
    });
    const authHttpClient = new KyHttpClient(authKyInstance);

    const achievementService = new AchievementService(authHttpClient);

    const reportService = new ReportService(authHttpClient, logger);
    const suggestionService = new SuggestionService(authHttpClient, logger);
    const consentService = new ConsentService(authHttpClient);

    const authService = new AuthService({
      publicHttpClient,
      authHttpClient,
      tokenStore,
      socialAuthGateway: expoSocialAuthGateway,
      deviceType: process.env.EXPO_OS === 'ios' ? 'IOS' : 'ANDROID',
      logger,
    });
    const preferenceService = new PreferenceService(authHttpClient);
    const activationProgressRepository = createActivationProgressRepository(deviceSyncStorage);
    const activationService = new ActivationService(activationProgressRepository);

    const friendService = new FriendService(authHttpClient);

    // 소개 캠페인 설정: app-config 응답은 기존 API envelope 없이 원문 JSON을 반환한다.
    const featureCampaignService = new FeatureCampaignService(publicJsonFetcher);
    const appVersionService = new AppVersionService(publicJsonFetcher);
    const whatsNewRepository = createWhatsNewRepository(deviceSyncStorage);

    const pendingRedemptionRepository = createPendingRedemptionRepository(deviceSyncStorage);
    const pendingRedemptionService = new PendingRedemptionService({
      pendingRedemptionRepository,
      installReferrerRepository: createInstallReferrerRepository(deviceSyncStorage),
      installReferrerGateway: expoInstallReferrerGateway,
    });
    const inviteService = new InviteService({
      publicHttpClient,
      authHttpClient,
      pendingRedemptionService,
      installationIdGateway: expoInstallationIdGateway,
      logger,
    });
    const inviteShareService = new InviteShareService({
      socialShare: createKakaoSocialShareGateway(ENV.KAKAO_NATIVE_APP_KEY),
      systemShare: expoSystemShareGateway,
      clipboard: expoClipboardGateway,
      errorReporter,
    });

    const inquiryService = new InquiryService(authHttpClient);

    const memoService = new MemoService(authHttpClient, logger);
    const voiceService = new VoiceService(authHttpClient, logger);
    const moderationService = new ModerationService(authHttpClient);

    const subTodoService = new SubTodoService(authHttpClient);
    const todoService = new TodoService(authHttpClient);
    const todoCommentService = new TodoCommentService(authHttpClient);

    const todoCategoryService = new TodoCategoryService(authHttpClient);

    const deviceIdService = new DeviceIdService({
      store: secureDeviceIdStore,
      vendorIdGateway: expoVendorIdGateway,
      idGenerator: expoIdGenerator,
      platform: process.env.EXPO_OS,
    });
    const pushNotification = createExpoPushNotificationGateway(logger);
    const notificationService = new NotificationService({
      httpClient: authHttpClient,
      publicHttpClient,
    });
    const notificationBadgeService = new NotificationBadgeService({
      badgeGateway: pushNotification,
      logger,
    });
    const pushDeviceService = new PushDeviceService({
      gateway: pushNotification,
      deviceIdService,
      httpClient: authHttpClient,
      publicHttpClient,
      registrationRepository: createPushRegistrationRepository(storage),
      logger,
      getTimeZone: getDeviceTimezone,
      // 요청 헤더(Accept-Language)와 같은 값이다
      getLanguage: () => i18n.language,
      sessionEpoch,
    });
    const deviceTimezoneService = new DeviceTimezoneService(
      createDeviceTimezoneRepository(deviceSyncStorage),
    );
    const pushPermissionPromptRepository = createPushPermissionPromptRepository(deviceSyncStorage);
    const marketingPushPromptRepository = createMarketingPushPromptRepository(deviceSyncStorage);

    const todoNudgeService = new TodoNudgeService(authHttpClient);
    const coachmarkRepository = createCoachmarkRepository(deviceSyncStorage, getNowInstant);
    const coachmarkService = new CoachmarkService(coachmarkRepository);
    cleanStartupKeys(
      {
        'whats-new': () =>
          whatsNewRepository.removeRetiredKeys({
            campaignIds: RELEASES.map((release) => release.campaignId),
            now: getNowInstant(),
          }),
        coachmark: () => coachmarkRepository.removeRetiredKeys(),
      },
      logger,
    );

    const storeReviewService = new StoreReviewService(
      createStoreReviewRepository(deviceSyncStorage),
      expoAppStoreReviewGateway,
      getNowInstant,
    );

    const userService = new UserService(authHttpClient);

    const purchasesGateway = createRevenueCatPurchasesGateway({ isLogEnabled: __DEV__, logger });
    const purchasesSession = new PurchasesSession({
      purchases: purchasesGateway,
      logger,
      analytics,
      subscriberAttributes: {
        appVersion: installation?.currentVersion ?? null,
        deviceModel: DEVICE_MODEL_NAME,
      },
    });
    const subscriptionService = new SubscriptionService(purchasesSession, purchasesGateway, logger);
    const entitlementService = new EntitlementService(authHttpClient, logger);
    const upsellDismissalRepository = createUpsellDismissalRepository(deviceSyncStorage);

    const weatherService = new WeatherService(authHttpClient);

    // Voice note — 녹음은 기기 밖으로 나가지 않는다. 초안은 암호화 초안 저장소, 녹음은 문서 폴더에 둔다
    const voiceNoteDraftRepository = createVoiceNoteDraftRepository({
      storage: encryptedStorageBootstrap.draftStorage,
      logger,
      getTimeZone: getDeviceTimezone,
    });
    const voiceRecordingRepository = createVoiceRecordingRepository(expoLocalFileSystem, logger);
    const voiceNoteStorageService = new VoiceNoteStorageService(
      voiceNoteDraftRepository,
      voiceRecordingRepository,
      getNowInstant,
    );

    const widgetBridge = createWidgetBridge();
    const widgetSyncService = new WidgetSyncService(
      widgetBridge,
      errorReporter,
      createWidgetHeadlessFailureRepository(widgetStorage),
    );
    const widgetNavigationRepository = createWidgetNavigationRepository(widgetStorage);

    const sessionCleanupService = new SessionCleanupService({
      queryCache: createSessionQueryCache(queryClient),
      persistedQueryCache: queryCacheStorage,
      drafts: draftService,
      voiceNotes: voiceNoteStorageService,
      deviceTimezone: deviceTimezoneService,
      pendingRedemption: pendingRedemptionRepository,
      pushDevice: pushDeviceService,
      userDeviceData: new UserDeviceDataService({
        repositories: {
          'whats-new': whatsNewRepository,
          coachmark: coachmarkRepository,
          'push-permission-prompt': pushPermissionPromptRepository,
          'marketing-push-prompt': marketingPushPromptRepository,
          'upsell-dismissal': upsellDismissalRepository,
        },
        logger,
      }),
      logger,
    });

    return {
      storage,
      logger,
      analytics,
      errorReporter,
      haptics: expoHapticsGateway,
      idGenerator: expoIdGenerator,
      speechRecognizer: expoSpeechRecognizer,
      purchasesGateway,
      pushNotification,
      tokenStore,
      authSessionStore: createAuthSessionStore(),
      sessionEpoch,
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
      activationProgressRepository,
      appVersionService,
      appIconService: new AppIconService(expoAppIconGateway),
      friendService,
      featureCampaignService,
      whatsNewRepository,
      inviteService,
      pendingRedemptionService,
      allDoneBannerRepository: createAllDoneBannerRepository(deviceSyncStorage),
      pawPrintCelebrationRepository: createPawPrintCelebrationRepository(deviceSyncStorage),
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
      notificationBadgeService,
      notificationEntryStore: createNotificationEntryStore(),
      pushDeviceService,
      deviceTimezoneService,
      pushPermissionPromptRepository,
      calendarViewModeRepository: createCalendarViewModeRepository(deviceSyncStorage),
      marketingPushPromptRepository,
      todoNudgeService,
      coachmarkService,
      storeReviewService,
      userService,
      purchasesSession,
      subscriptionService,
      entitlementService,
      upsellDismissalRepository,
      weatherService,
      weatherLocationService: new WeatherLocationService({
        gateway: expoLocationGateway,
        weatherService,
        logger,
        errorReporter,
      }),
      deviceLocation: expoLocationGateway,
      clipboard: expoClipboardGateway,
      applicationMetadata: expoNativeApplicationMetadataGateway,
      socialAuth: expoSocialAuthGateway,
      appStoreListing: expoAppStoreListingGateway,
      externalLink: expoExternalLinkGateway,
      systemShare: expoSystemShareGateway,
      incomingLink: expoIncomingLinkGateway,
      syncStorage: deviceSyncStorage,
      networkStatus: createExpoNetworkStatusGateway(logger),
      appLifecycle: reactNativeAppLifecycleGateway,
      viewCapture: viewShotViewCaptureGateway,
      screenOrientation: expoScreenOrientationGateway,
      widgetSyncService,
      widgetNavigationRepository,
      logOutDeviceService: new LogOutDeviceService({
        authService,
        pushDeviceService,
        tokenStore,
        sessionRevocationService,
        sessionEpoch,
        logger,
      }),
      voiceNoteStorageService,
      voiceNoteDraftRepository,
      voiceRecordingRepository,
    };
  });

  useEventListenerErrorReporting(di.logger);

  return <StaticDIProvider container={di}>{children}</StaticDIProvider>;
}
