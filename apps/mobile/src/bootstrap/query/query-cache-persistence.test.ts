import { createParentTodo } from '@src/features/planning/todo/__tests__/sub-todo.fixtures';
import type { DailyCompletionsResult } from '@src/features/planning/todo/domains/daily-completion.model';
import type { TodoListResult } from '@src/features/planning/todo/domains/todo.model';
import { syncDailyCompletionWithList } from '@src/features/planning/todo/queries/todo-cache';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/queries/todo-query-keys';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { createMemorySyncStorage, createTestQueryClient } from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import type { QueryClient } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client';
import { z } from 'zod';

import { PERSISTED_QUERY_SCHEMAS } from './persisted-query-schemas';
import {
  createQueryCacheBuster,
  createQueryCacheStorage,
  createQueryPersistOptions,
  QUERY_CACHE_STORAGE_KEY,
  removePlaintextQueryCache,
  shouldPersistQuery,
} from './query-cache-persistence';

const createClient = () => createTestQueryClient();

const TEST_SCHEMAS = [{ queryKey: ['opted'], schema: z.unknown() }];

const queryOf = (client: QueryClient, queryKey: readonly unknown[]) => {
  const query = client.getQueryCache().find({ queryKey, exact: true });
  if (query == null) {
    throw new Error('query not found');
  }
  return query;
};

describe('createQueryCacheStorage', () => {
  it('주인이 정해지기 전에는 캐시를 쓰지도 읽지도 않는다', () => {
    // Given
    const storage = createQueryCacheStorage(createMemorySyncStorage());

    // When
    storage.setItem(QUERY_CACHE_STORAGE_KEY, '캐시');

    // Then
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
  });

  it('주인이 바뀌면 이전 사용자의 캐시를 지워 새 사용자에게 복원하지 않는다', () => {
    // Given
    const backing = createMemorySyncStorage();
    const storage = createQueryCacheStorage(backing);
    storage.setOwner('user-1');
    storage.setItem(QUERY_CACHE_STORAGE_KEY, 'user-1 캐시');

    // When
    storage.setOwner('user-2');

    // Then
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
    storage.setOwner('user-1');
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
  });

  it('같은 주인을 다시 정하면 저장한 캐시를 그대로 둔다', () => {
    // Given
    const storage = createQueryCacheStorage(createMemorySyncStorage());
    storage.setOwner('user-1');
    storage.setItem(QUERY_CACHE_STORAGE_KEY, '내 캐시');

    // When
    storage.setOwner('user-1');

    // Then
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBe('내 캐시');
  });

  it('비우면 캐시와 주인을 함께 지워 늦게 도착한 저장도 버린다', () => {
    // Given
    const storage = createQueryCacheStorage(createMemorySyncStorage());
    storage.setOwner('user-1');
    storage.setItem(QUERY_CACHE_STORAGE_KEY, '내 캐시');

    // When
    storage.clear();
    storage.setItem(QUERY_CACHE_STORAGE_KEY, '로그아웃 뒤 저장');

    // Then
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
  });
});

describe('removePlaintextQueryCache', () => {
  it('평문 저장소에 남은 사용자별 캐시와 주인만 지우고 다른 설정은 남긴다', () => {
    // Given
    const plaintext = createMemorySyncStorage();
    plaintext.set(`${QUERY_CACHE_STORAGE_KEY}:user-1`, '평문 캐시');
    plaintext.set(`${QUERY_CACHE_STORAGE_KEY}:user-2`, '다른 사용자 평문 캐시');
    plaintext.set('aido.query-cache.owner', 'user-1');
    plaintext.set('aido_activation_v1:user-1:campaign', '{}');

    // When
    removePlaintextQueryCache(plaintext);

    // Then
    expect(plaintext.keys()).toEqual(['aido_activation_v1:user-1:campaign']);
  });
});

describe('shouldPersistQuery', () => {
  it('opt-in한 성공 조회만 저장한다', () => {
    // Given
    const client = createClient();
    client.getQueryCache().build(client, { queryKey: ['opted'], ...PERSISTED_QUERY_OPTIONS });
    client.setQueryData(['opted'], { value: 1 });
    client.setQueryData(['plain'], { value: 1 });

    // When · Then
    expect(shouldPersistQuery(queryOf(client, ['opted']))).toBe(true);
    expect(shouldPersistQuery(queryOf(client, ['plain']))).toBe(false);
  });

  it('opt-in했어도 실패했거나 아직 받는 중인 조회는 저장하지 않는다', async () => {
    // Given
    const client = createClient();
    await client
      .query({
        queryKey: ['failed'],
        queryFn: () => Promise.reject(new Error('boom')),
        ...PERSISTED_QUERY_OPTIONS,
      })
      .catch(() => undefined);
    client.getQueryCache().build(client, { queryKey: ['pending'], ...PERSISTED_QUERY_OPTIONS });

    // When · Then
    expect(shouldPersistQuery(queryOf(client, ['failed']))).toBe(false);
    expect(shouldPersistQuery(queryOf(client, ['pending']))).toBe(false);
  });
});

describe('createQueryPersistOptions', () => {
  setupFakeTimersPerTest();

  const saveAndRestore = async (savedBuster: string, restoringBuster: string) => {
    const storage = createQueryCacheStorage(createMemorySyncStorage());
    storage.setOwner('user-1');
    const source = createClient();
    source.getQueryCache().build(source, { queryKey: ['opted'], ...PERSISTED_QUERY_OPTIONS });
    source.setQueryData(['opted'], { savedAt: '2026-11-02T00:00:00.000Z' });
    await persistQueryClientSave({
      queryClient: source,
      ...createQueryPersistOptions({ storage, buster: savedBuster, schemas: TEST_SCHEMAS }),
    });
    await jest.runAllTimersAsync();

    const target = createClient();
    await persistQueryClientRestore({
      queryClient: target,
      ...createQueryPersistOptions({ storage, buster: restoringBuster, schemas: TEST_SCHEMAS }),
    });
    return target.getQueryData(['opted']);
  };

  it('같은 앱 버전이면 저장한 조회를 Instant 문자열 그대로 복원한다', async () => {
    // Given · When
    const buster = createQueryCacheBuster({ appVersion: '1.14.0', language: 'ko' });
    const restored = await saveAndRestore(buster, buster);

    // Then
    expect(restored).toEqual({ savedAt: '2026-11-02T00:00:00.000Z' });
  });

  it('옛 캐시 스키마 버전(5)이 옛 쿼리 키로 저장한 캐시는 복원하지 않고 다시 조회하게 둔다', async () => {
    // Given
    const legacyBuster = '5:1.14.0:ko';
    const currentBuster = createQueryCacheBuster({ appVersion: '1.14.0', language: 'ko' });

    // When
    const restored = await saveAndRestore(legacyBuster, currentBuster);

    // Then
    expect(currentBuster.startsWith('6:')).toBe(true);
    expect(restored).toBeUndefined();
  });

  it('실제 저장·복원을 거친 달력 요약과 목록에도 체크 결과를 날짜 순서대로 반영한다', async () => {
    // Given
    const date = createDateKey('2026-11-05');
    const listKey = TODO_QUERY_KEYS.listByDate({ date });
    const rangeKey = TODO_QUERY_KEYS.completionsByRange({
      startDate: '2026-11-01',
      endDate: '2026-11-07',
    });
    const storage = createQueryCacheStorage(createMemorySyncStorage());
    storage.setOwner('user-1');
    const options = createQueryPersistOptions({
      storage,
      buster: '3:1.15.0:ko',
      schemas: PERSISTED_QUERY_SCHEMAS,
    });
    const source = createClient();
    source.getQueryCache().build(source, { queryKey: listKey, ...PERSISTED_QUERY_OPTIONS });
    source.getQueryCache().build(source, { queryKey: rangeKey, ...PERSISTED_QUERY_OPTIONS });
    source.setQueryData<TodoListResult>(listKey, {
      todos: [createParentTodo({ startDate: date, completed: true })],
      hasNext: false,
      nextCursor: null,
    });
    source.setQueryData<DailyCompletionsResult>(rangeKey, {
      completions: [
        {
          date: createDateKey('2026-11-07'),
          totalTodos: 1,
          completedTodos: 0,
          isComplete: false,
          completionRate: 0,
          categoryColors: ['#FF0000'],
        },
      ],
      totalCompleteDays: 0,
      dateRange: { startDate: createDateKey('2026-11-01'), endDate: createDateKey('2026-11-07') },
    });
    await persistQueryClientSave({ queryClient: source, ...options });
    await jest.runAllTimersAsync();
    const restored = createClient();
    await persistQueryClientRestore({ queryClient: restored, ...options });

    // When
    syncDailyCompletionWithList(restored, { date });

    // Then
    const synced = restored.getQueryData<DailyCompletionsResult>(rangeKey);
    expect(synced?.completions.map((completion) => completion.date)).toEqual([date, '2026-11-07']);
    expect(synced?.totalCompleteDays).toBe(1);
  });

  it('앱 버전이 바뀌면 이전 캐시를 복원하지 않는다', async () => {
    // Given · When
    const restored = await saveAndRestore(
      createQueryCacheBuster({ appVersion: '1.14.0', language: 'ko' }),
      createQueryCacheBuster({ appVersion: '1.15.0', language: 'ko' }),
    );

    // Then
    expect(restored).toBeUndefined();
  });

  it('표시 언어가 바뀌면 이전 언어로 받은 캐시를 복원하지 않는다', async () => {
    // Given · When
    const restored = await saveAndRestore(
      createQueryCacheBuster({ appVersion: '1.14.0', language: 'ko' }),
      createQueryCacheBuster({ appVersion: '1.14.0', language: 'en' }),
    );

    // Then
    expect(restored).toBeUndefined();
  });
});
