import { AuthProvider, useAuth } from '@src/bootstrap/providers/auth-provider';
import { type DIContainer, StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { GestureHandlerProvider } from '@src/bootstrap/providers/gesture-handler-provider';
import { HeroUIProvider } from '@src/bootstrap/providers/hero-ui-provider';
import {
  createQueryCacheStorage,
  type QueryCacheStorage,
} from '@src/bootstrap/providers/query-cache-persistence';
import type { AuthTokenPair, TokenStore } from '@src/core/ports/token-store';
import { WidgetSyncService } from '@src/features/device/widget/apis/widget-sync.service';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.factories';
import { UserService } from '@src/features/identity/user/apis/user.service';
import { createPushNotificationGatewayStub } from '@src/features/notification/__tests__/notification.factories';
import { createDeviceTimezoneRepository } from '@src/features/notification/apis/device-timezone.repository';
import { DeviceTimezoneService } from '@src/features/notification/apis/device-timezone.service';
import { PushDeviceService } from '@src/features/notification/apis/push-device.service';
import { TodoService } from '@src/features/planning/todo/apis/todo.service';
import { createPendingRedemptionRepository } from '@src/features/social/invite/apis/pending-redemption.repository';
import {
  createErrorReporterStub,
  createMemoryStorage,
  createMemorySyncStorage,
  createMemoryTokenStore,
  createAnalyticsStub,
  createTestDiContainer,
  createHttpClientStub,
  createVoiceNoteStorageServiceFake,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { createDraftRepository } from '@src/shared/draft/draft.repository';
import { DraftService } from '@src/shared/draft/draft.service';
import { ok } from '@src/shared/errors/result';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { AuthService } from '../apis/auth.service';
import { createPendingRevocationRepository } from '../apis/pending-revocation.repository';
import { SessionCleanupService } from '../apis/session-cleanup.service';
import { createSessionQueryCache } from '../apis/session-query-cache';
import { SessionRevocationService } from '../apis/session-revocation.service';

export const ACCOUNT_A_TOKENS: AuthTokenPair = {
  accessToken: 'access-a',
  refreshToken: 'refresh-a',
};

const silentLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

interface AuthSessionOptions {
  tokens?: AuthTokenPair;
  tokenStore?: TokenStore;
  di?: Partial<DIContainer>;
}

/**
 * 로그인·로그아웃·탈퇴가 사용자 결과(토큰, 상태, 초안)로 이어지는지 보는 조립.
 * 네트워크 경계만 stub이고 AuthProvider, AuthService, PushDeviceService는 실제 코드다.
 */
export function createAuthSession({ tokens, tokenStore, di }: AuthSessionOptions = {}) {
  const store = tokenStore ?? createMemoryTokenStore(tokens);
  const publicHttp = createHttpClientStub();
  const authHttp = createHttpClientStub();
  const userHttp = createHttpClientStub();
  userHttp.get.mockResolvedValue(ok(createCurrentUserDto()));
  const queryClient = createTestQueryClient();
  const draftService = new DraftService(createDraftRepository(createMemorySyncStorage()));
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
    logger: silentLogger,
  });
  const sessionCleanupService = new SessionCleanupService({
    queryCache: createSessionQueryCache(queryClient),
    persistedQueryCache: queryCacheStorage,
    drafts: draftService,
    voiceNotes: createVoiceNoteStorageServiceFake(),
    deviceTimezone: new DeviceTimezoneService(
      createDeviceTimezoneRepository(createMemorySyncStorage()),
    ),
    pendingRedemption,
    logger: silentLogger,
  });

  const container = createTestDiContainer({
    tokenStore: store,
    logger: silentLogger,
    errorReporter,
    analytics: createAnalyticsStub(),
    authService: new AuthService(publicHttp, authHttp, store),
    pushDeviceService: new PushDeviceService(
      createPushNotificationGatewayStub(),
      { get: async () => 'device-1' },
      authHttp,
      silentLogger,
      () => 'Asia/Seoul',
    ),
    userService: new UserService(userHttp),
    todoService: new TodoService(createHttpClientStub()),
    widgetSyncService: new WidgetSyncService({ writeSnapshot }, errorReporter),
    draftService,
    queryCacheStorage,
    sessionCleanupService,
    sessionRevocationService,
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
                <AuthProvider>{children}</AuthProvider>
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
        latestStatus = useAuth().status;
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
