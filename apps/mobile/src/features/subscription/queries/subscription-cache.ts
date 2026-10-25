import { invalidatePremiumAiQueries } from '@src/features/ai/queries/ai-cache';
import { invalidateMemoResourceLimit } from '@src/features/memo/queries/memo-cache';
import { invalidateNudgeLimit } from '@src/features/nudge/queries/nudge-cache';
import { USER_QUERY_KEYS } from '@src/features/user/constants/user-query-keys';
import { UserPolicy } from '@src/features/user/domains/user.model';
import { getCachedMe } from '@src/features/user/queries/user-cache';
import { hashKey, type QueryClient } from '@tanstack/react-query';
import { delay } from 'es-toolkit';

/** 프리미엄에 따라 한도·사용량이 달라지는 쿼리를 다시 불러온다. */
export function invalidatePremiumDependentQueries(queryClient: QueryClient) {
  return Promise.all([
    invalidateNudgeLimit(queryClient),
    invalidatePremiumAiQueries(queryClient),
    invalidateMemoResourceLimit(queryClient),
  ]);
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
    if (getCachedMe(queryClient)?.premiumAccess.source === 'STORE') {
      return true;
    }
    await wait(ms);
    await queryClient.refetchQueries({ queryKey: USER_QUERY_KEYS.me(), exact: true });
  }

  return getCachedMe(queryClient)?.premiumAccess.source === 'STORE';
}
