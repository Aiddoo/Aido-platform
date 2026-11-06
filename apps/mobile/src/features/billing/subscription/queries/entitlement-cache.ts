import type { QueryClient } from '@tanstack/react-query';

import { ENTITLEMENT_QUERY_KEYS } from '../constants/entitlement-query-keys';
import { EntitlementPolicy } from '../domains/entitlement.model';
import { type EntitlementSnapshot, type FeatureQuota } from '../schemas/entitlement.schema';

export function getCachedEntitlements(queryClient: QueryClient) {
  return queryClient.getQueryData<EntitlementSnapshot>(ENTITLEMENT_QUERY_KEYS.snapshot());
}

export function setFeatureQuota(queryClient: QueryClient, quota: FeatureQuota) {
  queryClient.setQueryData<EntitlementSnapshot>(ENTITLEMENT_QUERY_KEYS.snapshot(), (snapshot) =>
    snapshot == null ? snapshot : EntitlementPolicy.withFeatureQuota(snapshot, quota),
  );
}

export function invalidateEntitlements(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ENTITLEMENT_QUERY_KEYS.snapshot() });
}
