import { fromEpochMs, type Instant } from '@src/shared/date/instant';
import { useMinuteClock } from '@src/shared/di/shared-di-context';
import { useMemo, useSyncExternalStore } from 'react';

/** 저장 캐시를 오프라인에서 복원해도 받은 시각이 아니라 실제 지금을 기준으로 하도록 분 단위로 갱신한다 */
export function useMinuteNow(): Instant {
  const minuteClock = useMinuteClock();
  const minuteStartMs = useSyncExternalStore(minuteClock.subscribe, minuteClock.getSnapshot);
  return useMemo(() => fromEpochMs(minuteStartMs), [minuteStartMs]);
}
