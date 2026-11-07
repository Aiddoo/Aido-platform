import { fromEpochMs, type Instant } from '@src/shared/date/instant';
import { useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { createMinuteClockStore } from './minute-clock-store';

const minuteClock = createMinuteClockStore({
  now: () => Date.now(),
  listenForeground: (onChange) => {
    const subscription = AppState.addEventListener('change', (state) =>
      onChange(state === 'active'),
    );
    return () => subscription.remove();
  },
});

/**
 * 분 단위로만 바뀌는 현재 시각. 저장 캐시를 오프라인에서 복원해도 받은 시각이 아니라 실제 지금을 기준으로
 * "지금" 칸·지난 시간·오래된 정보 안내를 정한다. 같은 분 안에서는 같은 값을 돌려준다.
 */
export function useMinuteNow(): Instant {
  const minuteStartMs = useSyncExternalStore(minuteClock.subscribe, minuteClock.getSnapshot);
  return useMemo(() => fromEpochMs(minuteStartMs), [minuteStartMs]);
}
