import type { QueryClient } from '@tanstack/react-query';

import { type FeatureQuota } from '../domains/entitlement.model';
import { EntitlementPolicy } from '../domains/entitlement.model';
import { ENTITLEMENT_QUERY_KEYS } from './entitlement-query-keys';

export function getCachedEntitlements(queryClient: QueryClient) {
  return queryClient.getQueryData(ENTITLEMENT_QUERY_KEYS.snapshot());
}

export function setFeatureQuota(queryClient: QueryClient, quota: FeatureQuota) {
  queryClient.setQueryData(ENTITLEMENT_QUERY_KEYS.snapshot(), (snapshot) =>
    snapshot == null ? snapshot : EntitlementPolicy.withFeatureQuota(snapshot, quota),
  );
}

/** 서버가 응답에 실어 준 남은 한도를 스냅샷에 쓴다. 한도를 읽지 못해 싣지 않았으면(null) 다시 묻는다 */
export function reflectFeatureQuota(queryClient: QueryClient, quota: FeatureQuota | null) {
  if (quota == null) {
    invalidateEntitlements(queryClient);
    return;
  }
  setFeatureQuota(queryClient, quota);
}

export function invalidateEntitlements(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ENTITLEMENT_QUERY_KEYS.snapshot() });
}
