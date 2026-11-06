import { VOICE_FRAME_BUDGET } from '../constants/voice.constants';

export function addFrameTime(slowMs: number, frameMs: number): number {
  'worklet';
  if (frameMs >= VOICE_FRAME_BUDGET.ignoreFrameMs) {
    return slowMs;
  }
  return frameMs > VOICE_FRAME_BUDGET.slowFrameMs
    ? slowMs + frameMs
    : Math.max(0, slowMs - frameMs);
}

export function shouldUseLightOrb(slowMs: number): boolean {
  'worklet';
  return slowMs >= VOICE_FRAME_BUDGET.sustainedSlowMs;
}
