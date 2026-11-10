import type { DIContainer } from '@src/bootstrap/providers/di-context';
import { disabledQueryCacheStorage } from '@src/bootstrap/query/query-cache-persistence';
import type { AppIconGateway } from '@src/core/ports/app-icon-gateway';
import type { AppStoreReviewGateway } from '@src/core/ports/app-store-review-gateway';
import type { DeviceIdStore } from '@src/core/ports/device-id-store';
import type { HttpClient } from '@src/core/ports/http-client';
import type { InstallReferrerGateway } from '@src/core/ports/install-referrer-gateway';
import type { InstallationIdGateway } from '@src/core/ports/installation-id-gateway';
import type { JsonFetcher } from '@src/core/ports/json-fetcher';
import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import type { SocialShareGateway } from '@src/core/ports/social-share-gateway';
import type { EnumerableSyncStorage } from '@src/core/ports/sync-storage';
import type { RefreshTokensRequest } from '@src/core/ports/token-refresher';
import type { VendorIdGateway } from '@src/core/ports/vendor-id-gateway';
import { createSessionEpoch, withSessionEpoch } from '@src/core/session/session-epoch';
import { createSessionManager } from '@src/core/session/session-manager';
import { AppVersionService } from '@src/features/app-config/app-version/apis/app-version.service';
import { FeatureCampaignService } from '@src/features/app-config/feature-campaign/apis/feature-campaign.service';
import { createWhatsNewRepository } from '@src/features/app-config/whats-new/apis/whats-new.repository';
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
import type { WidgetBridge } from '@src/features/device/widget/bridge/widget-bridge';
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
import { VoiceService } from '@src/features/voice/apis/voice.service';
import { WeatherLocationService } from '@src/features/weather/apis/weather-location.service';
import { WeatherService } from '@src/features/weather/apis/weather.service';
import { createFeatureAttributionStore } from '@src/shared/analytics/feature-attribution';
import { getNowInstant } from '@src/shared/date/instant';
import { createDraftRepository } from '@src/shared/draft/draft.repository';
import { DraftService } from '@src/shared/draft/draft.service';
import { getDeviceTimezone } from '@src/shared/infra/localization/device-timezone';
import type { QueryClient } from '@tanstack/react-query';

import { createAnalyticsStub } from './create-analytics-stub';
import { createAppIconGatewayStub } from './create-app-icon-gateway-stub';
import { createAppLifecycleGatewayStub } from './create-app-lifecycle-gateway-stub';
import {
  createAppStoreListingGatewayStub,
  createAppStoreReviewGatewayStub,
} from './create-app-store-gateway-stub';
import { createClipboardGatewayStub } from './create-clipboard-gateway-stub';
import {
  createInstallReferrerGatewayStub,
  createInstallationIdGatewayStub,
  createVendorIdGatewayStub,
} from './create-device-identity-gateway-stub';
import { createErrorReporterStub } from './create-error-reporter-stub';
import {
  createExternalLinkGatewayStub,
  createIncomingLinkGatewayStub,
} from './create-external-link-gateway-stub';
import { createHapticsGatewayStub } from './create-haptics-gateway-stub';
import { createHttpClientStub } from './create-http-client-stub';
import { createIdGeneratorStub } from './create-id-generator-stub';
import { createJsonFetcherStub } from './create-json-fetcher-stub';
import type { LocalFileSystemFake } from './create-local-file-system-fake';
import { createLocationGatewayStub } from './create-location-gateway-stub';
import { createLoggerStub } from './create-logger-stub';
import { createMemoryDeviceIdStore } from './create-memory-device-id-store';
import { createMemoryObservableSyncStorage } from './create-memory-observable-sync-storage';
import { createMemoryStorage } from './create-memory-storage';
import { createMemorySyncStorage } from './create-memory-sync-storage';
import { createMemoryTokenStore } from './create-memory-token-store';
import { createNativeApplicationMetadataGatewayStub } from './create-native-application-metadata-gateway-stub';
import { createNetworkStatusGatewayStub } from './create-network-status-gateway-stub';
import { createPurchasesGatewayStub } from './create-purchases-gateway-stub';
import { createPushNotificationGatewayStub } from './create-push-notification-gateway-stub';
import { createSocialAuthGatewayStub } from './create-social-auth-gateway-stub';
import { createSocialShareGatewayStub } from './create-social-share-gateway-stub';
import { createSpeechRecognizerStub } from './create-speech-recognizer-stub';
import { createSystemShareGatewayStub } from './create-system-share-gateway-stub';
import { createTokenRefresherStub } from './create-token-refresher-stub';
import { createViewCaptureGatewayStub } from './create-view-capture-gateway-stub';
import { createVoiceNoteStorageFake } from './create-voice-note-storage-fake';
import { createTestQueryClient } from './query-client';

/** 컨테이너에는 없지만 Service와 저장소를 조립하는 데 쓰는 포트. 운영의 `di-provider`가 지역 변수로 만드는 것들이다 */
interface TestDiPorts {
  /** 공개 API와 인증 API가 함께 쓰는 HTTP 포트. 응답은 테스트가 이 stub에 정한다 */
  httpClient: HttpClient;
  jsonFetcher: JsonFetcher;
  appStoreReviewGateway: AppStoreReviewGateway;
  appIconGateway: AppIconGateway;
  socialShareGateway: SocialShareGateway;
  installReferrerGateway: InstallReferrerGateway;
  installationIdGateway: InstallationIdGateway;
  vendorIdGateway: VendorIdGateway;
  deviceIdStore: DeviceIdStore;
  localFileSystem: LocalFileSystemFake;
  widgetBridge: WidgetBridge;
  requestRefresh: RefreshTokensRequest;
  /** 암호화 초안 저장소. 초안, 말로 메모 초안, 인식 언어가 함께 쓴다 */
  draftStorage: EnumerableSyncStorage;
  /** 앱과 위젯이 함께 읽는 기기 저장소. 운영의 `deviceSyncStorage` 하나와 같다 */
  syncStorage: DIContainer['syncStorage'];
  /** 위젯 진입 명령을 남기는 저장소. 운영의 `widgetStorage`와 같다 */
  widgetStorage: ObservableSyncStorage;
  /** 세션 정리가 비우는 조회 캐시를 가진 클라이언트. `renderUi`는 자기 클라이언트를 넘긴다 */
  queryClient: QueryClient;
}

export type TestDiOverrides = Partial<DIContainer> & Partial<TestDiPorts>;

/**
 * 운영의 `di-provider`와 같은 모양으로 실제 Service를 포트 stub 위에 조립한 DI.
 * `renderUi`의 `di`나 `StaticDIProvider`에 넘긴다. 서버 응답은 `httpClient`에 정한다.
 * - 넣은 포트는 조립에도 쓰인다. `logger`를 넣으면 Service도 그 logger를 쓴다.
 * - 저장소는 운영처럼 `syncStorage` 하나를 함께 쓴다. 값을 미리 넣으려면 `di.syncStorage.set`을 쓴다.
 * - Service나 저장소를 직접 넣으면 조립한 것보다 앞선다.
 * 호출마다 stub과 메모리 저장소를 새로 만들어 테스트끼리 상태를 나누지 않는다.
 */
export function createTestDi({
  httpClient = createHttpClientStub(),
  jsonFetcher = createJsonFetcherStub(),
  appStoreReviewGateway = createAppStoreReviewGatewayStub(),
  appIconGateway = createAppIconGatewayStub(),
  socialShareGateway = createSocialShareGatewayStub(),
  installReferrerGateway = createInstallReferrerGatewayStub(),
  installationIdGateway = createInstallationIdGatewayStub(),
  vendorIdGateway = createVendorIdGatewayStub(),
  deviceIdStore = createMemoryDeviceIdStore(),
  localFileSystem,
  widgetBridge = { writeSnapshot: jest.fn(async () => {}) },
  requestRefresh = jest.fn(async () => {
    throw new Error('createTestDi: requestRefresh를 정하지 않았습니다');
  }),
  draftStorage = createMemorySyncStorage(),
  syncStorage = createMemoryObservableSyncStorage(),
  widgetStorage = createMemoryObservableSyncStorage(),
  queryClient = createTestQueryClient(),
  ...overrides
}: TestDiOverrides = {}): DIContainer {
  const logger = overrides.logger ?? createLoggerStub();
  const analytics = overrides.analytics ?? createAnalyticsStub();
  const errorReporter = overrides.errorReporter ?? createErrorReporterStub();
  const idGenerator = overrides.idGenerator ?? createIdGeneratorStub();
  const storage = overrides.storage ?? createMemoryStorage();
  const purchasesGateway = overrides.purchasesGateway ?? createPurchasesGatewayStub();
  const sessionEpoch = overrides.sessionEpoch ?? createSessionEpoch();
  const tokenStore =
    overrides.tokenStore ?? withSessionEpoch(createMemoryTokenStore(), sessionEpoch);
  const socialAuth = overrides.socialAuth ?? createSocialAuthGatewayStub();
  const pushNotification = overrides.pushNotification ?? createPushNotificationGatewayStub();
  const applicationMetadata =
    overrides.applicationMetadata ?? createNativeApplicationMetadataGatewayStub();
  const clipboard = overrides.clipboard ?? createClipboardGatewayStub();
  const systemShare = overrides.systemShare ?? createSystemShareGatewayStub();
  const deviceLocation = overrides.deviceLocation ?? createLocationGatewayStub();

  const draftService = new DraftService(createDraftRepository(draftStorage), Date.now);
  const voiceNoteStorage = createVoiceNoteStorageFake(localFileSystem, {
    storage: draftStorage,
    logger,
  });
  const whatsNewRepository = createWhatsNewRepository(syncStorage);
  const coachmarkRepository = createCoachmarkRepository(syncStorage, getNowInstant);
  const upsellDismissalRepository = createUpsellDismissalRepository(syncStorage);
  const pushPermissionPromptRepository = createPushPermissionPromptRepository(syncStorage);
  const marketingPushPromptRepository = createMarketingPushPromptRepository(syncStorage);
  const pendingRedemptionRepository = createPendingRedemptionRepository(syncStorage);
  const pendingRedemptionService = new PendingRedemptionService({
    pendingRedemptionRepository,
    installReferrerRepository: createInstallReferrerRepository(syncStorage),
    installReferrerGateway,
  });
  const notificationService = new NotificationService({
    httpClient,
    publicHttpClient: httpClient,
  });
  const deviceTimezoneService = new DeviceTimezoneService(
    createDeviceTimezoneRepository(syncStorage),
  );
  const authService = new AuthService({
    publicHttpClient: httpClient,
    authHttpClient: httpClient,
    tokenStore,
    socialAuthGateway: socialAuth,
    deviceType: 'IOS',
    logger,
  });
  const sessionRevocationService = new SessionRevocationService({
    repository: createPendingRevocationRepository(storage),
    requestRefresh,
    publicHttpClient: httpClient,
    logger,
    now: Date.now,
  });
  const pushDeviceService = new PushDeviceService({
    gateway: pushNotification,
    deviceIdService: new DeviceIdService({
      store: deviceIdStore,
      vendorIdGateway,
      idGenerator,
      platform: 'ios',
    }),
    httpClient,
    publicHttpClient: httpClient,
    registrationRepository: createPushRegistrationRepository(storage),
    logger,
    getTimeZone: getDeviceTimezone,
    sessionEpoch,
  });
  const purchasesSession = new PurchasesSession({
    purchases: purchasesGateway,
    logger,
    analytics,
    subscriberAttributes: {
      appVersion: applicationMetadata.getInstallation()?.currentVersion ?? null,
      deviceModel: null,
    },
  });
  const weatherService = new WeatherService(httpClient);

  return {
    storage,
    logger,
    analytics,
    errorReporter,
    haptics: createHapticsGatewayStub(),
    idGenerator,
    speechRecognizer: createSpeechRecognizerStub(),
    purchasesGateway,
    pushNotification,
    tokenStore,
    authSessionStore: createAuthSessionStore(),
    sessionEpoch,
    sessionManager: createSessionManager(tokenStore),
    sessionCleanupService: new SessionCleanupService({
      queryCache: createSessionQueryCache(queryClient),
      persistedQueryCache: disabledQueryCacheStorage,
      drafts: draftService,
      voiceNotes: voiceNoteStorage.service,
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
    }),
    sessionRevocationService,
    tokenRefresher: createTokenRefresherStub(),
    featureAttribution: createFeatureAttributionStore(syncStorage),
    draftService,
    queryCacheStorage: disabledQueryCacheStorage,
    recognitionLanguageRepository: createRecognitionLanguageRepository(draftStorage),
    offlineModelPromptRepository: createOfflineModelPromptRepository(draftStorage),
    achievementService: new AchievementService(httpClient),
    reportService: new ReportService(httpClient, logger),
    suggestionService: new SuggestionService(httpClient, logger),
    consentService: new ConsentService(httpClient),
    authService,
    preferenceService: new PreferenceService(httpClient),
    activationService: new ActivationService(createActivationProgressRepository(syncStorage)),
    activationProgressRepository: createActivationProgressRepository(syncStorage),
    appVersionService: new AppVersionService(jsonFetcher),
    appIconService: new AppIconService(appIconGateway),
    friendService: new FriendService(httpClient),
    inviteService: new InviteService({
      publicHttpClient: httpClient,
      authHttpClient: httpClient,
      pendingRedemptionService,
      installationIdGateway,
      logger,
    }),
    pendingRedemptionService,
    allDoneBannerRepository: createAllDoneBannerRepository(syncStorage),
    pawPrintCelebrationRepository: createPawPrintCelebrationRepository(syncStorage),
    inviteShareService: new InviteShareService({
      socialShare: socialShareGateway,
      systemShare,
      clipboard,
      errorReporter,
    }),
    featureCampaignService: new FeatureCampaignService(jsonFetcher),
    whatsNewRepository,
    inquiryService: new InquiryService(httpClient),
    memoService: new MemoService(httpClient, logger),
    voiceService: new VoiceService(httpClient, logger),
    moderationService: new ModerationService(httpClient),
    subTodoService: new SubTodoService(httpClient),
    todoService: new TodoService(httpClient),
    todoCommentService: new TodoCommentService(httpClient),
    todoCategoryService: new TodoCategoryService(httpClient),
    notificationService,
    notificationBadgeService: new NotificationBadgeService({
      badgeGateway: pushNotification,
      logger,
    }),
    notificationEntryStore: createNotificationEntryStore(),
    pushDeviceService,
    deviceTimezoneService,
    pushPermissionPromptRepository,
    calendarViewModeRepository: createCalendarViewModeRepository(syncStorage),
    marketingPushPromptRepository,
    todoNudgeService: new TodoNudgeService(httpClient),
    coachmarkService: new CoachmarkService(coachmarkRepository),
    storeReviewService: new StoreReviewService(
      createStoreReviewRepository(syncStorage),
      appStoreReviewGateway,
      getNowInstant,
    ),
    userService: new UserService(httpClient),
    purchasesSession,
    subscriptionService: new SubscriptionService(purchasesSession, purchasesGateway, logger),
    entitlementService: new EntitlementService(httpClient, logger),
    upsellDismissalRepository,
    weatherService,
    weatherLocationService: new WeatherLocationService({
      gateway: deviceLocation,
      weatherService,
      logger,
      errorReporter,
    }),
    deviceLocation,
    clipboard,
    applicationMetadata,
    socialAuth,
    appStoreListing: createAppStoreListingGatewayStub(),
    externalLink: createExternalLinkGatewayStub(),
    systemShare,
    incomingLink: createIncomingLinkGatewayStub(),
    syncStorage,
    networkStatus: createNetworkStatusGatewayStub(),
    appLifecycle: createAppLifecycleGatewayStub(),
    viewCapture: createViewCaptureGatewayStub(),
    widgetSyncService: new WidgetSyncService(
      widgetBridge,
      errorReporter,
      createWidgetHeadlessFailureRepository(widgetStorage),
    ),
    widgetNavigationRepository: createWidgetNavigationRepository(widgetStorage),
    logOutDeviceService: new LogOutDeviceService({
      authService,
      pushDeviceService,
      tokenStore,
      sessionRevocationService,
      sessionEpoch,
      logger,
    }),
    ...voiceNoteStorage.di,
    ...overrides,
  };
}
