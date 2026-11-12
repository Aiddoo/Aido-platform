import { SECOND_MS } from '@src/shared/constants/time-units';
import { getNowInstant } from '@src/shared/date/clock';
import { fromEpochMs, toEpochMs } from '@src/shared/date/instant';
import { useNow } from '@src/shared/hooks/use-now';
import { useCallback, useState } from 'react';

import { getRemainingCooldownSeconds } from '../utils/cooldown.view-model';

/** 1초 타이머를 이어 세면 iOS 백그라운드에서 멈춘 만큼 늦어져 마감 시각과의 차이를 틱과 앱 복귀 때 다시 계산한다 */
export function useCooldown() {
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const now = useNow({
    tickMs: SECOND_MS,
    until: deadlineMs == null ? null : fromEpochMs(deadlineMs),
    isEnabled: deadlineMs != null,
  });
  const cooldown = getRemainingCooldownSeconds(deadlineMs, toEpochMs(now));

  const startCooldown = useCallback((seconds: number) => {
    setDeadlineMs(toEpochMs(getNowInstant()) + seconds * SECOND_MS);
  }, []);

  return [cooldown, startCooldown] as const;
}
