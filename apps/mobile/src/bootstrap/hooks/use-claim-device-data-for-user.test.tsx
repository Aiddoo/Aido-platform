import {
  createQueryCacheStorage,
  QUERY_CACHE_STORAGE_KEY,
  type QueryCacheStorage,
} from '@src/bootstrap/query/query-cache-persistence';
import { ok } from '@src/core/errors/result';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import {
  createCurrentUserDto,
  createUser,
} from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { createDraftKey } from '@src/shared/draft/draft.model';
import {
  createHttpClientStub,
  createMemorySyncStorage,
  createPendingResponse,
  createTestDi,
  createTestQueryClient,
  type TestDi,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { waitFor } from '@testing-library/react-native';
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
  let di: TestDi;
  let queryCacheStorage: QueryCacheStorage;

  beforeEach(() => {
    queryCacheStorage = createQueryCacheStorage(createMemorySyncStorage());
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(createCurrentUserDto()));
    di = createTestDi({
      ports: { httpClient, queryCacheStorage },
      seeds: { authSessionStore: createAuthSessionStoreStub('authenticated') },
    });
  });

  it('로그인한 사용자의 초안은 남기고 이전 사용자의 초안은 삭제한다', async () => {
    // Given — 세션 만료로 남은 초안
    di.draftService.save(createMemoDraftKey(CURRENT_USER_ID), { content: '내 초안' });
    di.draftService.save(createMemoDraftKey('user-2'), { content: '이전 사용자 초안' });

    // When
    await renderScreenHook(useClaimDeviceDataForUser, { di });

    // Then
    await waitFor(() =>
      expect(di.draftService.restore(createMemoDraftKey('user-2'))).toEqual({ status: 'empty' }),
    );
    expect(di.draftService.restore(createMemoDraftKey(CURRENT_USER_ID))).toEqual({
      status: 'restored',
      value: { content: '내 초안' },
    });
  });

  it('로그인한 사용자를 오프라인 캐시 주인으로 정하고 이전 사용자의 캐시는 지운다', async () => {
    // Given — 이전 사용자가 남긴 캐시
    queryCacheStorage.setOwner('user-2');
    queryCacheStorage.setItem(QUERY_CACHE_STORAGE_KEY, '이전 사용자 캐시');

    // When
    await renderScreenHook(useClaimDeviceDataForUser, { di });

    // Then
    await waitFor(() => expect(queryCacheStorage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull());
    queryCacheStorage.setItem(QUERY_CACHE_STORAGE_KEY, '내 캐시');
    expect(queryCacheStorage.getItem(QUERY_CACHE_STORAGE_KEY)).toBe('내 캐시');
  });

  it('복원한 캐시의 내 정보(지난 실행의 다른 계정)로는 주인을 정하지 않고 이번에 받은 내 정보를 기다린다', async () => {
    // Given
    // 저장소를 열지 못한 실행에서 user-2가 로그아웃하고 지금 계정이 로그인해, user-2의 내 정보 캐시가 복원됐다
    const meResponse = createPendingResponse(ok(createCurrentUserDto()));
    const httpClient = createHttpClientStub();
    httpClient.get.mockReturnValue(meResponse.response);
    const restoredClient = createTestQueryClient();
    restoredClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'user-2' }), {
      updatedAt: Date.now() - 60_000,
    });
    const restored = createTestDi({
      ports: { httpClient, queryClient: restoredClient },
      seeds: { authSessionStore: createAuthSessionStoreStub('authenticated') },
    });
    restored.draftService.save(createMemoDraftKey(CURRENT_USER_ID), { content: '내 초안' });

    // When
    await renderScreenHook(useClaimDeviceDataForUser, { di: restored });

    // Then
    expect(restored.draftService.restore(createMemoDraftKey(CURRENT_USER_ID))).toEqual({
      status: 'restored',
      value: { content: '내 초안' },
    });

    // When
    restored.draftService.save(createMemoDraftKey('user-2'), { content: '이전 사용자 초안' });
    meResponse.settle();

    // Then
    await waitFor(() =>
      expect(restored.draftService.restore(createMemoDraftKey('user-2'))).toEqual({
        status: 'empty',
      }),
    );
    expect(restored.draftService.restore(createMemoDraftKey(CURRENT_USER_ID)).status).toBe(
      'restored',
    );
  });
});
