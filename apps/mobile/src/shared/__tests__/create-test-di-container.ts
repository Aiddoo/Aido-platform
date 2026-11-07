import type { DIContainer } from '@src/bootstrap/providers/di-context';
import { createSessionEpoch } from '@src/core/session/session-epoch';
import { createAuthSessionStore } from '@src/features/identity/auth/apis/auth-session.store';
import { createDeviceTimezoneRepository } from '@src/features/notification/apis/device-timezone.repository';
import { DeviceTimezoneService } from '@src/features/notification/apis/device-timezone.service';
import { createNotificationEntryStore } from '@src/features/notification/apis/notification-entry.store';
import { createOfflineModelPromptRepository } from '@src/features/voice/apis/offline-model-prompt.repository';

import { createHapticsStub } from './create-haptics-stub';
import { createIdGeneratorStub } from './create-id-generator-stub';
import { createMemorySyncStorage } from './create-memory-sync-storage';
import { createVoiceNoteStorageServiceFake } from './create-voice-note-storage-service-fake';

/**
 * 테스트용 DI 컨테이너. 주입한 의존성만 노출하고,
 * 주입하지 않은 의존성에 접근하면 즉시 실패시켜 누락을 드러낸다.
 *
 * StaticDIProvider와 함께 사용한다:
 * ```tsx
 * <StaticDIProvider container={createTestDiContainer({ analytics })}>
 * ```
 */
export function createTestDiContainer(overrides: Partial<DIContainer> = {}): DIContainer {
  const defaults: Partial<DIContainer> = {
    // useTrack은 모든 화면에서 귀속 저장소를 함께 주입받는다. 관심 없는 테스트에서는
    // no-op을 제공하고, 귀속 동작을 검증하는 테스트만 명시적으로 override한다.
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
    // 초안 id·멱등 키는 쓰는 화면이 많아 호출마다 다른 값을 주는 stub을 기본으로 둔다
    idGenerator: createIdGeneratorStub(),
    // 로그아웃·사용자 전환 정리가 부르는 저장소라 관심 없는 테스트에는 빈 메모리 저장소를 둔다
    voiceNoteStorageService: createVoiceNoteStorageServiceFake(),
    // 말로 메모 녹음 훅이 항상 읽는다. 받기 안내를 보는 테스트만 override한다
    offlineModelPromptRepository: createOfflineModelPromptRepository(createMemorySyncStorage()),
  };
  const dependencies: Partial<DIContainer> = { ...defaults, ...overrides };

  const dependency = <TKey extends keyof DIContainer>(key: TKey): DIContainer[TKey] => {
    const value = dependencies[key];
    if (value == null) {
      throw new Error(`테스트 DI 컨테이너에 '${key}'가 주입되지 않았습니다`);
    }
    return value;
  };

  return {
    get storage() {
      return dependency('storage');
    },
    get locationGateway() {
      return dependency('locationGateway');
    },
    get clipboard() {
      return dependency('clipboard');
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
    get weatherIntroductionService() {
      return dependency('weatherIntroductionService');
    },
    get widgetSyncService() {
      return dependency('widgetSyncService');
    },
    get widgetNavigationRepository() {
      return dependency('widgetNavigationRepository');
    },
    get voiceNoteStorageService() {
      return dependency('voiceNoteStorageService');
    },
  };
}
