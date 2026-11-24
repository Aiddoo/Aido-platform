import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { range } from 'es-toolkit';
import { useEffect, useState } from 'react';

import { DEMO_SCRIPT_START_DELAY_MS } from '../constants/whats-new.constants';

interface DemoScriptInput {
  frameCount: number;
  frameMs: number;
  startDelayMs?: number;
}

/** 예시 장면 번호를 한 번만 넘긴다. 프레임이 아니라 장면마다 다시 그려 저사양 기기에서도 가볍다 */
export function useDemoScript({
  frameCount,
  frameMs,
  startDelayMs = DEMO_SCRIPT_START_DELAY_MS,
}: DemoScriptInput): number {
  const isReducedMotion = useIsReduceMotionEnabled();
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (isReducedMotion) {
      return;
    }
    const timers = range(1, frameCount + 1).map((next) =>
      setTimeout(() => setFrame(next), startDelayMs + (next - 1) * frameMs),
    );
    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [frameCount, frameMs, isReducedMotion, startDelayMs]);

  return isReducedMotion ? frameCount : frame;
}
