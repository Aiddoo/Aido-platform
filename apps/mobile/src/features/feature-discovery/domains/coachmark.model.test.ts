import { isReadLongEnough } from './coachmark.model';

describe('CoachmarkPolicy', () => {
  test.each([
    { name: '열리자마자 넘긴 경우', visibleMs: 0, expected: false },
    { name: '달을 연달아 넘기는 간격', visibleMs: 800, expected: false },
    { name: '읽을 시간을 준 경우', visibleMs: 2_000, expected: true },
    { name: '한참 본 경우', visibleMs: 30_000, expected: true },
  ])('$name: $expected', ({ visibleMs, expected }) => {
    // When
    const result = isReadLongEnough(visibleMs);

    // Then
    expect(result).toBe(expected);
  });
});
