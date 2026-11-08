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

// 끝나는 순간에는 서버 이벤트가 없다
export function refreshAfterPremiumEnded(queryClient: QueryClient) {
  return Promise.all([invalidateMe(queryClient), invalidatePremiumDependentQueries(queryClient)]);
}

// 보상 기간은 스토어 이벤트 없이 서버에서만 바뀌므로 내 정보 갱신 한 곳에서 따라간다
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

// 모두 합쳐 10초 남짓에서 멈춘다
const STORE_PREMIUM_SYNC_DELAYS = [500, 1_000, 1_500, 2_500, 4_000] as const;

interface SyncStorePremiumOptions {
  delays?: readonly number[];
  wait?: (ms: number) => Promise<void>;
}

// 낙관적으로 쓰지 않고 서버 값만 기다린다
export async function syncMeUntilStorePremium(
  queryClient: QueryClient,
  { delays = STORE_PREMIUM_SYNC_DELAYS, wait = delay }: SyncStorePremiumOptions = {},
) {
  for (const ms of delays) {
    if (isStorePremiumReflected(queryClient)) {
      return true;
    }
    await wait(ms);
    await refetchMe(queryClient);
  }

  return isStorePremiumReflected(queryClient);
}
