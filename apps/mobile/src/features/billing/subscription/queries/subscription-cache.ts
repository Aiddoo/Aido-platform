import { UserPolicy } from '@src/features/identity/user/domains/user.model';
import {
  getCachedMe,
  invalidateMe,
  isMeQuery,
} from '@src/features/identity/user/queries/user-cache';
import type { Query, QueryClient } from '@tanstack/react-query';

export function isPremiumDependentQuery(query: Pick<Query, 'meta'>) {
  return query.meta?.refreshOnPremiumChange === true;
}

function invalidatePremiumDependentQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ predicate: isPremiumDependentQuery });
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
