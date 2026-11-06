import { PREMIUM_SOURCE } from '@aido/api';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import { UserPolicy } from '@src/features/identity/user/domains/user.model';
import { getCachedMe, invalidateMe } from '@src/features/identity/user/queries/user-cache';
import { hashKey, type Query, type QueryClient } from '@tanstack/react-query';
import { delay } from 'es-toolkit';

/** 조회 옵션이 `meta.refreshOnPremiumChange`로 프리미엄에 따라 달라진다고 밝힌 쿼리 */
export function isPremiumDependentQuery(query: Pick<Query, 'meta'>) {
  return query.meta?.refreshOnPremiumChange === true;
}

/** 프리미엄에 따라 한도·사용량·접근이 달라지는 쿼리를 다시 불러온다. */
export function invalidatePremiumDependentQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ predicate: isPremiumDependentQuery });
}

/** 프리미엄 기간이 끝나는 순간에는 서버 이벤트가 없어 내 정보와 의존 쿼리를 한 번 다시 불러온다 */
export function refreshAfterPremiumEnded(queryClient: QueryClient) {
  return Promise.all([invalidateMe(queryClient), invalidatePremiumDependentQueries(queryClient)]);
}

/**
 * 내 정보가 새로 들어올 때마다 이전 값과 비교해, 프리미엄이 바뀐 경우에만 의존 쿼리를 다시 불러온다.
 * 보상 기간의 시작·끝은 스토어 이벤트 없이 서버에서만 바뀌므로 구매·복원·초대 수락·알림 어디서
 * 내 정보를 갱신해도 이 한 곳이 따라간다. 반환값은 구독 해제 함수다.
 */
export function watchPremiumEntitlementChanges(queryClient: QueryClient) {
  const meQueryHash = hashKey(USER_QUERY_KEYS.me());
  let previousMe = getCachedMe(queryClient);

  return queryClient.getQueryCache().subscribe((event) => {
    if (
      event.type !== 'updated' ||
      event.action.type !== 'success' ||
      event.query.queryHash !== meQueryHash
    ) {
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
export const STORE_PREMIUM_SYNC_DELAYS = [500, 1_000, 1_500, 2_500, 4_000] as const;

interface SyncStorePremiumOptions {
  delays?: readonly number[];
  wait?: (ms: number) => Promise<void>;
}

/**
 * 결제한 구독이 서버 내 정보에 STORE로 보일 때까지 짧게 간격을 늘리며 다시 불러온다.
 * 캐시에 낙관적으로 쓰지 않고 서버 값만 기다린다. 끝내 반영되지 않으면 false다.
 */
export async function syncMeUntilStorePremium(
  queryClient: QueryClient,
  { delays = STORE_PREMIUM_SYNC_DELAYS, wait = delay }: SyncStorePremiumOptions = {},
) {
  for (const ms of delays) {
    if (getCachedMe(queryClient)?.premiumAccess.source === PREMIUM_SOURCE.STORE) {
      return true;
    }
    await wait(ms);
    await queryClient.refetchQueries({ queryKey: USER_QUERY_KEYS.me(), exact: true });
  }

  return getCachedMe(queryClient)?.premiumAccess.source === PREMIUM_SOURCE.STORE;
}
