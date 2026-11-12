import { createSessionQueryCache } from '@src/bootstrap/query/session-query-cache';
import type { Analytics } from '@src/core/ports/analytics';
import type { AppIconGateway } from '@src/core/ports/app-icon-gateway';
import type { AppLifecycleGateway } from '@src/core/ports/app-lifecycle-gateway';
import type { AppLogger } from '@src/core/ports/app-logger';
import type { AppStoreListingGateway } from '@src/core/ports/app-store-listing-gateway';
import type { AppStoreReviewGateway } from '@src/core/ports/app-store-review-gateway';
import type { ClipboardGateway } from '@src/core/ports/clipboard-gateway';
import type { DeviceIdStore } from '@src/core/ports/device-id-store';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import type { ExternalLinkGateway } from '@src/core/ports/external-link-gateway';
import type { HapticsGateway } from '@src/core/ports/haptics-gateway';
import type { HttpClient } from '@src/core/ports/http-client';
import type { IdGenerator } from '@src/core/ports/id-generator';
import type { IncomingLinkGateway } from '@src/core/ports/incoming-link-gateway';
import type { InstallReferrerGateway } from '@src/core/ports/install-referrer-gateway';
import type { InstallationIdGateway } from '@src/core/ports/installation-id-gateway';
import type { JsonFetcher } from '@src/core/ports/json-fetcher';
import type { KeyValueStorage } from '@src/core/ports/key-value-storage';
import type { LocalFileSystem } from '@src/core/ports/local-file-system';
import type { LocationGateway } from '@src/core/ports/location-gateway';
import type { NativeApplicationMetadataGateway } from '@src/core/ports/native-application-metadata-gateway';
import type { NetworkStatusGateway } from '@src/core/ports/network-status-gateway';
import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import type { PurchasesGateway } from '@src/core/ports/purchases-gateway';
import type { PushNotificationGateway } from '@src/core/ports/push-notification-gateway';
import type { ScreenOrientationGateway } from '@src/core/ports/screen-orientation-gateway';
import type { SocialAuthGateway } from '@src/core/ports/social-auth-gateway';
import type { SocialShareGateway } from '@src/core/ports/social-share-gateway';
import type { SpeechRecognizer } from '@src/core/ports/speech-recognizer';
import type { EnumerableSyncStorage } from '@src/core/ports/sync-storage';
import type { SystemShareGateway } from '@src/core/ports/system-share-gateway';
import type { RefreshTokensRequest } from '@src/core/ports/token-refresher';
import type { TokenStore } from '@src/core/ports/token-store';
import type { VendorIdGateway } from '@src/core/ports/vendor-id-gateway';
import type { ViewCaptureGateway } from '@src/core/ports/view-capture-gateway';
import type { SessionEpoch } from '@src/core/session/session-epoch';
import { AppVersionApi } from '@src/features/app-config/app-version/apis/app-version.api';
import { WhatsNewCampaignApi } from '@src/features/app-config/whats-new/apis/whats-new-campaign.api';
import { createWhatsNewRepository } from '@src/features/app-config/whats-new/repositories/whats-new.repository';
import { SuggestionApi } from '@src/features/assistant/suggestion/apis/suggestion.api';
import { EntitlementApi } from '@src/features/billing/subscription/apis/entitlement.api';
import { upsellDismissalStoredValue } from '@src/features/billing/subscription/schemas/upsell-dismissal-storage.schema';
import { PurchasesSession } from '@src/features/billing/subscription/services/purchases.session';
import { SubscriptionService } from '@src/features/billing/subscription/services/subscription.service';
import { createActivationProgressRepository } from '@src/features/device/activation/repositories/activation-progress.repository';
import { ActivationService } from '@src/features/device/activation/services/activation.service';
import { AppIconService } from '@src/features/device/app-icon/services/app-icon.service';
import { createCoachmarkRepository } from '@src/features/device/coachmark/repositories/coachmark.repository';
import { createStoreReviewRepository } from '@src/features/device/store-review/repositories/store-review.repository';
import { StoreReviewService } from '@src/features/device/store-review/services/store-review.service';
import type { WidgetBridge } from '@src/features/device/widget/bridge/widget-bridge';
import { createWidgetNavigationRepository } from '@src/features/device/widget/repositories/widget-navigation.repository';
import { WidgetSyncService } from '@src/features/device/widget/services/widget-sync.service';
import { TodoCommentApi } from '@src/features/engagement/comment/apis/todo-comment.api';
import { AuthApi } from '@src/features/identity/auth/apis/auth.api';
import { createPendingRevocationRepository } from '@src/features/identity/auth/repositories/pending-revocation.repository';
import { LogOutDeviceService } from '@src/features/identity/auth/services/log-out-device.service';
import { SessionCleanupService } from '@src/features/identity/auth/services/session-cleanup.service';
import { SessionRevocationService } from '@src/features/identity/auth/services/session-revocation.service';
import { SignInService } from '@src/features/identity/auth/services/sign-in.service';
import { UserDeviceDataService } from '@src/features/identity/auth/services/user-device-data.service';
import { createAuthSessionStore } from '@src/features/identity/auth/stores/auth-session.store';
import { ConsentApi } from '@src/features/identity/consent/apis/consent.api';
import { PreferenceApi } from '@src/features/identity/preference/apis/preference.api';
import { UserApi } from '@src/features/identity/user/apis/user.api';
import { AchievementApi } from '@src/features/insights/achievement/apis/achievement.api';
import { ReportApi } from '@src/features/insights/report/apis/report.api';
import { MemoApi } from '@src/features/notes/memo/apis/memo.api';
import { NotificationApi } from '@src/features/notification/apis/notification.api';
import { PushDeviceApi } from '@src/features/notification/apis/push-device.api';
import { createMarketingPushPromptRepository } from '@src/features/notification/repositories/marketing-push-prompt.repository';
import { createPushRegistrationRepository } from '@src/features/notification/repositories/push-registration.repository';
import { deviceTimezoneStoredValue } from '@src/features/notification/schemas/device-timezone-storage.schema';
import { pushNoticeDismissedAtStoredValue } from '@src/features/notification/schemas/push-notice-dismissed-at-storage.schema';
import { pushPermissionDeferredAtStoredValue } from '@src/features/notification/schemas/push-permission-deferred-at-storage.schema';
import { DeviceIdService } from '@src/features/notification/services/device-id.service';
import { NotificationBadgeService } from '@src/features/notification/services/notification-badge.service';
import { PushRegistrationService } from '@src/features/notification/services/push-registration.service';
import { createPushNotificationEntryStore } from '@src/features/notification/stores/push-notification-entry.store';
import { createPushOnboardingGuardStore } from '@src/features/notification/stores/push-onboarding-guard.store';
import { TodoCategoryApi } from '@src/features/planning/category/apis/todo-category.api';
import { SubTodoApi } from '@src/features/planning/todo/apis/sub-todo.api';
import { TodoApi } from '@src/features/planning/todo/apis/todo.api';
import { FriendApi } from '@src/features/social/friend/apis/friend.api';
import { pendingRedemptionStoredValue } from '@src/features/social/invite/schemas/pending-redemption-storage.schema';
import { InviteShareService } from '@src/features/social/invite/services/invite-share.service';
import { InviteService } from '@src/features/social/invite/services/invite.service';
import { PendingRedemptionService } from '@src/features/social/invite/services/pending-redemption.service';
import { ModerationApi } from '@src/features/social/moderation/apis/moderation.api';
import { TodoNudgeApi } from '@src/features/social/nudge/apis/todo-nudge.api';
import { InquiryApi } from '@src/features/support/inquiry/apis/inquiry.api';
import { VoiceApi } from '@src/features/voice/apis/voice.api';
import { createVoiceNoteDraftRepository } from '@src/features/voice/repositories/voice-note-draft.repository';
import { createVoiceRecordingRepository } from '@src/features/voice/repositories/voice-recording.repository';
import { VoiceNoteStorageService } from '@src/features/voice/services/voice-note-storage.service';
import { WeatherApi } from '@src/features/weather/apis/weather.api';
import { WeatherLocationService } from '@src/features/weather/services/weather-location.service';
import { createFeatureAttributionStore } from '@src/shared/analytics/feature-attribution';
import { getNowInstant } from '@src/shared/date/clock';
import { createDraftRepository } from '@src/shared/draft/draft.repository';
import { DraftService } from '@src/shared/draft/draft.service';
import { removeStoredValue } from '@src/shared/storage/define-stored-value';
import { createAppMinuteClock } from '@src/shared/stores/minute-clock-store';
import type { QueryClient } from '@tanstack/react-query';

import {
  disabledQueryCacheStorage,
  type QueryCacheStorage,
} from '../query/query-cache-persistence';
import type { DIContainer } from './di-context';

/** 조립에 넣는 것. 운영은 `composition-root`가 프로세스에 한 번 만들고, 테스트는 `createTestPorts`의 stub이다 */
export interface AppContainerPorts {
  logger: AppLogger;
  analytics: Analytics;
  errorReporter: ErrorReporter;
  haptics: HapticsGateway;
  idGenerator: IdGenerator;
  speechRecognizer: SpeechRecognizer;
  /** 스토어 결제 SDK. 화면은 `SubscriptionService`로만 쓴다 */
  purchases: PurchasesGateway;
  pushNotification: PushNotificationGateway;
  /** SecureStore. 회수 대기와 푸시 등록 기록을 둔다 */
  storage: KeyValueStorage;
  /** 토큰 키를 아는 유일한 곳. 지우면 `sessionEpoch`가 오른다 */
  tokenStore: TokenStore;
  /** 토큰이 지워질 때마다 올라가는 세션 세대 */
  sessionEpoch: SessionEpoch;
  /** 로그인 전에도 부르는 API(로그인, 초대 코드, 공개 알림) */
  publicHttpClient: HttpClient;
  /** 토큰을 붙이고, 401이면 프로세스에 하나인 토큰 갱신기로 갱신한 뒤 다시 보낸다 */
  authHttpClient: HttpClient;
  /** API envelope 없는 원문 JSON(app-config) */
  jsonFetcher: JsonFetcher;
  /** 오프라인 로그아웃 뒤 서버 세션을 풀 때 갱신 토큰으로 보낸다 */
  requestRefresh: RefreshTokensRequest;
  socialAuth: SocialAuthGateway;
  socialShare: SocialShareGateway;
  systemShare: SystemShareGateway;
  clipboard: ClipboardGateway;
  externalLink: ExternalLinkGateway;
  incomingLink: IncomingLinkGateway;
  appLifecycle: AppLifecycleGateway;
  networkStatus: NetworkStatusGateway;
  viewCapture: ViewCaptureGateway;
  screenOrientation: ScreenOrientationGateway;
  deviceLocation: LocationGateway;
  applicationMetadata: NativeApplicationMetadataGateway;
  appStoreListing: AppStoreListingGateway;
  appStoreReview: AppStoreReviewGateway;
  appIcon: AppIconGateway;
  installReferrer: InstallReferrerGateway;
  installationId: InstallationIdGateway;
  vendorId: VendorIdGateway;
  deviceIdStore: DeviceIdStore;
  /** 말로 메모 녹음 파일. 기기 밖으로 나가지 않는다 */
  localFileSystem: LocalFileSystem;
  widgetBridge: WidgetBridge;
  /** 위젯 진입 명령과 위젯만 깨어난 프로세스의 실패 기록 */
  widgetStorage: ObservableSyncStorage;
  /** 앱과 위젯이 함께 읽는 기기 저장소. 키별 구독과 키 목록을 준다 */
  syncStorage: ObservableSyncStorage & Pick<EnumerableSyncStorage, 'keys'>;
  /** 로그아웃 때 비우는 암호화 저장소. 초안, 말로 메모 초안, 계정 범위 저장 값이 함께 쓴다 */
  draftStorage: EnumerableSyncStorage & ObservableSyncStorage;
  /** 오프라인 조회 캐시. 암호화 저장소를 열지 못하면 null이고 기기에 남기지 않는다 */
  queryCacheStorage: QueryCacheStorage | null;
  queryClient: QueryClient;
  platform: 'ios' | 'android';
  /** 운영 알림에서 구독 이벤트의 기기를 보도록 결제 SDK에 붙인다 */
  deviceModel: string | null;
  getTimeZone: () => string;
  /** 요청 헤더(Accept-Language)와 같은 값 */
  getLanguage: () => string;
}

/** 포트로 Service·저장소를 만들기만 한다. 구독·타이머·저장소 쓰기는 쓰는 Provider·훅의 effect가 맡는다 */
export function createAppContainer(ports: AppContainerPorts): DIContainer {
  const {
    logger,
    analytics,
    errorReporter,
    publicHttpClient,
    authHttpClient,
    tokenStore,
    sessionEpoch,
    syncStorage,
    draftStorage,
    pushNotification,
  } = ports;
  const queryCacheStorage = ports.queryCacheStorage ?? disabledQueryCacheStorage;

  const draftService = new DraftService(createDraftRepository(draftStorage), Date.now);
  const authApi = new AuthApi({ publicHttpClient, authHttpClient });
  const sessionRevocationService = new SessionRevocationService({
    repository: createPendingRevocationRepository(ports.storage),
    requestRefresh: ports.requestRefresh,
    authApi,
    logger,
    now: Date.now,
  });

  const activationProgressRepository = createActivationProgressRepository(syncStorage);
  const whatsNewRepository = createWhatsNewRepository(syncStorage);
  const coachmarkRepository = createCoachmarkRepository(syncStorage);
  const marketingPushPromptRepository = createMarketingPushPromptRepository(syncStorage);

  const pendingRedemptionService = new PendingRedemptionService(syncStorage, ports.installReferrer);

  const pushRegistrationService = new PushRegistrationService({
    gateway: pushNotification,
    pushDeviceApi: new PushDeviceApi({ authHttpClient, publicHttpClient }),
    deviceIdService: new DeviceIdService({
      store: ports.deviceIdStore,
      vendorId: ports.vendorId,
      idGenerator: ports.idGenerator,
      platform: ports.platform,
    }),
    registrationRepository: createPushRegistrationRepository(ports.storage),
    logger,
    getTimeZone: ports.getTimeZone,
    getLanguage: ports.getLanguage,
    sessionEpoch,
    now: getNowInstant,
  });

  const purchasesSession = new PurchasesSession({
    purchases: ports.purchases,
    logger,
    analytics,
    subscriberAttributes: {
      appVersion: ports.applicationMetadata.getInstallation()?.currentVersion ?? null,
      deviceModel: ports.deviceModel,
    },
  });

  // 말로 메모의 녹음은 기기 밖으로 나가지 않는다. 초안은 암호화 초안 저장소, 녹음은 문서 폴더에 둔다
  const voiceNoteDraftRepository = createVoiceNoteDraftRepository({
    storage: draftStorage,
    logger,
    getTimeZone: ports.getTimeZone,
  });
  const voiceRecordingRepository = createVoiceRecordingRepository(ports.localFileSystem, logger);
  const voiceNoteStorageService = new VoiceNoteStorageService(
    voiceNoteDraftRepository,
    voiceRecordingRepository,
    getNowInstant,
  );

  const weatherApi = new WeatherApi(authHttpClient, logger);

  return {
    logger,
    analytics,
    errorReporter,
    haptics: ports.haptics,
    idGenerator: ports.idGenerator,
    speechRecognizer: ports.speechRecognizer,
    pushNotification,
    tokenStore,
    authSessionStore: createAuthSessionStore(),
    sessionEpoch,
    sessionCleanupService: new SessionCleanupService({
      queryCache: createSessionQueryCache(ports.queryClient),
      persistedQueryCache: queryCacheStorage,
      drafts: draftService,
      voiceNotes: voiceNoteStorageService,
      deviceTimezone: { clear: () => removeStoredValue(syncStorage, deviceTimezoneStoredValue) },
      pendingRedemption: {
        clear: () => removeStoredValue(syncStorage, pendingRedemptionStoredValue),
      },
      pushDevice: pushRegistrationService,
      userDeviceData: new UserDeviceDataService({
        repositories: {
          'whats-new': whatsNewRepository,
          coachmark: coachmarkRepository,
          'push-permission-deferred': {
            clear: (userId) =>
              removeStoredValue(syncStorage, pushPermissionDeferredAtStoredValue, userId),
          },
          'push-notice-dismissed': {
            clear: (userId) =>
              removeStoredValue(syncStorage, pushNoticeDismissedAtStoredValue, userId),
          },
          'marketing-push-prompt': marketingPushPromptRepository,
          'upsell-dismissal': {
            clear: (userId) => removeStoredValue(syncStorage, upsellDismissalStoredValue, userId),
          },
        },
        logger,
      }),
      logger,
    }),
    sessionRevocationService,
    featureAttribution: createFeatureAttributionStore(syncStorage),
    draftService,
    queryCacheStorage,
    achievementApi: new AchievementApi(authHttpClient),
    reportApi: new ReportApi(authHttpClient, logger),
    suggestionApi: new SuggestionApi(authHttpClient, logger),
    consentApi: new ConsentApi(authHttpClient),
    authApi,
    signInService: new SignInService({
      authApi,
      tokenStore,
      socialAuth: ports.socialAuth,
      deviceType: ports.platform === 'ios' ? 'IOS' : 'ANDROID',
      logger,
    }),
    preferenceApi: new PreferenceApi(authHttpClient),
    activationService: new ActivationService(syncStorage),
    activationProgressRepository,
    appVersionApi: new AppVersionApi(ports.jsonFetcher),
    appIconService: new AppIconService(ports.appIcon),
    friendApi: new FriendApi(authHttpClient),
    inviteService: new InviteService({
      publicHttpClient,
      authHttpClient,
      pendingRedemptionService,
      installationId: ports.installationId,
      logger,
    }),
    pendingRedemptionService,
    inviteShareService: new InviteShareService({
      socialShare: ports.socialShare,
      systemShare: ports.systemShare,
      clipboard: ports.clipboard,
      errorReporter,
    }),
    // 기능 소개 캠페인 설정은 API envelope 없이 원문 JSON이다
    whatsNewCampaignApi: new WhatsNewCampaignApi(ports.jsonFetcher),
    whatsNewRepository,
    inquiryApi: new InquiryApi(authHttpClient),
    memoApi: new MemoApi(authHttpClient, logger),
    voiceApi: new VoiceApi(authHttpClient, logger),
    moderationApi: new ModerationApi(authHttpClient),
    subTodoApi: new SubTodoApi(authHttpClient),
    todoApi: new TodoApi(authHttpClient),
    todoCommentApi: new TodoCommentApi(authHttpClient),
    todoCategoryApi: new TodoCategoryApi(authHttpClient),
    notificationApi: new NotificationApi({ authHttpClient, publicHttpClient }),
    notificationBadgeService: new NotificationBadgeService({
      badge: pushNotification,
      logger,
    }),
    pushNotificationEntryStore: createPushNotificationEntryStore(),
    pushOnboardingGuardStore: createPushOnboardingGuardStore(),
    pushRegistrationService,
    marketingPushPromptRepository,
    todoNudgeApi: new TodoNudgeApi(authHttpClient),
    coachmarkRepository,
    storeReviewService: new StoreReviewService(
      createStoreReviewRepository(syncStorage),
      ports.appStoreReview,
      getNowInstant,
    ),
    userApi: new UserApi(authHttpClient),
    purchasesSession,
    subscriptionService: new SubscriptionService(purchasesSession, ports.purchases, logger),
    entitlementApi: new EntitlementApi(authHttpClient, logger),
    weatherApi,
    weatherLocationService: new WeatherLocationService({
      gateway: ports.deviceLocation,
      weatherApi,
      logger,
    }),
    deviceLocation: ports.deviceLocation,
    clipboard: ports.clipboard,
    applicationMetadata: ports.applicationMetadata,
    socialAuth: ports.socialAuth,
    appStoreListing: ports.appStoreListing,
    externalLink: ports.externalLink,
    systemShare: ports.systemShare,
    incomingLink: ports.incomingLink,
    syncStorage,
    accountSyncStorage: draftStorage,
    networkStatus: ports.networkStatus,
    appLifecycle: ports.appLifecycle,
    minuteClock: createAppMinuteClock(ports.appLifecycle),
    viewCapture: ports.viewCapture,
    screenOrientation: ports.screenOrientation,
    widgetSyncService: new WidgetSyncService(ports.widgetBridge, ports.widgetStorage),
    widgetNavigationRepository: createWidgetNavigationRepository(ports.widgetStorage),
    logOutDeviceService: new LogOutDeviceService({
      authApi,
      pushRegistrationService,
      tokenStore,
      sessionRevocationService,
      sessionEpoch,
      logger,
    }),
    voiceNoteStorageService,
    voiceNoteDraftRepository,
    voiceRecordingRepository,
  };
}
