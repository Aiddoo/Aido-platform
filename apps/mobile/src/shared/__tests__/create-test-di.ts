import type { DIContainer } from '@src/bootstrap/providers/di-context';
import { disabledQueryCacheStorage } from '@src/bootstrap/query/query-cache-persistence';
import type { HttpClient } from '@src/core/ports/http-client';
import { createSessionEpoch } from '@src/core/session/session-epoch';
import { AppVersionService } from '@src/features/app-config/app-version/apis/app-version.service';
import { SuggestionService } from '@src/features/assistant/suggestion/apis/suggestion.service';
import { EntitlementService } from '@src/features/billing/subscription/apis/entitlement.service';
import { createActivationProgressRepository } from '@src/features/device/activation/apis/activation-progress.repository';
import { ActivationService } from '@src/features/device/activation/apis/activation.service';
import { AppIconService } from '@src/features/device/app-icon/apis/app-icon.service';
import { createCoachmarkRepository } from '@src/features/device/coachmark/apis/coachmark.repository';
import { CoachmarkService } from '@src/features/device/coachmark/apis/coachmark.service';
import { createStoreReviewRepository } from '@src/features/device/store-review/apis/store-review.repository';
import { StoreReviewService } from '@src/features/device/store-review/apis/store-review.service';
import { TodoCommentService } from '@src/features/engagement/comment/apis/todo-comment.service';
import { createAuthSessionStore } from '@src/features/identity/auth/apis/auth-session.store';
import { AuthService } from '@src/features/identity/auth/apis/auth.service';
import { ConsentService } from '@src/features/identity/consent/apis/consent.service';
import { PreferenceService } from '@src/features/identity/preference/apis/preference.service';
import { UserService } from '@src/features/identity/user/apis/user.service';
import { AchievementService } from '@src/features/insights/achievement/apis/achievement.service';
import { MemoService } from '@src/features/notes/memo/apis/memo.service';
import { createDeviceTimezoneRepository } from '@src/features/notification/apis/device-timezone.repository';
import { DeviceTimezoneService } from '@src/features/notification/apis/device-timezone.service';
import { createNotificationEntryStore } from '@src/features/notification/apis/notification-entry.store';
import { NotificationService } from '@src/features/notification/apis/notification.service';
import { TodoCategoryService } from '@src/features/planning/category/apis/todo-category.service';
import { SubTodoService } from '@src/features/planning/todo/apis/sub-todo.service';
import { TodoService } from '@src/features/planning/todo/apis/todo.service';
import { createAllDoneBannerRepository } from '@src/features/social/invite/apis/all-done-banner.repository';
import { createPawPrintCelebrationRepository } from '@src/features/social/invite/apis/paw-print-celebration.repository';
import { TodoNudgeService } from '@src/features/social/nudge/apis/todo-nudge.service';
import { InquiryService } from '@src/features/support/inquiry/apis/inquiry.service';
import { createOfflineModelPromptRepository } from '@src/features/voice/apis/offline-model-prompt.repository';
import { VoiceService } from '@src/features/voice/apis/voice.service';
import { getNowInstant } from '@src/shared/date/instant';
import { createDraftRepository } from '@src/shared/draft/draft.repository';
import { DraftService } from '@src/shared/draft/draft.service';

import { createAnalyticsStub } from './create-analytics-stub';
import { createAppIconGatewayStub } from './create-app-icon-gateway-stub';
import { createErrorReporterStub } from './create-error-reporter-stub';
import {
  createExternalLinkGatewayStub,
  createIncomingLinkGatewayStub,
} from './create-external-link-gateway-stub';
import { createHapticsStub } from './create-haptics-stub';
import { createHttpClientStub } from './create-http-client-stub';
import { createIdGeneratorStub } from './create-id-generator-stub';
import { createLoggerStub } from './create-logger-stub';
import { createMemoryObservableSyncStorage } from './create-memory-observable-sync-storage';
import { createMemorySyncStorage } from './create-memory-sync-storage';
import { createMemoryTokenStore } from './create-memory-token-store';
import { createPushNotificationGatewayStub } from './create-push-notification-gateway-stub';
import { createSocialAuthGatewayStub } from './create-social-auth-gateway-stub';
import { createVoiceNoteStorageFake } from './create-voice-note-storage-fake';

type TestDiOverrides = Partial<DIContainer> & {
  /** 실제 Service들이 함께 쓰는 HTTP 포트. 응답은 테스트가 이 stub에 정한다 */
  httpClient?: HttpClient;
};

/**
 * 실제 Service를 포트 stub 위에 조립한 DI. `renderUi`의 `di`나 `StaticDIProvider`에 넘긴다.
 * 화면 테스트는 서비스를 mock하지 않고 `httpClient` 응답만 정한다.
 * 넣은 override는 조립한 값보다 앞서고, 조립하지 않은 포트에 손대면 이름을 대며 즉시 실패한다.
 * 호출마다 stub과 메모리 저장소를 새로 만들어 테스트끼리 상태를 나누지 않는다.
 */
export function createTestDi({
  httpClient = createHttpClientStub(),
  ...overrides
}: TestDiOverrides = {}): DIContainer {
  const logger = overrides.logger ?? createLoggerStub();
  const pushNotificationGateway =
    overrides.pushNotificationGateway ?? createPushNotificationGatewayStub();

  const dependencies: Partial<DIContainer> = {
    memoService: new MemoService(httpClient, logger),
    voiceService: new VoiceService(httpClient, logger),
    suggestionService: new SuggestionService(httpClient, logger),
    todoCategoryService: new TodoCategoryService(httpClient),
    todoCommentService: new TodoCommentService(httpClient),
    todoNudgeService: new TodoNudgeService(httpClient),
    todoService: new TodoService(httpClient),
    subTodoService: new SubTodoService(httpClient),
    draftService: new DraftService(createDraftRepository(createMemorySyncStorage()), Date.now),
    activationService: new ActivationService(
      createActivationProgressRepository(createMemorySyncStorage()),
    ),
    storeReviewService: new StoreReviewService(
      createStoreReviewRepository(createMemorySyncStorage()),
      { isAvailable: jest.fn().mockResolvedValue(false), requestReview: jest.fn() },
      getNowInstant,
    ),
    inquiryService: new InquiryService(httpClient),
    achievementService: new AchievementService(httpClient),
    appIconService: new AppIconService(createAppIconGatewayStub()),
    appVersionService: new AppVersionService({ get: jest.fn() }),
    applicationMetadata: {
      getInstallation: () => ({ platform: 'ios', currentVersion: '1.15.0' }),
    },
    appStoreListing: { openListing: jest.fn() },
    userService: new UserService(httpClient),
    preferenceService: new PreferenceService(httpClient),
    entitlementService: new EntitlementService(httpClient, logger),
    authService: new AuthService({
      publicHttpClient: httpClient,
      authHttpClient: httpClient,
      tokenStore: createMemoryTokenStore(),
      socialAuthGateway: createSocialAuthGatewayStub(),
    }),
    consentService: new ConsentService(httpClient),
    coachmarkService: new CoachmarkService(createCoachmarkRepository(createMemorySyncStorage())),
    analytics: createAnalyticsStub(),
    errorReporter: createErrorReporterStub(),
    pushNotificationGateway,
    notificationService: new NotificationService(httpClient, pushNotificationGateway, httpClient),
    logger,
    // useTrack은 모든 화면에서 귀속 저장소를 함께 주입받는다. 귀속 동작을 검증하는 테스트만 override한다
    featureAttribution: {
      record: jest.fn(),
      consume: jest.fn().mockReturnValue(null),
    },
    // 로그아웃 정리가 부르는 저장소라 관심 없는 테스트에는 빈 메모리 저장소를 둔다
    deviceTimezoneService: new DeviceTimezoneService(
      createDeviceTimezoneRepository(createMemorySyncStorage()),
    ),
    // 인증 입구가 항상 읽는 세대와 응답 슬롯이라 관심 없는 테스트에는 빈 값을 둔다
    sessionEpoch: createSessionEpoch(),
    authSessionStore: createAuthSessionStore(),
    notificationEntryStore: createNotificationEntryStore(),
    // 햅틱은 꾸밈이라 저장·실패 흐름 테스트마다 넣지 않아도 되게 아무것도 하지 않는 stub을 둔다
    haptics: createHapticsStub(),
    // 링크를 여는 훅은 화면마다 렌더 때 읽으니 여는 동작을 보는 테스트만 override한다
    externalLink: createExternalLinkGatewayStub(),
    incomingLink: createIncomingLinkGatewayStub(),
    // 기기에 남기는 값을 읽는 훅이 렌더 때 읽으니 값을 정해 두는 테스트만 override한다
    syncStorage: createMemoryObservableSyncStorage(),
    // 공유 훅을 렌더 때 읽는 화면이 있어 공유를 보는 테스트만 override한다
    systemShare: {
      share: jest.fn().mockResolvedValue(true),
      isImageShareAvailable: jest.fn().mockResolvedValue(true),
      shareImage: jest.fn().mockResolvedValue(undefined),
    },
    // 초안 id·멱등 키는 쓰는 화면이 많아 호출마다 다른 값을 주는 stub을 기본으로 둔다
    idGenerator: createIdGeneratorStub(),
    // 로그아웃·사용자 전환 정리가 부르는 저장소라 관심 없는 테스트에는 빈 메모리 저장소를 둔다
    ...createVoiceNoteStorageFake().di,
    // 초대 안내 배너를 그리는 화면이 렌더 때 읽는 저장소라 빈 메모리 저장소를 둔다
    allDoneBannerRepository: createAllDoneBannerRepository(createMemorySyncStorage()),
    pawPrintCelebrationRepository: createPawPrintCelebrationRepository(createMemorySyncStorage()),
    // 사용자 식별 훅이 로그인 때 주인을 지정하는 저장소라 기기에 남기지 않는 저장소를 둔다
    queryCacheStorage: disabledQueryCacheStorage,
    // 말로 메모 녹음 훅이 항상 읽는다. 받기 안내를 보는 테스트만 override한다
    offlineModelPromptRepository: createOfflineModelPromptRepository(createMemorySyncStorage()),
    ...overrides,
  };

  const dependency = <TKey extends keyof DIContainer>(key: TKey): DIContainer[TKey] => {
    const value = dependencies[key];
    if (value == null) {
      throw new Error(`테스트 DI에 '${key}'가 주입되지 않았습니다`);
    }
    return value;
  };

  const container: DIContainer = {
    get storage() {
      return dependency('storage');
    },
    get locationGateway() {
      return dependency('locationGateway');
    },
    get socialAuthGateway() {
      return dependency('socialAuthGateway');
    },
    get applicationMetadata() {
      return dependency('applicationMetadata');
    },
    get appStoreListing() {
      return dependency('appStoreListing');
    },
    get clipboard() {
      return dependency('clipboard');
    },
    get externalLink() {
      return dependency('externalLink');
    },
    get systemShare() {
      return dependency('systemShare');
    },
    get syncStorage() {
      return dependency('syncStorage');
    },
    get incomingLink() {
      return dependency('incomingLink');
    },
    get networkStatus() {
      return dependency('networkStatus');
    },
    get logger() {
      return dependency('logger');
    },
    get analytics() {
      return dependency('analytics');
    },
    get errorReporter() {
      return dependency('errorReporter');
    },
    get haptics() {
      return dependency('haptics');
    },
    get idGenerator() {
      return dependency('idGenerator');
    },
    get speechRecognizer() {
      return dependency('speechRecognizer');
    },
    get purchasesGateway() {
      return dependency('purchasesGateway');
    },
    get pushNotificationGateway() {
      return dependency('pushNotificationGateway');
    },
    get sessionEpoch() {
      return dependency('sessionEpoch');
    },
    get notificationEntryStore() {
      return dependency('notificationEntryStore');
    },
    get tokenStore() {
      return dependency('tokenStore');
    },
    get authSessionStore() {
      return dependency('authSessionStore');
    },
    get sessionManager() {
      return dependency('sessionManager');
    },
    get sessionCleanupService() {
      return dependency('sessionCleanupService');
    },
    get sessionRevocationService() {
      return dependency('sessionRevocationService');
    },
    get tokenRefresher() {
      return dependency('tokenRefresher');
    },
    get featureAttribution() {
      return dependency('featureAttribution');
    },
    get draftService() {
      return dependency('draftService');
    },
    get queryCacheStorage() {
      return dependency('queryCacheStorage');
    },
    get recognitionLanguageRepository() {
      return dependency('recognitionLanguageRepository');
    },
    get offlineModelPromptRepository() {
      return dependency('offlineModelPromptRepository');
    },
    get achievementService() {
      return dependency('achievementService');
    },
    get reportService() {
      return dependency('reportService');
    },
    get suggestionService() {
      return dependency('suggestionService');
    },
    get consentService() {
      return dependency('consentService');
    },
    get authService() {
      return dependency('authService');
    },
    get preferenceService() {
      return dependency('preferenceService');
    },
    get activationService() {
      return dependency('activationService');
    },
    get appVersionService() {
      return dependency('appVersionService');
    },
    get appIconService() {
      return dependency('appIconService');
    },
    get friendService() {
      return dependency('friendService');
    },
    get inviteService() {
      return dependency('inviteService');
    },
    get inviteShareService() {
      return dependency('inviteShareService');
    },
    get featureCampaignService() {
      return dependency('featureCampaignService');
    },
    get whatsNewRepository() {
      return dependency('whatsNewRepository');
    },
    get inquiryService() {
      return dependency('inquiryService');
    },
    get voiceService() {
      return dependency('voiceService');
    },
    get memoService() {
      return dependency('memoService');
    },
    get moderationService() {
      return dependency('moderationService');
    },
    get subTodoService() {
      return dependency('subTodoService');
    },
    get todoService() {
      return dependency('todoService');
    },
    get todoCommentService() {
      return dependency('todoCommentService');
    },
    get todoCategoryService() {
      return dependency('todoCategoryService');
    },
    get notificationService() {
      return dependency('notificationService');
    },
    get pushDeviceService() {
      return dependency('pushDeviceService');
    },
    get deviceTimezoneService() {
      return dependency('deviceTimezoneService');
    },
    get pushPromptRepository() {
      return dependency('pushPromptRepository');
    },
    get marketingPushPromptRepository() {
      return dependency('marketingPushPromptRepository');
    },
    get todoNudgeService() {
      return dependency('todoNudgeService');
    },
    get coachmarkService() {
      return dependency('coachmarkService');
    },
    get storeReviewService() {
      return dependency('storeReviewService');
    },
    get userService() {
      return dependency('userService');
    },
    get purchasesSdkManager() {
      return dependency('purchasesSdkManager');
    },
    get subscriptionService() {
      return dependency('subscriptionService');
    },
    get entitlementService() {
      return dependency('entitlementService');
    },
    get weatherService() {
      return dependency('weatherService');
    },
    get weatherLocationService() {
      return dependency('weatherLocationService');
    },
    get weatherIntroductionRepository() {
      return dependency('weatherIntroductionRepository');
    },
    get widgetSyncService() {
      return dependency('widgetSyncService');
    },
    get widgetNavigationRepository() {
      return dependency('widgetNavigationRepository');
    },
    get allDoneBannerRepository() {
      return dependency('allDoneBannerRepository');
    },
    get pawPrintCelebrationRepository() {
      return dependency('pawPrintCelebrationRepository');
    },
    get logOutDeviceService() {
      return dependency('logOutDeviceService');
    },
    get voiceNoteStorageService() {
      return dependency('voiceNoteStorageService');
    },
    get voiceNoteDraftRepository() {
      return dependency('voiceNoteDraftRepository');
    },
    get voiceRecordingRepository() {
      return dependency('voiceRecordingRepository');
    },
  };

  // 펼치면(`{ ...createTestDi() }`) 주입한 포트만 복사되고, 안 넣은 포트의 getter는 건드리지 않는다
  const provided = new Set(Object.keys(dependencies));
  Object.keys(container)
    .filter((key) => !provided.has(key))
    .forEach((key) => Object.defineProperty(container, key, { enumerable: false }));

  return container;
}
