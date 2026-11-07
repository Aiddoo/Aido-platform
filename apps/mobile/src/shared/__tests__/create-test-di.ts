import type { DIContainer } from '@src/bootstrap/providers/di-context';
import type { HttpClient } from '@src/core/ports/http';
import { EntitlementService } from '@src/features/billing/subscription/apis/entitlement.service';
import { createActivationProgressRepository } from '@src/features/device/activation/apis/activation-progress.repository';
import { ActivationService } from '@src/features/device/activation/apis/activation.service';
import { createCoachmarkRepository } from '@src/features/device/coachmark/apis/coachmark.repository';
import { CoachmarkService } from '@src/features/device/coachmark/apis/coachmark.service';
import { createStoreReviewRepository } from '@src/features/device/store-review/apis/store-review.repository';
import { StoreReviewService } from '@src/features/device/store-review/apis/store-review.service';
import { TodoCommentService } from '@src/features/engagement/comment/apis/todo-comment.service';
import { AuthService } from '@src/features/identity/auth/apis/auth.service';
import { ConsentService } from '@src/features/identity/consent/apis/consent.service';
import { PreferenceService } from '@src/features/identity/preference/apis/preference.service';
import { UserService } from '@src/features/identity/user/apis/user.service';
import { MemoService } from '@src/features/notes/memo/apis/memo.service';
import { createPushNotificationGatewayStub } from '@src/features/notification/__tests__/notification.fixtures';
import { NotificationService } from '@src/features/notification/apis/notification.service';
import { TodoCategoryService } from '@src/features/planning/category/apis/todo-category.service';
import { SubTodoService } from '@src/features/planning/todo/apis/sub-todo.service';
import { TodoService } from '@src/features/planning/todo/apis/todo.service';
import { TodoNudgeService } from '@src/features/social/nudge/apis/todo-nudge.service';
import { InquiryService } from '@src/features/support/inquiry/apis/inquiry.service';
import { createDraftRepository } from '@src/shared/draft/draft.repository';
import { DraftService } from '@src/shared/draft/draft.service';

import { createAnalyticsStub } from './create-analytics-stub';
import { createErrorReporterStub } from './create-error-reporter-stub';
import { createHttpClientStub } from './create-http-client-stub';
import { createLoggerStub } from './create-logger-stub';
import { createMemorySyncStorage } from './create-memory-sync-storage';
import { createMockTokenStore } from './create-mock-token-store';
import { createSocialAuthGatewayStub } from './create-social-auth-gateway-stub';

type TestDiOverrides = Partial<DIContainer> & {
  /** 실제 Service들이 함께 쓰는 HTTP 포트. 응답은 테스트가 이 stub에 정한다 */
  httpClient?: HttpClient;
};

/**
 * 실제 Service를 포트 stub 위에 조립한 DI. `renderUi`의 `di`에 넘긴다.
 * 화면 테스트는 서비스를 mock하지 않고 `httpClient` 응답만 정한다.
 * 쓰는 Service가 늘면 여기에 더한다. 넣은 override는 조립한 값보다 앞선다.
 */
export function createTestDi({
  httpClient = createHttpClientStub(),
  ...overrides
}: TestDiOverrides = {}): Partial<DIContainer> {
  const logger = createLoggerStub();
  const pushNotificationGateway =
    overrides.pushNotificationGateway ?? createPushNotificationGatewayStub();

  return {
    memoService: new MemoService(httpClient, logger),
    todoCategoryService: new TodoCategoryService(httpClient),
    todoCommentService: new TodoCommentService(httpClient),
    todoNudgeService: new TodoNudgeService(httpClient),
    todoService: new TodoService(httpClient),
    subTodoService: new SubTodoService(httpClient),
    draftService: new DraftService(createDraftRepository(createMemorySyncStorage())),
    activationService: new ActivationService(
      createActivationProgressRepository(createMemorySyncStorage()),
    ),
    storeReviewService: new StoreReviewService(
      createStoreReviewRepository(createMemorySyncStorage()),
      { isAvailable: jest.fn().mockResolvedValue(false), requestReview: jest.fn() },
    ),
    inquiryService: new InquiryService(httpClient),
    userService: new UserService(httpClient),
    preferenceService: new PreferenceService(httpClient),
    entitlementService: new EntitlementService(httpClient, logger),
    authService: new AuthService(
      httpClient,
      httpClient,
      createMockTokenStore(),
      createSocialAuthGatewayStub(),
    ),
    consentService: new ConsentService(httpClient),
    coachmarkService: new CoachmarkService(createCoachmarkRepository(createMemorySyncStorage())),
    analytics: createAnalyticsStub(),
    errorReporter: createErrorReporterStub(),
    pushNotificationGateway,
    notificationService: new NotificationService(httpClient, pushNotificationGateway, httpClient),
    logger,
    ...overrides,
  };
}
