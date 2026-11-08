import { useEntitlementService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import { queryOptions } from '@tanstack/react-query';

import { ENTITLEMENT_QUERY_KEYS } from '../constants/entitlement-query-keys';

// AI 응답의 featureQuota가 1분 사이를 채운다
const ENTITLEMENTS_STALE_TIME_MS = MINUTE_MS;

export function useGetEntitlementsQueryOptions() {
  const entitlementService = useEntitlementService();

  return queryOptions({
    queryKey: ENTITLEMENT_QUERY_KEYS.snapshot(),
    queryFn: async ({ signal }) => unwrap(await entitlementService.getEntitlements(signal)),
    staleTime: ENTITLEMENTS_STALE_TIME_MS,
    // 오프라인으로 다시 열어도 마지막 서버 값을 유지한다
    ...PERSISTED_QUERY_OPTIONS,
    meta: { ...PERSISTED_QUERY_OPTIONS.meta, refreshOnPremiumChange: true },
  });
}
