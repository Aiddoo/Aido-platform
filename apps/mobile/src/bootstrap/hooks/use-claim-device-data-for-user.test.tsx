import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import {
  createQueryCacheStorage,
  QUERY_CACHE_STORAGE_KEY,
  type QueryCacheStorage,
} from '@src/bootstrap/query/query-cache-persistence';
import { ok } from '@src/core/errors/result';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { UserApi } from '@src/features/identity/user/apis/user.api';
import { createDraftKey } from '@src/shared/draft/draft.model';
import { createDraftRepository } from '@src/shared/draft/draft.repository';
import { DraftService } from '@src/shared/draft/draft.service';
import {
  createAnalyticsStub,
  createErrorReporterStub,
  createHttpClientStub,
  createMemorySyncStorage,
  createTestDi,
  createTestQueryClient,
} from '@src/testing/core';
import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { z } from 'zod';

import { useClaimDeviceDataForUser } from './use-claim-device-data-for-user';

const CURRENT_USER_ID = createCurrentUserDto().userId;

const createMemoDraftKey = (ownerId: string) =>
  createDraftKey({
    ownerId,
    scope: 'memo',
    target: ['create'],
    schema: z.object({ content: z.string() }),
  });

describe('useClaimDeviceDataForUser', () => {
  let draftService: DraftService;
  let queryCacheStorage: QueryCacheStorage;
  let queryClient: QueryClient;
  let wrapper: (props: PropsWithChildren) => React.JSX.Element;

  beforeEach(() => {
    draftService = new DraftService(createDraftRepository(createMemorySyncStorage()), Date.now);
    queryCacheStorage = createQueryCacheStorage(createMemorySyncStorage());
    queryClient = createTestQueryClient();
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(createCurrentUserDto()));
    const container = createTestDi({
      authSessionStore: createAuthSessionStoreStub('authenticated'),
      draftService,
      queryCacheStorage,
      analytics: createAnalyticsStub(),
      errorReporter: createErrorReporterStub(),
      userApi: new UserApi(httpClient),
    });
    wrapper = ({ children }) => (
      <StaticDIProvider container={container}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StaticDIProvider>
    );
  });

  it('로그인한 사용자의 초안은 남기고 이전 사용자의 초안은 삭제한다', async () => {
    // Given — 세션 만료로 남은 초안
    draftService.save(createMemoDraftKey(CURRENT_USER_ID), { content: '내 초안' });
    draftService.save(createMemoDraftKey('user-2'), { content: '이전 사용자 초안' });

    // When
    await renderHook(useClaimDeviceDataForUser, { wrapper });

    // Then
    await waitFor(() =>
      expect(draftService.restore(createMemoDraftKey('user-2'))).toEqual({ status: 'empty' }),
    );
    expect(draftService.restore(createMemoDraftKey(CURRENT_USER_ID))).toEqual({
      status: 'restored',
      value: { content: '내 초안' },
    });
  });

  it('로그인한 사용자를 오프라인 캐시 주인으로 정하고 이전 사용자의 캐시는 지운다', async () => {
    // Given — 이전 사용자가 남긴 캐시
    queryCacheStorage.setOwner('user-2');
    queryCacheStorage.setItem(QUERY_CACHE_STORAGE_KEY, '이전 사용자 캐시');

    // When
    await renderHook(useClaimDeviceDataForUser, { wrapper });

    // Then
    await waitFor(() => expect(queryCacheStorage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull());
    queryCacheStorage.setItem(QUERY_CACHE_STORAGE_KEY, '내 캐시');
    expect(queryCacheStorage.getItem(QUERY_CACHE_STORAGE_KEY)).toBe('내 캐시');
  });
});
