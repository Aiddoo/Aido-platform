import { AuthBootProvider } from '@src/bootstrap/providers/auth-boot-provider';
import { type DIContainer, StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { GestureHandlerProvider } from '@src/bootstrap/providers/gesture-handler-provider';
import { HeroUIProvider } from '@src/bootstrap/providers/hero-ui-provider';
import { createQueryCacheStorage } from '@src/bootstrap/query/query-cache-persistence';
import { ok } from '@src/core/errors/result';
import type { AuthTokenPair, TokenStore } from '@src/core/ports/token-store';
import { createSessionEpoch } from '@src/core/session/session-epoch';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { UserService } from '@src/features/identity/user/apis/user.service';
import { TodoService } from '@src/features/planning/todo/apis/todo.service';
import {
  createErrorReporterStub,
  createHttpClientStub,
  createMemoryDeviceIdStore,
  createMemoryObservableSyncStorage,
  createMemoryStorage,
  createMemorySyncStorage,
  createMemoryTokenStore,
  createSocialAuthGatewayStub,
  createTestDi,
  createTestQueryClient,
} from '@src/shared/__tests__';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { createPendingRevocationRepository } from '../apis/pending-revocation.repository';
import { useAuthStatus } from '../hooks/use-auth-status';

export const ACCOUNT_A_TOKENS: AuthTokenPair = {
  accessToken: 'access-a',
  refreshToken: 'refresh-a',
};

interface AuthSessionOptions {
  tokens?: AuthTokenPair;
  tokenStore?: TokenStore;
  di?: Partial<DIContainer>;
}

/** 네트워크 경계만 stub이고 AuthBootProvider와 운영과 같은 조립(`createAppContainer`)의 Service는 실제 코드다 */
export function createAuthSession({ tokens, tokenStore, di }: AuthSessionOptions = {}) {
  const store = tokenStore ?? createMemoryTokenStore(tokens);
  const sessionEpoch = di?.sessionEpoch ?? createSessionEpoch();
  const publicHttp = createHttpClientStub();
  const authHttp = createHttpClientStub();
  const socialAuthGateway = createSocialAuthGatewayStub();
  // 내 정보 조회만 따로 정해 두어 테스트가 인증 API 응답을 정할 때 덮어쓰지 않게 한다
  const userHttp = createHttpClientStub();
  userHttp.get.mockResolvedValue(ok(createCurrentUserDto()));
  const queryClient = createTestQueryClient();
  const errorReporter = createErrorReporterStub();
  const writeSnapshot = jest.fn(async () => undefined);
  const storage = createMemoryStorage();
  const syncStorage = createMemoryObservableSyncStorage();
  const queryCacheStorage = createQueryCacheStorage(createMemorySyncStorage());
  const requestRefresh = jest.fn<Promise<Response>, [string]>();

  const container = createTestDi({
    tokenStore: store,
    sessionEpoch,
    publicHttpClient: publicHttp,
    authHttpClient: authHttp,
    socialAuth: socialAuthGateway,
    requestRefresh,
    storage,
    syncStorage,
    queryClient,
    queryCacheStorage,
    errorReporter,
    widgetBridge: { writeSnapshot },
    deviceIdStore: createMemoryDeviceIdStore('device-1'),
    userService: new UserService(userHttp),
    todoService: new TodoService(createHttpClientStub()),
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
    syncStorage,
    draftService: container.draftService,
    queryCacheStorage,
    errorReporter,
    writeSnapshot,
    pendingRevocation: createPendingRevocationRepository(storage),
    requestRefresh,
    container,
    Wrapper,
    renderSession,
  };
}
