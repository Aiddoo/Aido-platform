import type { FeatureQuota } from '@src/features/subscription/domains/entitlement.model';
import {
  invalidateEntitlements,
  setFeatureQuota,
} from '@src/features/subscription/queries/entitlement-cache';
import type { QueryClient } from '@tanstack/react-query';

/** 응답이 준 한도를 스냅샷에 반영한다. 서버가 한도를 싣지 못했으면 다시 묻는다 */
export function reflectFeatureQuota(queryClient: QueryClient, featureQuota: FeatureQuota | null) {
  if (featureQuota == null) {
    invalidateEntitlements(queryClient);
    return;
  }
  setFeatureQuota(queryClient, featureQuota);
}
