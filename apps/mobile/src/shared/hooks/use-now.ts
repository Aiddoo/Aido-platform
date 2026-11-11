import { diffMs, getNowInstant, hasInstantPassed, type Instant } from '@src/shared/date/instant';
import { useOnAppForeground } from '@src/shared/hooks/use-on-app-foreground';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface UseNowOptions {
  /** 지금을 다시 읽는 간격. `until`이 있으면 `until`에서 이 간격으로 떨어지는 순간에 읽는다 */
  tickMs?: number;
  /** 이 순간까지만 다시 읽는다. `tickMs`가 없으면 이 순간에 한 번 읽고 멈춘다. 지났으면 더 읽지 않는다 */
  until?: Instant | null;
  /** 꺼 두면 타이머를 걸지 않는다. 다시 켜는 순간 지금을 새로 읽는다 */
  isEnabled?: boolean;
}

/** 다음에 지금을 읽을 때까지의 ms. 남은 시간이 간격으로 떨어지지 않으면 그 나머지에 맞춘다 */
function getNextReadDelayMs({
  now,
  tickMs,
  until,
}: {
  now: Instant;
  tickMs: number | undefined;
  until: Instant | null;
}): number | null {
  if (until == null) {
    return tickMs ?? null;
  }
  const remainingMs = diffMs(until, now);
  if (tickMs == null) {
    return remainingMs;
  }
  const remainderMs = remainingMs % tickMs;
  return remainderMs > 0 ? remainderMs : tickMs;
}

/**
 * 지금 시각. 백그라운드에서 타이머가 멈췄을 수 있어 앱으로 돌아오면 다시 읽는다.
 * 분 단위로 여러 곳이 함께 쓰는 시각은 `useMinuteNow`다
 */
export function useNow({ tickMs, until = null, isEnabled = true }: UseNowOptions = {}): Instant {
  const [now, setNow] = useState(getNowInstant);
  const isPastUntil = until != null && hasInstantPassed(until, now);
  const delayMs = isEnabled && !isPastUntil ? getNextReadDelayMs({ now, tickMs, until }) : null;

  // 켜지거나 끝나는 순간이 바뀌면 그 순간의 시각으로 바로 맞춰 첫 tick 전까지 시각이 틀리지 않게 한다
  const previousInputRef = useRef({ isEnabled, until });
  useLayoutEffect(() => {
    const previous = previousInputRef.current;
    previousInputRef.current = { isEnabled, until };
    if (isEnabled && (!previous.isEnabled || previous.until !== until)) {
      setNow(getNowInstant());
    }
  }, [isEnabled, until]);

  useEffect(() => {
    if (delayMs == null) {
      return;
    }
    const timer = setTimeout(() => setNow(getNowInstant()), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs, now]);

  useOnAppForeground(() => {
    if (delayMs != null) {
      setNow(getNowInstant());
    }
  });

  return now;
}
