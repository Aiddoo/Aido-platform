import { VOICE_FRAME_BUDGET } from '../../constants/voice.constants';
import { addFrameTime, shouldUseLightOrb } from './voice-frame-budget.view-model';

const SLOW_FRAME = VOICE_FRAME_BUDGET.slowFrameMs + 10;
const FAST_FRAME = 16;

function runFrames(frames: readonly number[], from = 0) {
  return frames.reduce(addFrameTime, from);
}

describe('저사양 판단', () => {
  it('느린 프레임이 일정 시간 이어지면 가벼운 구로 내린다', () => {
    // Given
    const frameCount = Math.ceil(VOICE_FRAME_BUDGET.sustainedSlowMs / SLOW_FRAME);

    // When
    const slowMs = runFrames(Array.from({ length: frameCount }, () => SLOW_FRAME));

    // Then
    expect(shouldUseLightOrb(slowMs)).toBe(true);
  });

  it('잠깐 느렸다가 빨라지면 쌓인 시간이 줄어 내리지 않는다', () => {
    // Given
    const hiccup = Array.from({ length: 20 }, () => SLOW_FRAME);
    const recovered = Array.from({ length: 200 }, () => FAST_FRAME);

    // When
    const slowMs = runFrames([...hiccup, ...recovered]);

    // Then
    expect(slowMs).toBe(0);
    expect(shouldUseLightOrb(slowMs)).toBe(false);
  });

  it('앱을 다녀와 프레임이 크게 벌어진 것은 세지 않는다', () => {
    // When
    const slowMs = addFrameTime(100, VOICE_FRAME_BUDGET.ignoreFrameMs);

    // Then
    expect(slowMs).toBe(100);
  });
});
