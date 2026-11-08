import { SECOND_MS } from '@src/shared/constants/time-units';

/**
 * 마감 시각(epoch ms)까지 남은 초. 남은 0.2초도 1초로 보이게 올리고, 지났거나 시작하지 않았으면 0이다.
 * 타이머 횟수가 아니라 시각 차이로 세어 iOS 백그라운드에서 타이머가 멈췄다 와도 맞는다
 */
export function getRemainingCooldownSeconds(deadlineMs: number | null, nowMs: number): number {
  if (deadlineMs == null) {
    return 0;
  }
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / SECOND_MS));
}

/** 남은 초 글자가 다음에 바뀌는 순간까지의 ms. 마감에서 초 단위로 떨어지는 경계에 맞춘다 */
export function getMsUntilNextCooldownTick(deadlineMs: number, nowMs: number): number {
  const remainderMs = (deadlineMs - nowMs) % SECOND_MS;
  return remainderMs > 0 ? remainderMs : SECOND_MS;
}
