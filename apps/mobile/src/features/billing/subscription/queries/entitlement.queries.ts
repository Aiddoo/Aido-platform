import { useEntitlementApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import { queryOptions } from '@tanstack/react-query';

import { ENTITLEMENT_QUERY_KEYS } from './entitlement-query-keys';

/** 한도·사용량이 서버에서 바뀌어도 1분 안에는 다시 묻지 않는다. AI 응답의 featureQuota가 그 사이를 채운다 */
const ENTITLEMENTS_STALE_TIME_MS = MINUTE_MS;

export function useGetEntitlementsQueryOptions() {
  const entitlementApi = useEntitlementApi();

  return queryOptions({
    queryKey: ENTITLEMENT_QUERY_KEYS.snapshot(),
    queryFn: async ({ signal }) => unwrap(await entitlementApi.getEntitlements(signal)),
    staleTime: ENTITLEMENTS_STALE_TIME_MS,
    // 오프라인으로 다시 열어도 구독 화면·프리미엄 판정이 마지막 서버 값을 유지한다
    ...PERSISTED_QUERY_OPTIONS,
    meta: { ...PERSISTED_QUERY_OPTIONS.meta, refreshOnPremiumChange: true },
  });
}
