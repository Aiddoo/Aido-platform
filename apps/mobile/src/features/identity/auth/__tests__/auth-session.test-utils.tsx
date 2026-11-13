import { AuthBootProvider } from '@src/bootstrap/providers/auth-boot-provider';
import { createQueryCacheStorage } from '@src/bootstrap/query/query-cache-persistence';
import { ok } from '@src/core/errors/result';
import type { AuthTokenPair, TokenStore } from '@src/core/ports/token-store';
import { createSessionEpoch } from '@src/core/session/session-epoch';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import {
  createErrorReporterStub,
  createHttpClientStub,
  createMemoryDeviceIdStore,
  createMemoryObservableSyncStorage,
  createMemoryKeyValueStorage,
  createMemorySyncStorage,
  createMemoryTokenStore,
  createSocialAuthGatewayStub,
  createTestDi,
  createTestQueryClient,
  respondByPath,
} from '@src/testing/core';
import type { TestPortOverrides } from '@src/testing/di';
import { createTestProviders } from '@src/testing/render';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { useAuthStatus } from '../hooks/use-auth-status';
import { createPendingRevocationRepository } from '../repositories/pending-revocation.repository';

export const ACCOUNT_A_TOKENS: AuthTokenPair = {
  accessToken: 'access-a',
  refreshToken: 'refresh-a',
};

/** 부팅이 읽는 내 정보 path. 다른 계정으로 바꾸려면 이 path만 다시 정한다 */
export const ME_PATH = 'v1/auth/me';

interface AuthSessionOptions {
  tokens?: AuthTokenPair;
  tokenStore?: TokenStore;
  /** 포트(`authHttpClient` 등)를 넣어 그 포트를 쓰는 Service를 다시 조립한다 */
  ports?: TestPortOverrides;
}

/** 네트워크 경계만 stub이고 AuthBootProvider와 운영과 같은 조립(`createAppContainer`)의 Service는 실제 코드다 */
export function createAuthSession({ tokens, tokenStore, ports }: AuthSessionOptions = {}) {
  const store = tokenStore ?? createMemoryTokenStore(tokens);
  const sessionEpoch = ports?.sessionEpoch ?? createSessionEpoch();
  const publicHttp = createHttpClientStub();
  const authHttp = createHttpClientStub();
  // 조회는 path로 정해 테스트가 다른 인증 API 응답을 정해도 내 정보 조회를 덮어쓰지 않는다
  authHttp.get.mockImplementation(respondByPath({ [ME_PATH]: ok(createCurrentUserDto()) }));
  const socialAuthGateway = createSocialAuthGatewayStub();
  const queryClient = createTestQueryClient();
  const errorReporter = createErrorReporterStub();
  const storage = createMemoryKeyValueStorage();
  const syncStorage = createMemoryObservableSyncStorage();
  const queryCacheStorage = createQueryCacheStorage(createMemorySyncStorage());
  const requestRefresh = jest.fn<Promise<Response>, [string]>();

  const container = createTestDi({
    ports: {
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
      deviceIdStore: createMemoryDeviceIdStore('device-1'),
      ...ports,
    },
  });
  const { TestProviders } = createTestProviders({ di: container, withLocalDate: true });

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <TestProviders>
        <AuthBootProvider>{children}</AuthBootProvider>
      </TestProviders>
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
    queryClient,
    syncStorage,
    draftService: container.draftService,
    queryCacheStorage,
    errorReporter,
    pendingRevocation: createPendingRevocationRepository(storage),
    requestRefresh,
    container,
    Wrapper,
    renderSession,
  };
}
