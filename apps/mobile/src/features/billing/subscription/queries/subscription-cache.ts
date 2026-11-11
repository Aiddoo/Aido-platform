import { PremiumAccessPolicy } from '@src/features/identity/user/domains/premium-access.model';
import { UserPolicy } from '@src/features/identity/user/domains/user.model';
import {
  getCachedMe,
  invalidateMe,
  isMeQuery,
  refetchMe,
} from '@src/features/identity/user/queries/user-cache';
import type { Query, QueryClient } from '@tanstack/react-query';
import { delay } from 'es-toolkit';

export function isPremiumDependentQuery(query: Pick<Query, 'meta'>) {
  return query.meta?.refreshOnPremiumChange === true;
}

function invalidatePremiumDependentQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ predicate: isPremiumDependentQuery });
}

function isStorePremiumReflected(queryClient: QueryClient) {
  const premiumAccess = getCachedMe(queryClient)?.premiumAccess;
  return premiumAccess != null && PremiumAccessPolicy.isStoreSubscribed(premiumAccess);
}

/** 프리미엄 기간이 끝나는 순간에는 서버 이벤트가 없어 내 정보와 의존 쿼리를 한 번 다시 불러온다 */
export function refreshAfterPremiumEnded(queryClient: QueryClient) {
  return Promise.all([invalidateMe(queryClient), invalidatePremiumDependentQueries(queryClient)]);
}

/** 보상 기간은 스토어 이벤트 없이 서버에서만 바뀌므로 어디서 내 정보를 갱신해도 여기서 따라간다. 반환값은 구독 해제다 */
export function watchPremiumEntitlementChanges(queryClient: QueryClient) {
  let previousMe = getCachedMe(queryClient);

  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success' || !isMeQuery(event.query)) {
      return;
    }

    const nextMe = getCachedMe(queryClient);
    if (
      previousMe != null &&
      nextMe != null &&
      UserPolicy.hasEntitlementChanged(previousMe, nextMe)
    ) {
      invalidatePremiumDependentQueries(queryClient);
    }
    previousMe = nextMe;
  });
}

/** 결제 뒤 서버가 스토어 웹훅을 반영할 때까지 내 정보를 다시 받는 간격. 모두 합쳐 10초 남짓에서 멈춘다 */
const STORE_PREMIUM_SYNC_DELAYS = [500, 1_000, 1_500, 2_500, 4_000] as const;

interface SyncStorePremiumOptions {
  delays?: readonly number[];
  wait?: (ms: number) => Promise<void>;
}

/** 캐시에 낙관적으로 쓰지 않고 서버 값이 STORE가 될 때까지만 기다린다. 끝내 반영되지 않거나 기다리는 동안 사용자가 바뀌면 false다 */
export async function syncMeUntilStorePremium(
  queryClient: QueryClient,
  { delays = STORE_PREMIUM_SYNC_DELAYS, wait = delay }: SyncStorePremiumOptions = {},
) {
  const userId = getCachedMe(queryClient)?.id;

  for (const ms of delays) {
    if (isStorePremiumReflected(queryClient)) {
      return true;
    }
    await wait(ms);
    // 기다리는 동안 로그아웃·계정 전환으로 사용자가 바뀌었으면 다른 사용자의 내 정보를 건드리지 않고 멈춘다
    if (getCachedMe(queryClient)?.id !== userId) {
      return false;
    }
    await refetchMe(queryClient);
  }

  return isStorePremiumReflected(queryClient);
}
