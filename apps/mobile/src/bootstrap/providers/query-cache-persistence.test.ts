import { createParentTodo } from '@src/features/planning/todo/__tests__/sub-todo.fixtures';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/constants/todo-query-keys';
import { syncDailyCompletionWithList } from '@src/features/planning/todo/queries/todo-cache';
import type {
  DailyCompletionsResult,
  TodoListResult,
} from '@src/features/planning/todo/schemas/todo.schema';
import { createMemorySyncStorage } from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import type { QueryClient } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client';

import {
  createQueryCacheBuster,
  createQueryCacheStorage,
  createQueryPersistOptions,
  deserializeQueryCache,
  QUERY_CACHE_STORAGE_KEY,
  removePlaintextQueryCache,
  serializeQueryCache,
  shouldPersistQuery,
} from './query-cache-persistence';

const createClient = () => createTestQueryClient();

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
      .fetchQuery({
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

describe('serializeQueryCache', () => {
  it('클라이언트 모델의 Date를 되살린다', () => {
    // Given
    const fetchedAt = new Date('2026-11-02T03:00:00.000Z');
    const client = {
      timestamp: 1,
      buster: '1:1.14.0',
      clientState: { mutations: [], queries: [] },
      report: { fetchedAt, label: '2026-11-02' },
    };

    // When
    const restored = deserializeQueryCache(serializeQueryCache(client));

    // Then
    expect(restored).toEqual(client);
  });

  it('Instant 문자열은 복원 뒤에도 오프셋까지 문자열 그대로다', () => {
    // Given
    const memo = {
      createdAt: '2026-11-06T00:00:00.000Z',
      updatedAt: '2026-11-06T09:00:00+09:00',
    };
    const client = {
      timestamp: 1,
      buster: '1:1.15.0',
      clientState: { mutations: [], queries: [] },
      memo,
    };

    // When
    const restored = deserializeQueryCache(serializeQueryCache(client));

    // Then
    expect(restored).toEqual(client);
  });

  it('Instant로 옮기기 전에 저장한 $date 값도 Date로 되살린다', () => {
    // Given 옛 버전이 저장한 캐시
    const legacy = JSON.stringify({
      timestamp: 1,
      buster: '1:1.14.0',
      clientState: { mutations: [], queries: [] },
      memo: { createdAt: { $date: 1793923200000 } },
    });

    // When
    const restored = deserializeQueryCache(legacy);

    // Then
    expect(restored).toMatchObject({ memo: { createdAt: new Date(1793923200000) } });
  });

  it('날씨 리포트의 Instant 시각은 복원 뒤에도 같은 문자열이고 옛 $date 값은 Date로 되살아난다', () => {
    // Given 새 버전이 저장한 리포트와, 옛 버전이 저장한 같은 모양의 리포트
    const current = {
      fetchedAt: '2026-11-02T06:20:00.000Z',
      hourly: [{ startsAt: '2026-11-02T06:00:00.000Z' }],
      daily: [{ sunrise: '2026-11-01T21:51:00+00:00', sunset: null }],
    };
    const legacy = JSON.stringify({
      timestamp: 1,
      buster: '1:1.14.0',
      clientState: { mutations: [], queries: [] },
      report: {
        fetchedAt: { $date: 1793600400000 },
        hourly: [{ startsAt: { $date: 1793599200000 } }],
        daily: [{ sunrise: { $date: 1793569860000 }, sunset: null }],
      },
    });
    const client = {
      timestamp: 1,
      buster: '1:1.15.0',
      clientState: { mutations: [], queries: [] },
      report: current,
    };

    // When
    const restoredCurrent = deserializeQueryCache(serializeQueryCache(client));
    const restoredLegacy = deserializeQueryCache(legacy);

    // Then
    expect(restoredCurrent).toEqual(client);
    expect(restoredLegacy).toMatchObject({
      report: {
        fetchedAt: new Date(1793600400000),
        hourly: [{ startsAt: new Date(1793599200000) }],
        daily: [{ sunrise: new Date(1793569860000), sunset: null }],
      },
    });
  });

  it('달력 날짜와 벽시계 시각 문자열은 복원 뒤에도 문자열 그대로다', () => {
    // Given
    const todo = {
      startDate: '2026-11-06',
      endDate: '2026-11-08',
      localTime: '10:00',
      occurrenceDate: '2026-11-07',
      scheduledLocalTime: '10:00',
      repeat: { until: '2027-02-03' },
    };
    const client = {
      timestamp: 1,
      buster: '1:1.15.0',
      clientState: { mutations: [], queries: [] },
      todo,
      completions: [{ date: '2026-11-06' }],
    };

    // When
    const restored = deserializeQueryCache(serializeQueryCache(client));

    // Then
    expect(restored).toEqual(client);
  });
});

describe('createQueryPersistOptions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const saveAndRestore = async (savedBuster: string, restoringBuster: string) => {
    const storage = createQueryCacheStorage(createMemorySyncStorage());
    storage.setOwner('user-1');
    const source = createClient();
    source.getQueryCache().build(source, { queryKey: ['opted'], ...PERSISTED_QUERY_OPTIONS });
    source.setQueryData(['opted'], { savedAt: new Date('2026-11-02T00:00:00.000Z') });
    await persistQueryClientSave({
      queryClient: source,
      ...createQueryPersistOptions({ storage, buster: savedBuster }),
    });
    await jest.runAllTimersAsync();

    const target = createClient();
    await persistQueryClientRestore({
      queryClient: target,
      ...createQueryPersistOptions({ storage, buster: restoringBuster }),
    });
    return target.getQueryData(['opted']);
  };

  it('같은 앱 버전이면 저장한 조회를 Date까지 복원한다', async () => {
    // Given · When
    const buster = createQueryCacheBuster({ appVersion: '1.14.0', language: 'ko' });
    const restored = await saveAndRestore(buster, buster);

    // Then
    expect(restored).toEqual({ savedAt: new Date('2026-11-02T00:00:00.000Z') });
  });

  it('실제 저장·복원을 거친 달력 요약과 목록에도 체크 결과를 날짜 순서대로 반영한다', async () => {
    // Given
    const date = '2026-11-05';
    const listKey = TODO_QUERY_KEYS.listByDate({ date });
    const rangeKey = TODO_QUERY_KEYS.completionsByRange({
      startDate: '2026-11-01',
      endDate: '2026-11-07',
    });
    const storage = createQueryCacheStorage(createMemorySyncStorage());
    storage.setOwner('user-1');
    const options = createQueryPersistOptions({ storage, buster: '3:1.15.0:ko' });
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
          date: '2026-11-07',
          totalTodos: 1,
          completedTodos: 0,
          isComplete: false,
          completionRate: 0,
          categoryColors: ['#FF0000'],
        },
      ],
      totalCompleteDays: 0,
      dateRange: { startDate: '2026-11-01', endDate: '2026-11-07' },
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
