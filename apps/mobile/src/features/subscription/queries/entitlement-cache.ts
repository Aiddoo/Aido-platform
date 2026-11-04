import type { QueryClient } from '@tanstack/react-query';

import { ENTITLEMENT_QUERY_KEYS } from '../constants/entitlement-query-keys';
import {
  type EntitlementSnapshot,
  EntitlementPolicy,
  type FeatureQuota,
} from '../domains/entitlement.model';

export function getCachedEntitlements(queryClient: QueryClient) {
  return queryClient.getQueryData<EntitlementSnapshot>(ENTITLEMENT_QUERY_KEYS.snapshot());
}

/** AI 응답·한도 오류가 함께 준 한도를 다시 묻지 않고 스냅샷에 반영한다. 스냅샷이 없으면 다음 조회를 기다린다 */
export function setFeatureQuota(queryClient: QueryClient, quota: FeatureQuota) {
  queryClient.setQueryData<EntitlementSnapshot>(ENTITLEMENT_QUERY_KEYS.snapshot(), (snapshot) =>
    snapshot == null ? snapshot : EntitlementPolicy.withFeatureQuota(snapshot, quota),
  );
}

export function invalidateEntitlements(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ENTITLEMENT_QUERY_KEYS.snapshot() });
}
