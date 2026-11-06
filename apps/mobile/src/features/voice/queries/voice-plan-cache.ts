import type { FeatureQuota } from '@src/features/billing/subscription/domains/entitlement.model';
import {
  invalidateEntitlements,
  setFeatureQuota,
} from '@src/features/billing/subscription/queries/entitlement-cache';
import type { QueryClient } from '@tanstack/react-query';

export function reflectFeatureQuota(queryClient: QueryClient, featureQuota: FeatureQuota | null) {
  if (featureQuota == null) {
    invalidateEntitlements(queryClient);
    return;
  }
  setFeatureQuota(queryClient, featureQuota);
}
