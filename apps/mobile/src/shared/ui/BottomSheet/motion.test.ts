import { resolveSheetAnimationDuration } from './motion';

describe('resolveSheetAnimationDuration', () => {
  it('모션 감소가 켜지면 애니메이션 시간을 0으로 만든다', () => {
    // When
    const result = resolveSheetAnimationDuration(true, 300);

    // Then
    expect(result).toBe(0);
  });

  it('모션 감소가 꺼지면 기존 애니메이션 시간을 유지한다', () => {
    // When
    const result = resolveSheetAnimationDuration(false, 300);

    // Then
    expect(result).toBe(300);
  });
});
