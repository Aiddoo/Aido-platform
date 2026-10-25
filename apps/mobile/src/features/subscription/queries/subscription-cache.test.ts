import { AI_QUERY_KEYS } from '@src/features/ai/constants/ai-query-keys';
import { MEMO_QUERY_KEYS } from '@src/features/memo/constants/memo-query-keys';
import { NUDGE_QUERY_KEYS } from '@src/features/nudge/constants/nudge-query-keys';
import { createCurrentUserDto } from '@src/features/user/__tests__/user.factories';
import { toUser } from '@src/features/user/apis/user.mapper';
import { USER_QUERY_KEYS } from '@src/features/user/constants/user-query-keys';
import { createTestQueryClient } from '@src/shared/__tests__/render-ui';
import type { QueryClient } from '@tanstack/react-query';

import { watchPremiumEntitlementChanges } from './subscription-cache';

const DEPENDENT_KEYS = [
  NUDGE_QUERY_KEYS.limit(),
  AI_QUERY_KEYS.usage(),
  AI_QUERY_KEYS.suggestions(),
  MEMO_QUERY_KEYS.resourceLimit(),
];

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

function seedDependentQueries(queryClient: QueryClient) {
  for (const queryKey of DEPENDENT_KEYS) {
    queryClient.setQueryData(queryKey, { seeded: true });
  }
}

function invalidatedDependentKeys(queryClient: QueryClient) {
  return DEPENDENT_KEYS.filter((queryKey) => queryClient.getQueryState(queryKey)?.isInvalidated);
}

describe('watchPremiumEntitlementChanges', () => {
  let queryClient: QueryClient;
  let unwatch: () => void;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    unwatch();
    queryClient.clear();
  });

  it('보상 기간이 시작돼 내 정보의 프리미엄이 바뀌면 의존 쿼리를 모두 무효화한다', () => {
    // Given
    queryClient.setQueryData(USER_QUERY_KEYS.me(), FREE_ME);
    seedDependentQueries(queryClient);
    unwatch = watchPremiumEntitlementChanges(queryClient);

    // When 스토어 이벤트 없이 서버가 보상 기간을 시작했다
    queryClient.setQueryData(USER_QUERY_KEYS.me(), GRANT_ME);

    // Then
    expect(invalidatedDependentKeys(queryClient)).toEqual(DEPENDENT_KEYS);
  });

  it('보상 기간이 끝나 무료로 돌아와도 의존 쿼리를 무효화한다', () => {
    // Given
    queryClient.setQueryData(USER_QUERY_KEYS.me(), GRANT_ME);
    seedDependentQueries(queryClient);
    unwatch = watchPremiumEntitlementChanges(queryClient);

    // When
    queryClient.setQueryData(USER_QUERY_KEYS.me(), FREE_ME);

    // Then
    expect(invalidatedDependentKeys(queryClient)).toEqual(DEPENDENT_KEYS);
  });

  it('프로필만 바뀌면 의존 쿼리를 그대로 둔다', () => {
    // Given
    queryClient.setQueryData(USER_QUERY_KEYS.me(), GRANT_ME);
    seedDependentQueries(queryClient);
    unwatch = watchPremiumEntitlementChanges(queryClient);

    // When
    queryClient.setQueryData(USER_QUERY_KEYS.me(), { ...GRANT_ME, name: '새 이름' });

    // Then
    expect(invalidatedDependentKeys(queryClient)).toEqual([]);
  });

  it('처음 내 정보를 받을 때는 비교할 이전 값이 없어 의존 쿼리를 그대로 둔다', () => {
    // Given
    seedDependentQueries(queryClient);
    unwatch = watchPremiumEntitlementChanges(queryClient);

    // When
    queryClient.setQueryData(USER_QUERY_KEYS.me(), GRANT_ME);

    // Then
    expect(invalidatedDependentKeys(queryClient)).toEqual([]);
  });
});
