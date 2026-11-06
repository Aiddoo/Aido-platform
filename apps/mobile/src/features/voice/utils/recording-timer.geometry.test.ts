import { getRecordingRingLayout } from './recording-timer.geometry';

describe('getRecordingRingLayout', () => {
  test.each([
    { name: '큰 폰은 원래 크기', windowHeight: 915, size: 156 },
    { name: '보통 폰도 원래 크기', windowHeight: 700, size: 156 },
    { name: '360x640 폰은 비율대로 조금 줄인다', windowHeight: 640, size: 154 },
    { name: 'iPhone SE 1세대', windowHeight: 568, size: 136 },
    { name: '아주 낮은 창에서도 글자가 들어갈 크기는 지킨다', windowHeight: 320, size: 112 },
  ])('$name: $size', ({ windowHeight, size }) => {
    // When
    const result = getRecordingRingLayout(windowHeight);

    // Then
    expect(result.size).toBe(size);
  });

  test('선을 포함한 원이 그리는 칸 안에 들어가고 글자 칸은 원 안쪽에 있다', () => {
    // When
    const { size, radius, strokeWidth, textWidth } = getRecordingRingLayout(640);

    // Then
    expect(2 * radius + strokeWidth).toBe(size);
    expect(textWidth).toBeLessThan(2 * radius - strokeWidth);
  });
});
