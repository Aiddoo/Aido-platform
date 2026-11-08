import { SECOND_MS } from '@src/shared/constants/time-units';

// 타이머 횟수가 아니라 시각 차이로 세어 iOS 백그라운드에서 타이머가 멈춰도 맞는다
export function getRemainingCooldownSeconds(deadlineMs: number | null, nowMs: number): number {
  if (deadlineMs == null) {
    return 0;
  }
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / SECOND_MS));
}

export function getMsUntilNextCooldownTick(deadlineMs: number, nowMs: number): number {
  const remainderMs = (deadlineMs - nowMs) % SECOND_MS;
  return remainderMs > 0 ? remainderMs : SECOND_MS;
}
