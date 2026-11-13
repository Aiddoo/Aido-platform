import { SUGGESTION_QUERY_KEYS } from '@src/features/assistant/suggestion/queries/suggestion-query-keys';
import { PREFERENCE_QUERY_KEYS } from '@src/features/identity/preference/queries/preference-query-keys';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { toUser } from '@src/features/identity/user/apis/user.mapper';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { MEMO_QUERY_KEYS } from '@src/features/notes/memo/queries/memo-query-keys';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/queries/todo-query-keys';
import { TODO_NUDGE_QUERY_KEYS } from '@src/features/social/nudge/queries/todo-nudge-query-keys';
import { createTestQueryClient } from '@src/testing/core';
import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { ENTITLEMENT_QUERY_KEYS } from './entitlement-query-keys';
import {
  isPremiumDependentQuery,
  syncMeUntilStorePremium,
  watchPremiumEntitlementChanges,
} from './subscription-cache';

const DEPENDENT_KEYS = [
  TODO_NUDGE_QUERY_KEYS.limit(),
  ENTITLEMENT_QUERY_KEYS.snapshot(),
  SUGGESTION_QUERY_KEYS.all,
  MEMO_QUERY_KEYS.resourceLimit(),
  PREFERENCE_QUERY_KEYS.current(),
];
const INDEPENDENT_KEY = TODO_QUERY_KEYS.all;

const FREE_ME = toUser(createCurrentUserDto({ subscriptionStatus: 'FREE' }));
const GRANT_ME = toUser(
  createCurrentUserDto({
    subscriptionStatus: 'ACTIVE',
    subscriptionExpiresAt: '2026-11-01T05:30:00.000Z',
    premiumSource: 'GRANT',
    premiumEndsAt: '2026-11-01T05:30:00.000Z',
    willRenew: false,
    bankedPremiumDays: 0,
  }),
);

function seedQuery(queryClient: QueryClient, queryKey: QueryKey, refreshOnPremiumChange: boolean) {
  queryClient.getQueryCache().build(queryClient, { queryKey, meta: { refreshOnPremiumChange } });
  queryClient.setQueryData(queryKey, { seeded: true });
}

function seedDependentQueries(queryClient: QueryClient) {
  for (const queryKey of DEPENDENT_KEYS) {
    seedQuery(queryClient, queryKey, true);
  }
  seedQuery(queryClient, INDEPENDENT_KEY, false);
}

function invalidatedKeys(queryClient: QueryClient) {
  return [...DEPENDENT_KEYS, INDEPENDENT_KEY].filter(
    (queryKey) => queryClient.getQueryState(queryKey)?.isInvalidated,
  );
}

describe('isPremiumDependentQuery', () => {
  it('조회 옵션이 프리미엄 갱신을 밝힌 쿼리만 고른다', () => {
    // Given
    const queryClient = createTestQueryClient();
    seedDependentQueries(queryClient);

    // When
    const dependentKeys = queryClient
      .getQueryCache()
      .findAll({ predicate: isPremiumDependentQuery })
      .map((query) => query.queryKey);

    // Then
    expect(dependentKeys).toEqual(DEPENDENT_KEYS);
  });

  it('오프라인 복원 같은 다른 meta만 있으면 고르지 않는다', () => {
    // When
    const withOtherMeta = isPremiumDependentQuery({ meta: { persist: true } });
    const withoutMeta = isPremiumDependentQuery({ meta: undefined });

    // Then
    expect(withOtherMeta).toBe(false);
    expect(withoutMeta).toBe(false);
  });
});

describe('watchPremiumEntitlementChanges', () => {
  let queryClient: QueryClient;
  let unwatch: () => void;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    unwatch();
  });

  it('보상 기간이 시작돼 내 정보의 프리미엄이 바뀌면 의존 쿼리만 모두 무효화한다', () => {
    // Given
    queryClient.setQueryData(USER_QUERY_KEYS.me(), FREE_ME);
    seedDependentQueries(queryClient);
    unwatch = watchPremiumEntitlementChanges(queryClient);

    // When
    // 스토어 이벤트 없이 서버가 보상 기간을 시작했다
    queryClient.setQueryData(USER_QUERY_KEYS.me(), GRANT_ME);

    // Then
    expect(invalidatedKeys(queryClient)).toEqual(DEPENDENT_KEYS);
  });

  it('보상 기간이 끝나 무료로 돌아와도 의존 쿼리를 무효화한다', () => {
    // Given
    queryClient.setQueryData(USER_QUERY_KEYS.me(), GRANT_ME);
    seedDependentQueries(queryClient);
    unwatch = watchPremiumEntitlementChanges(queryClient);

    // When
    queryClient.setQueryData(USER_QUERY_KEYS.me(), FREE_ME);

    // Then
    expect(invalidatedKeys(queryClient)).toEqual(DEPENDENT_KEYS);
  });

  it('프로필만 바뀌면 의존 쿼리를 그대로 둔다', () => {
    // Given
    queryClient.setQueryData(USER_QUERY_KEYS.me(), GRANT_ME);
    seedDependentQueries(queryClient);
    unwatch = watchPremiumEntitlementChanges(queryClient);

    // When
    queryClient.setQueryData(USER_QUERY_KEYS.me(), { ...GRANT_ME, name: '새 이름' });

    // Then
    expect(invalidatedKeys(queryClient)).toEqual([]);
  });

  it('처음 내 정보를 받을 때는 비교할 이전 값이 없어 의존 쿼리를 그대로 둔다', () => {
    // Given
    seedDependentQueries(queryClient);
    unwatch = watchPremiumEntitlementChanges(queryClient);

    // When
    queryClient.setQueryData(USER_QUERY_KEYS.me(), GRANT_ME);

    // Then
    expect(invalidatedKeys(queryClient)).toEqual([]);
  });
});

describe('syncMeUntilStorePremium', () => {
  const STORE_ME = toUser(
    createCurrentUserDto({
      subscriptionStatus: 'ACTIVE',
      subscriptionExpiresAt: '2026-11-12T05:30:00.000Z',
      premiumSource: 'STORE',
      premiumEndsAt: '2026-11-12T05:30:00.000Z',
      willRenew: true,
      bankedPremiumDays: 0,
    }),
  );
  const DELAYS_MS = [500, 1_000, 1_500];
  let queryClient: QueryClient;
  const wait = jest.fn(async (_ms: number) => {});

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  async function serveMe(...responses: (typeof FREE_ME)[]) {
    const fetchMe = jest.fn(async () => responses.shift() ?? FREE_ME);
    await queryClient.query({ queryKey: USER_QUERY_KEYS.me(), queryFn: fetchMe });
    return fetchMe;
  }

  it('웹훅이 반영돼 내 정보가 STORE가 되면 그때 멈추고 true를 반환한다', async () => {
    // Given
    // 첫 응답과 첫 재요청은 아직 무료, 두 번째 재요청에서 반영된다
    const fetchMe = await serveMe(FREE_ME, FREE_ME, STORE_ME);

    // When
    const isReflected = await syncMeUntilStorePremium(queryClient, { delaysMs: DELAYS_MS, wait });

    // Then
    expect(isReflected).toBe(true);
    expect(fetchMe).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[500], [1_000]]);
  });

  it('정해 둔 간격을 다 써도 반영되지 않으면 더 기다리지 않고 false를 반환한다', async () => {
    // Given
    const fetchMe = await serveMe(FREE_ME);

    // When
    const isReflected = await syncMeUntilStorePremium(queryClient, { delaysMs: DELAYS_MS, wait });

    // Then
    expect(isReflected).toBe(false);
    expect(fetchMe).toHaveBeenCalledTimes(1 + DELAYS_MS.length);
  });

  it('내 정보가 없으면(로그아웃 뒤) 다시 불러오지 않고 바로 false를 반환한다', async () => {
    // When
    const isReflected = await syncMeUntilStorePremium(queryClient, { delaysMs: DELAYS_MS, wait });

    // Then
    expect(isReflected).toBe(false);
    expect(wait).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(USER_QUERY_KEYS.me())).toBeUndefined();
  });

  it('이미 STORE면 다시 불러오지 않는다', async () => {
    // Given
    const fetchMe = await serveMe(STORE_ME);

    // When
    const isReflected = await syncMeUntilStorePremium(queryClient, { delaysMs: DELAYS_MS, wait });

    // Then
    expect(isReflected).toBe(true);
    expect(fetchMe).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it('기다리는 동안 로그아웃으로 캐시가 비워지면 더 다시 불러오지 않고 false를 반환한다', async () => {
    // Given
    const fetchMe = await serveMe(FREE_ME);
    const clearDuringWait = jest.fn(async (_ms: number) => {
      queryClient.clear();
    });

    // When
    const isReflected = await syncMeUntilStorePremium(queryClient, {
      delaysMs: DELAYS_MS,
      wait: clearDuringWait,
    });

    // Then
    expect(isReflected).toBe(false);
    expect(clearDuringWait).toHaveBeenCalledTimes(1);
    expect(fetchMe).toHaveBeenCalledTimes(1);
  });

  it('기다리는 동안 다른 계정으로 바뀌면 그 계정의 내 정보를 다시 불러오지 않고 false를 반환한다', async () => {
    // Given
    const fetchMe = await serveMe(FREE_ME);
    const switchAccount = jest.fn(async (_ms: number) => {
      queryClient.setQueryData(USER_QUERY_KEYS.me(), { ...FREE_ME, id: 'other-user' });
    });

    // When
    const isReflected = await syncMeUntilStorePremium(queryClient, {
      delaysMs: DELAYS_MS,
      wait: switchAccount,
    });

    // Then
    expect(isReflected).toBe(false);
    expect(switchAccount).toHaveBeenCalledTimes(1);
    expect(fetchMe).toHaveBeenCalledTimes(1);
  });
});
