import { useEntitlementApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { DAY_MS, MINUTE_MS } from '@src/shared/constants/time-units';
import { getNowInstant } from '@src/shared/date/clock';
import { diffMs, type Instant } from '@src/shared/date/instant';
import { queryOptions } from '@tanstack/react-query';
import { clamp } from 'es-toolkit';

import { EntitlementPolicy, type EntitlementSnapshot } from '../domains/entitlement.model';
import { ENTITLEMENT_QUERY_KEYS } from './entitlement-query-keys';

/** 한도·사용량이 서버에서 바뀌어도 1분 안에는 다시 묻지 않는다. AI 응답의 featureQuota가 그 사이를 채운다 */
const ENTITLEMENTS_STALE_TIME_MS = MINUTE_MS;
/** 초기화 순간에 다시 받되, 한 달 뒤 초기화는 타이머 상한을 넘지 않게 하루마다 다시 잰다 */
const ENTITLEMENTS_REFETCH_INTERVAL_MS = { min: MINUTE_MS, max: DAY_MS } as const;

export function selectHasFullAccess(snapshot: EntitlementSnapshot): boolean {
  return EntitlementPolicy.hasFullAccess(snapshot);
}

/** 남은 횟수는 초기화 순간(resetsAt)에 바뀌므로 그 순간에 다시 받는다. 올 초기화가 없으면 시각으로 묻지 않는다(false) */
export function getEntitlementsRefetchIntervalMs(
  snapshot: EntitlementSnapshot,
  now: Instant,
): number | false {
  const nextResetAt = EntitlementPolicy.findNextResetAt(snapshot, now);
  if (nextResetAt == null) {
    return false;
  }
  return clamp(
    diffMs(nextResetAt, now),
    ENTITLEMENTS_REFETCH_INTERVAL_MS.min,
    ENTITLEMENTS_REFETCH_INTERVAL_MS.max,
  );
}

export function useGetEntitlementsQueryOptions() {
  const entitlementApi = useEntitlementApi();
  return queryOptions({
    queryKey: ENTITLEMENT_QUERY_KEYS.snapshot(),
    queryFn: async ({ signal }) => unwrap(await entitlementApi.getEntitlements(signal)),
    staleTime: ENTITLEMENTS_STALE_TIME_MS,
    // 화면을 켜 둔 채 자정·월초를 넘겨도 "1번 남음"이 남지 않게 초기화 순간에 다시 받는다
    refetchInterval: ({ state: { data: snapshot } }) =>
      snapshot == null ? false : getEntitlementsRefetchIntervalMs(snapshot, getNowInstant()),
    // 오프라인으로 다시 열어도 구독 화면·프리미엄 판정이 마지막 서버 값을 유지한다
    ...PERSISTED_QUERY_OPTIONS,
    meta: { ...PERSISTED_QUERY_OPTIONS.meta, refreshOnPremiumChange: true },
  });
}
