import type { DIContainer } from '@src/bootstrap/providers/di-context';
import type { HttpClient } from '@src/core/ports/http';
import { EntitlementService } from '@src/features/billing/subscription/apis/entitlement.service';
import { createCoachmarkRepository } from '@src/features/device/coachmark/apis/coachmark.repository';
import { CoachmarkService } from '@src/features/device/coachmark/apis/coachmark.service';
import { ConsentService } from '@src/features/identity/consent/apis/consent.service';
import { UserService } from '@src/features/identity/user/apis/user.service';
import {
  createErrorReporterStub,
  createMemorySyncStorage,
  createAnalyticsStub,
} from '@src/shared/__tests__';
import { createLoggerStub } from '@src/shared/__tests__/create-logger-stub';

import { MemoService } from '../apis/memo.service';

export function createMemoTestDi(httpClient: HttpClient): Partial<DIContainer> {
  const logger = createLoggerStub();

  return {
    memoService: new MemoService(httpClient, logger),
    userService: new UserService(httpClient),
    entitlementService: new EntitlementService(httpClient, logger),
    consentService: new ConsentService(httpClient),
    coachmarkService: new CoachmarkService(createCoachmarkRepository(createMemorySyncStorage())),
    analytics: createAnalyticsStub(),
    errorReporter: createErrorReporterStub(),
    logger,
  };
}
