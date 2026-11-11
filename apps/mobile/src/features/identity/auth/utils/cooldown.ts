import { SECOND_MS } from '@src/shared/constants/time-units';

/** deadlineMs는 epoch ms다. 남은 0.2초도 1초로 올리고, 지났거나 시작하지 않았으면 0이다 */
export function getRemainingCooldownSeconds(deadlineMs: number | null, nowMs: number): number {
  if (deadlineMs == null) {
    return 0;
  }
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / SECOND_MS));
}
