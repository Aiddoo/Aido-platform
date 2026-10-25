import { invalidatePremiumAiQueries } from '@src/features/ai/queries/ai-cache';
import { invalidateMemoResourceLimit } from '@src/features/memo/queries/memo-cache';
import { invalidateNudgeLimit } from '@src/features/nudge/queries/nudge-cache';
import { USER_QUERY_KEYS } from '@src/features/user/constants/user-query-keys';
import { UserPolicy } from '@src/features/user/domains/user.model';
import { getCachedMe } from '@src/features/user/queries/user-cache';
import { hashKey, type QueryClient } from '@tanstack/react-query';

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
