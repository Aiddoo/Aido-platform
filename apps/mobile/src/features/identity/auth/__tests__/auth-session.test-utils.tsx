import { AuthBootProvider } from '@src/bootstrap/providers/auth-boot-provider';
import { type DIContainer, StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { GestureHandlerProvider } from '@src/bootstrap/providers/gesture-handler-provider';
import { HeroUIProvider } from '@src/bootstrap/providers/hero-ui-provider';
import {
  createQueryCacheStorage,
  type QueryCacheStorage,
} from '@src/bootstrap/query/query-cache-persistence';
import { ok } from '@src/core/errors/result';
import type { AuthTokenPair, TokenStore } from '@src/core/ports/token-store';
import { createSessionEpoch } from '@src/core/session/session-epoch';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { UserService } from '@src/features/identity/user/apis/user.service';
import { createDeviceTimezoneRepository } from '@src/features/notification/apis/device-timezone.repository';
import { DeviceTimezoneService } from '@src/features/notification/apis/device-timezone.service';
import { PushDeviceService } from '@src/features/notification/apis/push-device.service';
import { createPushRegistrationRepository } from '@src/features/notification/apis/push-registration.repository';
import { TodoService } from '@src/features/planning/todo/apis/todo.service';
import { createPendingRedemptionRepository } from '@src/features/social/invite/apis/pending-redemption.repository';
import {
  createAnalyticsStub,
  createErrorReporterStub,
  createHttpClientStub,
  createLoggerStub,
  createMemoryStorage,
  createMemorySyncStorage,
  createMemoryTokenStore,
  createPushNotificationGatewayStub,
  createSocialAuthGatewayStub,
  createTestDi,
  createVoiceNoteStorageFake,
  createTestQueryClient,
} from '@src/shared/__tests__';
import { createDraftRepository } from '@src/shared/draft/draft.repository';
import { DraftService } from '@src/shared/draft/draft.service';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { noop } from 'es-toolkit';
import type { PropsWithChildren } from 'react';

import { AuthService } from '../apis/auth.service';
import { LogOutDeviceService } from '../apis/log-out-device.service';
import { createPendingRevocationRepository } from '../apis/pending-revocation.repository';
import { SessionCleanupService } from '../apis/session-cleanup.service';
import { createSessionQueryCache } from '../apis/session-query-cache';
import { SessionRevocationService } from '../apis/session-revocation.service';
import { useAuthStatus } from '../hooks/use-auth-status';

export const ACCOUNT_A_TOKENS: AuthTokenPair = {
  accessToken: 'access-a',
  refreshToken: 'refresh-a',
};

interface AuthSessionOptions {
  tokens?: AuthTokenPair;
  tokenStore?: TokenStore;
  di?: Partial<DIContainer>;
  clearUserDeviceData?: (userId: string) => void;
}

/** 네트워크 경계만 stub이고 AuthBootProvider, AuthService, PushDeviceService는 실제 코드다 */
export function createAuthSession({
  tokens,
  tokenStore,
  di,
  clearUserDeviceData = noop,
}: AuthSessionOptions = {}) {
  const store = tokenStore ?? createMemoryTokenStore(tokens);
  const sessionEpoch = di?.sessionEpoch ?? createSessionEpoch();
  const publicHttp = createHttpClientStub();
  const authHttp = createHttpClientStub();
  const socialAuthGateway = createSocialAuthGatewayStub();
  const userHttp = createHttpClientStub();
  userHttp.get.mockResolvedValue(ok(createCurrentUserDto()));
  const queryClient = createTestQueryClient();
  const draftService = new DraftService(createDraftRepository(createMemorySyncStorage()), Date.now);
  const queryCacheStorage: QueryCacheStorage = createQueryCacheStorage(createMemorySyncStorage());
  const errorReporter = createErrorReporterStub();
  const writeSnapshot = jest.fn(async () => undefined);
  const pendingRedemption = createPendingRedemptionRepository(createMemorySyncStorage());
  const pendingRevocation = createPendingRevocationRepository(createMemoryStorage());
  const requestRefresh = jest.fn<Promise<Response>, [string]>();
  const sessionRevocationService = new SessionRevocationService({
    repository: pendingRevocation,
    requestRefresh,
    publicHttpClient: publicHttp,
    logger: createLoggerStub(),
    now: Date.now,
  });
  const pushDeviceService = new PushDeviceService({
    gateway: createPushNotificationGatewayStub(),
    deviceIdService: { get: async () => 'device-1' },
    httpClient: authHttp,
    publicHttpClient: publicHttp,
    registrationRepository: createPushRegistrationRepository(createMemoryStorage()),
    logger: createLoggerStub(),
    getTimeZone: () => 'Asia/Seoul',
    getLanguage: () => 'ko',
    sessionEpoch,
  });
  const sessionCleanupService = new SessionCleanupService({
    userDeviceData: { clearForUser: clearUserDeviceData },
    queryCache: createSessionQueryCache(queryClient),
    persistedQueryCache: queryCacheStorage,
    drafts: draftService,
    voiceNotes: createVoiceNoteStorageFake().service,
    deviceTimezone: new DeviceTimezoneService(
      createDeviceTimezoneRepository(createMemorySyncStorage()),
    ),
    pendingRedemption,
    pushDevice: pushDeviceService,
    logger: createLoggerStub(),
  });

  const authService = new AuthService({
    publicHttpClient: publicHttp,
    authHttpClient: authHttp,
    tokenStore: store,
    socialAuthGateway,
    deviceType: 'IOS',
    logger: createLoggerStub(),
  });

  const container = createTestDi({
    tokenStore: store,
    logger: createLoggerStub(),
    errorReporter,
    analytics: createAnalyticsStub(),
    authService,
    pushDeviceService,
    logOutDeviceService: new LogOutDeviceService({
      authService,
      pushDeviceService,
      tokenStore: store,
      sessionRevocationService,
      sessionEpoch,
      logger: createLoggerStub(),
    }),
    userService: new UserService(userHttp),
    todoService: new TodoService(createHttpClientStub()),
    widgetBridge: { writeSnapshot },
    draftService,
    queryCacheStorage,
    sessionCleanupService,
    sessionRevocationService,
    sessionEpoch,
    ...di,
  });

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <GestureHandlerProvider>
        <StaticDIProvider container={container}>
          <QueryClientProvider client={queryClient}>
            <HeroUIProvider
              config={{ animation: 'disable-all', devInfo: { stylingPrinciples: false } }}
            >
              <LocalDateProvider>
                <AuthBootProvider>{children}</AuthBootProvider>
              </LocalDateProvider>
            </HeroUIProvider>
          </QueryClientProvider>
        </StaticDIProvider>
      </GestureHandlerProvider>
    );
  }

  /** 부팅 판정이 `status`로 끝난 뒤의 훅을 돌려준다 */
  async function renderSession<TResult>(
    useValue: () => TResult,
    status: 'authenticated' | 'unauthenticated',
  ) {
    let latestStatus = '';
    const rendered = await renderHook(
      () => {
        latestStatus = useAuthStatus();
        return useValue();
      },
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(latestStatus).toBe(status));
    return rendered;
  }

  return {
    tokenStore: store,
    publicHttp,
    authHttp,
    socialAuthGateway,
    userHttp,
    queryClient,
    draftService,
    queryCacheStorage,
    errorReporter,
    writeSnapshot,
    pendingRedemption,
    pendingRevocation,
    requestRefresh,
    container,
    Wrapper,
    renderSession,
  };
}
