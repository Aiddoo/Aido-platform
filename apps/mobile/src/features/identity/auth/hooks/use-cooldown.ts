import { SECOND_MS } from '@src/shared/constants/time-units';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getMsUntilNextCooldownTick, getRemainingCooldownSeconds } from '../utils/cooldown';

/** 1초 타이머를 이어 세면 iOS 백그라운드에서 멈춘 만큼 늦어져 마감 시각과의 차이를 틱과 앱 복귀 때 다시 계산한다 */
export function useCooldown() {
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const cooldown = getRemainingCooldownSeconds(deadlineMs, nowMs);

  useEffect(() => {
    if (deadlineMs == null || cooldown <= 0) {
      return;
    }
    const timer = setTimeout(
      () => setNowMs(Date.now()),
      getMsUntilNextCooldownTick(deadlineMs, nowMs),
    );
    return () => clearTimeout(timer);
  }, [deadlineMs, nowMs, cooldown]);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNowMs(Date.now());
      }
    });
    return () => subscription.remove();
  }, [cooldown]);

  const startCooldown = useCallback((seconds: number) => {
    const startedAtMs = Date.now();
    setNowMs(startedAtMs);
    setDeadlineMs(startedAtMs + seconds * SECOND_MS);
  }, []);

  return [cooldown, startCooldown] as const;
}
