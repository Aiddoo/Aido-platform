import type { DIContainer } from '@src/bootstrap/providers/di-context';
import type { HttpClient } from '@src/core/ports/http';
import { EntitlementService } from '@src/features/billing/subscription/apis/entitlement.service';
import { createCoachmarkRepository } from '@src/features/device/coachmark/apis/coachmark.repository';
import { CoachmarkService } from '@src/features/device/coachmark/apis/coachmark.service';
import { AuthService } from '@src/features/identity/auth/apis/auth.service';
import { ConsentService } from '@src/features/identity/consent/apis/consent.service';
import { UserService } from '@src/features/identity/user/apis/user.service';
import { MemoService } from '@src/features/notes/memo/apis/memo.service';
import { InquiryService } from '@src/features/support/inquiry/apis/inquiry.service';

import { createAnalyticsStub } from './create-analytics-stub';
import { createErrorReporterStub } from './create-error-reporter-stub';
import { createHttpClientStub } from './create-http-client-stub';
import { createLoggerStub } from './create-logger-stub';
import { createMemorySyncStorage } from './create-memory-sync-storage';
import { createMockTokenStore } from './create-mock-token-store';

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

  return {
    memoService: new MemoService(httpClient, logger),
    inquiryService: new InquiryService(httpClient),
    userService: new UserService(httpClient),
    entitlementService: new EntitlementService(httpClient, logger),
    authService: new AuthService(httpClient, httpClient, createMockTokenStore()),
    consentService: new ConsentService(httpClient),
    coachmarkService: new CoachmarkService(createCoachmarkRepository(createMemorySyncStorage())),
    analytics: createAnalyticsStub(),
    errorReporter: createErrorReporterStub(),
    logger,
    ...overrides,
  };
}
