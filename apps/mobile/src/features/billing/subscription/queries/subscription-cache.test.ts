import { SUGGESTION_QUERY_KEYS } from '@src/features/assistant/suggestion/queries/suggestion-query-keys';
import { PREFERENCE_QUERY_KEYS } from '@src/features/identity/preference/queries/preference-query-keys';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { toUser } from '@src/features/identity/user/apis/user.mapper';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { MEMO_QUERY_KEYS } from '@src/features/notes/memo/queries/memo-query-keys';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/queries/todo-query-keys';
import { createTestQueryClient } from '@src/testing/core';
import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { ENTITLEMENT_QUERY_KEYS } from './entitlement-query-keys';
import { isPremiumDependentQuery, watchPremiumEntitlementChanges } from './subscription-cache';

const DEPENDENT_KEYS = [
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
