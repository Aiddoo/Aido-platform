import type { DIContainer } from '@src/bootstrap/providers/di-context';

import { createHapticsStub } from './create-haptics-stub';

/**
 * 테스트용 DI 컨테이너. 주입한 의존성만 노출하고,
 * 주입하지 않은 의존성에 접근하면 즉시 실패시켜 누락을 드러낸다.
 *
 * StaticDIProvider와 함께 사용한다:
 * ```tsx
 * <StaticDIProvider container={createMockDIContainer({ analytics })}>
 * ```
 */
export function createMockDIContainer(overrides: Partial<DIContainer> = {}): DIContainer {
  const defaults: Partial<DIContainer> = {
    // useTrack은 모든 화면에서 귀속 저장소를 함께 주입받는다. 관심 없는 테스트에서는
    // no-op을 제공하고, 귀속 동작을 검증하는 테스트만 명시적으로 override한다.
    featureAttribution: {
      record: jest.fn(),
      consume: jest.fn().mockReturnValue(null),
    },
    // 햅틱은 꾸밈이라 저장·실패 흐름 테스트마다 넣지 않아도 되게 아무것도 하지 않는 stub을 둔다
    haptics: createHapticsStub(),
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
    get speechRecognizer() {
      return dependency('speechRecognizer');
    },
    get purchasesGateway() {
      return dependency('purchasesGateway');
    },
    get tokenStore() {
      return dependency('tokenStore');
    },
    get sessionManager() {
      return dependency('sessionManager');
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
    get achievementService() {
      return dependency('achievementService');
    },
    get aiService() {
      return dependency('aiService');
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
    get featureDiscoveryService() {
      return dependency('featureDiscoveryService');
    },
    get featureDiscoveryStateService() {
      return dependency('featureDiscoveryStateService');
    },
    get inquiryService() {
      return dependency('inquiryService');
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
    get pushPromptService() {
      return dependency('pushPromptService');
    },
    get marketingPushPromptService() {
      return dependency('marketingPushPromptService');
    },
    get todoNudgeService() {
      return dependency('todoNudgeService');
    },
    get coachmarkService() {
      return dependency('coachmarkService');
    },
    get friendStripHintService() {
      return dependency('friendStripHintService');
    },
    get storeReviewService() {
      return dependency('storeReviewService');
    },
    get userService() {
      return dependency('userService');
    },
    get revenueCatSdkManager() {
      return dependency('revenueCatSdkManager');
    },
    get subscriptionService() {
      return dependency('subscriptionService');
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
  };
}
