import { SECOND_MS } from '@src/shared/constants/time-units';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getMsUntilNextCooldownTick, getRemainingCooldownSeconds } from '../utils/cooldown';

/**
 * 다시 보내기까지 남은 초와 시작 함수. 마감 시각을 두고 지금과의 차이로 센다.
 * 1초 타이머를 이어 세면 iOS 백그라운드에서 타이머가 멈춘 만큼 늦어지므로, 틱과 앱 복귀 때 다시 계산한다
 */
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
