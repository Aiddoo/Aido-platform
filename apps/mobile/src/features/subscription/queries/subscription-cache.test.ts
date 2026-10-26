import { AI_QUERY_KEYS } from '@src/features/ai/constants/ai-query-keys';
import { MEMO_QUERY_KEYS } from '@src/features/memo/constants/memo-query-keys';
import { NUDGE_QUERY_KEYS } from '@src/features/nudge/constants/nudge-query-keys';
import { createCurrentUserDto } from '@src/features/user/__tests__/user.factories';
import { toUser } from '@src/features/user/apis/user.mapper';
import { USER_QUERY_KEYS } from '@src/features/user/constants/user-query-keys';
import { createTestQueryClient } from '@src/shared/__tests__/render-ui';
import type { QueryClient } from '@tanstack/react-query';

import { syncMeUntilStorePremium, watchPremiumEntitlementChanges } from './subscription-cache';

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
  const DELAYS = [500, 1_000, 1_500];
  let queryClient: QueryClient;
  const wait = jest.fn(async (_ms: number) => {});

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  /** 서버가 /me를 차례로 이렇게 답한다 */
  async function serveMe(...responses: (typeof FREE_ME)[]) {
    const fetchMe = jest.fn(async () => responses.shift() ?? FREE_ME);
    await queryClient.prefetchQuery({ queryKey: USER_QUERY_KEYS.me(), queryFn: fetchMe });
    return fetchMe;
  }

  it('웹훅이 반영돼 내 정보가 STORE가 되면 그때 멈추고 true를 반환한다', async () => {
    // Given 첫 응답과 첫 재요청은 아직 무료, 두 번째 재요청에서 반영된다
    const fetchMe = await serveMe(FREE_ME, FREE_ME, STORE_ME);

    // When
    const isReflected = await syncMeUntilStorePremium(queryClient, { delays: DELAYS, wait });

    // Then
    expect(isReflected).toBe(true);
    expect(fetchMe).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[500], [1_000]]);
  });

  it('정해 둔 간격을 다 써도 반영되지 않으면 더 기다리지 않고 false를 반환한다', async () => {
    // Given
    const fetchMe = await serveMe(FREE_ME);

    // When
    const isReflected = await syncMeUntilStorePremium(queryClient, { delays: DELAYS, wait });

    // Then
    expect(isReflected).toBe(false);
    expect(fetchMe).toHaveBeenCalledTimes(1 + DELAYS.length);
  });

  it('이미 STORE면 다시 불러오지 않는다', async () => {
    // Given
    const fetchMe = await serveMe(STORE_ME);

    // When
    const isReflected = await syncMeUntilStorePremium(queryClient, { delays: DELAYS, wait });

    // Then
    expect(isReflected).toBe(true);
    expect(fetchMe).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });
});
