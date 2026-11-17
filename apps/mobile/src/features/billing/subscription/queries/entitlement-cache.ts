import { DAY_MS, MINUTE_MS } from '@src/shared/constants/time-units';
import { diffMs, type Instant } from '@src/shared/date/instant';
import type { QueryClient } from '@tanstack/react-query';
import { clamp } from 'es-toolkit';

import { type EntitlementSnapshot, type FeatureQuota } from '../domains/entitlement.model';
import { EntitlementPolicy } from '../domains/entitlement.model';
import { ENTITLEMENT_QUERY_KEYS } from './entitlement-query-keys';

export function getCachedEntitlements(queryClient: QueryClient) {
  return queryClient.getQueryData(ENTITLEMENT_QUERY_KEYS.snapshot());
}

/** 서버가 응답에 실어 준 남은 한도를 스냅샷에 쓴다. 한도를 읽지 못해 싣지 않았으면(null) 다시 묻는다 */
export function reflectFeatureQuota(queryClient: QueryClient, quota: FeatureQuota | null) {
  if (quota == null) {
    invalidateEntitlements(queryClient);
    return;
  }
  queryClient.setQueryData(ENTITLEMENT_QUERY_KEYS.snapshot(), (snapshot) =>
    snapshot == null ? snapshot : EntitlementPolicy.withFeatureQuota(snapshot, quota),
  );
}

/**
 * 남은 횟수는 초기화 순간(resetsAt)에 바뀌므로 그 순간에 다시 받는다. 서버 시계가 조금 늦어 지난 초기화를 다시 주면
 * 1분 뒤 묻고, 한 달 뒤 초기화는 타이머 상한을 넘지 않게 하루마다 다시 잰다
 */
export function getEntitlementsRefetchInterval(
  snapshot: EntitlementSnapshot | undefined,
  now: Instant,
): number | false {
  const resetsAt = snapshot == null ? null : EntitlementPolicy.findEarliestResetAt(snapshot);
  if (resetsAt == null) {
    return false;
  }
  return clamp(diffMs(resetsAt, now), MINUTE_MS, DAY_MS);
}

export function invalidateEntitlements(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ENTITLEMENT_QUERY_KEYS.snapshot() });
}
