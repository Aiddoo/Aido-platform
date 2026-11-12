import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createEntitlementSnapshot } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/billing/subscription/queries/entitlement-query-keys';
import { createPreference } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { PREFERENCE_QUERY_KEYS } from '@src/features/identity/preference/queries/preference-query-keys';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { toUser } from '@src/features/identity/user/apis/user.mapper';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { createTodoCategoryWithCountDto } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import { toTodoCategoryWithCount } from '@src/features/planning/category/apis/todo-category.mapper';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/planning/category/queries/todo-category-query-keys';
import { createParentTodo } from '@src/features/planning/todo/__tests__/sub-todo.fixtures';
import { createDailyCompletionsDto } from '@src/features/planning/todo/__tests__/todo.fixtures';
import { toDailyCompletionsResult } from '@src/features/planning/todo/apis/todo.mapper';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/queries/todo-query-keys';
import { createFriendsListDto } from '@src/features/social/friend/__tests__/friend.fixtures';
import { toFriendsPage } from '@src/features/social/friend/apis/friend.mapper';
import { FRIEND_QUERY_KEYS } from '@src/features/social/friend/queries/friend-query-keys';
import { createWeatherReport } from '@src/features/weather/__tests__/weather-report.fixtures';
import { WEATHER_QUERY_KEYS } from '@src/features/weather/queries/weather-query-keys';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { setGlobalLogger } from '@src/shared/infra/logger/global-logger';
import {
  createAppLoggerStub,
  createMemorySyncStorage,
  createTestQueryClient,
} from '@src/testing/core';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { partialMatchKey, type QueryKey } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client';
import { isEqual } from 'es-toolkit';

import { PERSISTED_QUERY_SCHEMAS } from './persisted-query-schemas';
import { QUERY_CACHE_LOG_EVENT } from './query-cache-log-events';
import {
  createQueryCacheStorage,
  createQueryPersistOptions,
  QUERY_CACHE_STORAGE_KEY,
} from './query-cache-persistence';

const ME_KEY = USER_QUERY_KEYS.me();
const LIST_KEY = TODO_QUERY_KEYS.listByDate({ date: '2026-11-07' });
const REPORT_KEY = WEATHER_QUERY_KEYS.report({ locationRevision: 1 });

type CacheEntry = [QueryKey, unknown];

function createValidCache(): CacheEntry[] {
  return [
    [ME_KEY, toUser(createCurrentUserDto())],
    [LIST_KEY, { todos: [createParentTodo()], hasNext: false, nextCursor: null }],
    [
      TODO_CATEGORY_QUERY_KEYS.list(),
      { categories: [toTodoCategoryWithCount(createTodoCategoryWithCountDto())] },
    ],
    [
      TODO_QUERY_KEYS.completionsByRange({ startDate: '2026-11-01', endDate: '2026-11-07' }),
      toDailyCompletionsResult(createDailyCompletionsDto()),
    ],
    [ENTITLEMENT_QUERY_KEYS.snapshot(), createEntitlementSnapshot()],
    [PREFERENCE_QUERY_KEYS.current(), createPreference()],
    [
      FRIEND_QUERY_KEYS.friends(),
      {
        pages: [toFriendsPage(createFriendsListDto())],
        pageParams: ['follow-0'],
      },
    ],
    [
      WEATHER_QUERY_KEYS.location(),
      {
        status: 'located',
        registered: { latitude: 37.5, longitude: 127, timezone: 'Asia/Seoul' },
        place: null,
        countryCode: 'KR',
        revision: 1,
      },
    ],
    [REPORT_KEY, createWeatherReport()],
  ];
}

function replaceData(cache: CacheEntry[], target: QueryKey, data: unknown): CacheEntry[] {
  return cache.map(([queryKey, current]) => [queryKey, isEqual(queryKey, target) ? data : current]);
}

async function saveThenRestore(cache: CacheEntry[]) {
  const storage = createQueryCacheStorage(createMemorySyncStorage());
  storage.setOwner('user-1');
  const options = createQueryPersistOptions({
    storage,
    buster: '5:1.15.0:ko',
    schemas: PERSISTED_QUERY_SCHEMAS,
  });
  const source = createTestQueryClient();
  for (const [queryKey, data] of cache) {
    source.getQueryCache().build(source, { queryKey, ...PERSISTED_QUERY_OPTIONS });
    source.setQueryData(queryKey, data);
  }
  await persistQueryClientSave({ queryClient: source, ...options });
  await jest.runAllTimersAsync();

  const restored = createTestQueryClient();
  await persistQueryClientRestore({ queryClient: restored, ...options });
  return { restored, storage, options };
}

describe('영속 캐시 복원 검증', () => {
  setupFakeTimersPerTest();

  const logger = createAppLoggerStub();

  beforeEach(() => {
    setGlobalLogger(logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('앱이 저장하는 조회는 모두 값 그대로 복원되고 로그를 남기지 않는다', async () => {
    // Given
    const cache = createValidCache();

    // When
    const { restored } = await saveThenRestore(cache);

    // Then
    for (const [queryKey, data] of cache) {
      expect(restored.getQueryData(queryKey)).toEqual(data);
    }
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('깨진 값 하나는 그 조회만 버리고 나머지는 복원한다', async () => {
    // Given
    const cache = replaceData(createValidCache(), ME_KEY, { id: 'user-1', premiumAccess: null });

    // When
    const { restored } = await saveThenRestore(cache);

    // Then
    expect(restored.getQueryData(ME_KEY)).toBeUndefined();
    expect(restored.getQueryData(LIST_KEY)).toBeDefined();
    expect(restored.getQueryData(REPORT_KEY)).toBeDefined();
  });

  it('모양이 옛날인 값은 버린다', async () => {
    // Given
    const oldShape = { todos: [{ title: createParentTodo().title }], total: 1 };
    const cache = replaceData(createValidCache(), LIST_KEY, oldShape);

    // When
    const { restored } = await saveThenRestore(cache);

    // Then
    expect(restored.getQueryData(LIST_KEY)).toBeUndefined();
    expect(restored.getQueryData(ME_KEY)).toBeDefined();
  });

  it('요금제 종류(planType)가 없던 같은 버전의 /me는 스키마 기본값(null)을 채워 복원한다', async () => {
    // Given
    const user = toUser(createCurrentUserDto());
    const { planType: _omitted, ...premiumAccessWithoutPlanType } = user.premiumAccess;
    const cache = replaceData(createValidCache(), ME_KEY, {
      ...user,
      premiumAccess: premiumAccessWithoutPlanType,
    });

    // When
    const { restored } = await saveThenRestore(cache);

    // Then
    expect(restored.getQueryData(ME_KEY)).toEqual(user);
    expect(restored.getQueryData<typeof user>(ME_KEY)?.premiumAccess.planType).toBeNull();
  });

  it('한 항목만 깨진 목록은 목록 조회 전체를 버린다', async () => {
    // Given
    const broken = { ...createParentTodo(), scheduledAt: '어제' };
    const cache = replaceData(createValidCache(), LIST_KEY, {
      todos: [createParentTodo(), broken],
      hasNext: false,
      nextCursor: null,
    });

    // When
    const { restored } = await saveThenRestore(cache);

    // Then
    expect(restored.getQueryData(LIST_KEY)).toBeUndefined();
    expect(restored.getQueryData(TODO_CATEGORY_QUERY_KEYS.list())).toBeDefined();
  });

  it('날짜 칸이 깨진 날씨 리포트는 버린다', async () => {
    // Given
    const cache = replaceData(createValidCache(), REPORT_KEY, {
      ...createWeatherReport(),
      fetchedAt: '어제',
    });

    // When
    const { restored } = await saveThenRestore(cache);

    // Then
    expect(restored.getQueryData(REPORT_KEY)).toBeUndefined();
  });

  it('값이 null이거나 문자열이어도 앱이 죽지 않고 그 조회만 버린다', async () => {
    // Given
    const cache = replaceData(
      replaceData(createValidCache(), FRIEND_QUERY_KEYS.friends(), null),
      ENTITLEMENT_QUERY_KEYS.snapshot(),
      '깨짐',
    );

    // When
    const { restored } = await saveThenRestore(cache);

    // Then
    expect(restored.getQueryData(FRIEND_QUERY_KEYS.friends())).toBeUndefined();
    expect(restored.getQueryData(ENTITLEMENT_QUERY_KEYS.snapshot())).toBeUndefined();
    expect(restored.getQueryData(ME_KEY)).toBeDefined();
  });

  it('표에 없는 조회는 검증할 수 없어 버린다', async () => {
    // Given
    const cache: CacheEntry[] = [[['unknown-query'], { any: 'value' }]];

    // When
    const { restored } = await saveThenRestore(cache);

    // Then
    expect(restored.getQueryData(['unknown-query'])).toBeUndefined();
  });

  it('버린 조회는 개수와 키 뿌리만 로그로 남기고 사용자 데이터는 넣지 않는다', async () => {
    // Given
    const cache = replaceData(createValidCache(), ME_KEY, {
      ...toUser(createCurrentUserDto()),
      email: 12345,
    });

    // When
    await saveThenRestore(cache);

    // Then
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(QUERY_CACHE_LOG_EVENT.RESTORED_QUERIES_DROPPED, {
      droppedCount: 1,
      totalCount: 9,
      droppedRoots: ['user'],
    });
  });

  it('JSON이 깨지면 복원 실패로 저장값을 지운다', async () => {
    // Given
    const { storage, options } = await saveThenRestore(createValidCache());
    storage.setItem(QUERY_CACHE_STORAGE_KEY, '{깨진 JSON');
    const restored = createTestQueryClient();

    // When
    await expect(
      persistQueryClientRestore({ queryClient: restored, ...options }),
    ).rejects.toBeInstanceOf(SyntaxError);

    // Then
    expect(restored.getQueryData(ME_KEY)).toBeUndefined();
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
  });
});

describe('PERSISTED_QUERY_SCHEMAS', () => {
  const PERSISTED_QUERY_KEY_SAMPLES: Record<string, QueryKey> = {
    'USER_QUERY_KEYS.me': ME_KEY,
    'PREFERENCE_QUERY_KEYS.current': PREFERENCE_QUERY_KEYS.current(),
    'TODO_CATEGORY_QUERY_KEYS.list': TODO_CATEGORY_QUERY_KEYS.list(),
    'TODO_QUERY_KEYS.listByDate': LIST_KEY,
    'TODO_QUERY_KEYS.completionsByRange': TODO_QUERY_KEYS.completionsByRange({
      startDate: '2026-11-01',
      endDate: '2026-11-07',
    }),
    'FRIEND_QUERY_KEYS.friends': FRIEND_QUERY_KEYS.friends(),
    'WEATHER_QUERY_KEYS.location': WEATHER_QUERY_KEYS.location(),
    'WEATHER_QUERY_KEYS.report': REPORT_KEY,
    'ENTITLEMENT_QUERY_KEYS.snapshot': ENTITLEMENT_QUERY_KEYS.snapshot(),
  };

  function listSourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? listSourceFiles(path) : [path];
    });
  }

  function findPersistedQueryKeyNames(): string[] {
    const queryFiles = listSourceFiles(join(__dirname, '../../features')).filter(
      (path) => path.endsWith('.queries.ts') && !path.includes('__tests__'),
    );
    const names = queryFiles.flatMap((path) =>
      readFileSync(path, 'utf8')
        // 쿼리 옵션을 내보내지 않는 지역 함수(달력 범위 조회 등)에 둘 수도 있어 모든 함수 선언을 훑는다
        .split(/^(?:export )?function /m)
        .slice(1)
        .filter((block) => block.includes('PERSISTED_QUERY_OPTIONS'))
        .map((block) => /queryKey: (\w+_QUERY_KEYS\.\w+)\(/.exec(block)?.[1] ?? 'UNKNOWN'),
    );
    return [...new Set(names)];
  }

  it('meta.persist가 달린 쿼리 키가 모두 표에 있다', () => {
    // Given
    const persistedKeyNames = findPersistedQueryKeyNames();

    // When
    const missing = persistedKeyNames.filter((name) => {
      const sample = PERSISTED_QUERY_KEY_SAMPLES[name];
      return (
        sample == null ||
        !PERSISTED_QUERY_SCHEMAS.some(({ queryKey }) => partialMatchKey(sample, queryKey))
      );
    });

    // Then
    expect(missing).toEqual([]);
    expect([...persistedKeyNames].sort()).toEqual(Object.keys(PERSISTED_QUERY_KEY_SAMPLES).sort());
  });
});
