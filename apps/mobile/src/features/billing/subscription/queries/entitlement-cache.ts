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

export function invalidateEntitlements(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ENTITLEMENT_QUERY_KEYS.snapshot() });
}
