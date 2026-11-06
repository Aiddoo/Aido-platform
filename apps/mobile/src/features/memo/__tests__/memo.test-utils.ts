import type { DIContainer } from '@src/bootstrap/providers/di-context';
import type { HttpClient } from '@src/core/ports/http';
import { AuthService } from '@src/features/auth/apis/auth.service';
import { createCoachmarkRepository } from '@src/features/feature-discovery/apis/coachmark.repository';
import { CoachmarkService } from '@src/features/feature-discovery/apis/coachmark.service';
import { EntitlementService } from '@src/features/subscription/apis/entitlement.service';
import { UserService } from '@src/features/user/apis/user.service';
import {
  createErrorReporterStub,
  createMemorySyncStorage,
  createMockAnalytics,
  createMockTokenStore,
} from '@src/shared/__tests__';

import { MemoService } from '../apis/memo.service';

export function createMemoTestDi(httpClient: HttpClient): Partial<DIContainer> {
  const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

  return {
    memoService: new MemoService(httpClient),
    userService: new UserService(httpClient),
    entitlementService: new EntitlementService(httpClient, logger),
    authService: new AuthService(httpClient, httpClient, createMockTokenStore()),
    coachmarkService: new CoachmarkService(createCoachmarkRepository(createMemorySyncStorage())),
    analytics: createMockAnalytics(),
    errorReporter: createErrorReporterStub(),
    logger,
  };
}
