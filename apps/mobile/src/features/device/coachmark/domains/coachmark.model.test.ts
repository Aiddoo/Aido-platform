import { CoachmarkPolicy } from './coachmark.model';

describe('shouldShow', () => {
  it.each([
    { title: '끝낸 기록이 없으면 보인다', completedAt: null, expected: true },
    {
      title: '한 번 끝냈으면 기간과 상관없이 다시 띄우지 않는다',
      completedAt: '2026-01-01T00:00:00.000Z',
      expected: false,
    },
    { title: '원문이 시각이 아니어도 키가 있으면 끝낸 것이다', completedAt: '', expected: false },
  ])('$title', ({ completedAt, expected }) => {
    // When
    const result = CoachmarkPolicy.shouldShow({ kind: 'friend-strip', completedAt });

    // Then
    expect(result).toBe(expected);
  });
});

describe('isReadLongEnough', () => {
  it.each([
    { title: '열리자마자 넘기면 읽지 않은 것으로 본다', visibleMs: 0, expected: false },
    {
      title: '달을 연달아 넘기는 간격(800ms)은 읽지 않은 것으로 본다',
      visibleMs: 800,
      expected: false,
    },
    { title: '2초에 1ms 모자라면 읽지 않은 것으로 본다', visibleMs: 1_999, expected: false },
    { title: '2초 보면 읽은 것으로 본다', visibleMs: 2_000, expected: true },
    { title: '2초를 1ms 넘기면 읽은 것으로 본다', visibleMs: 2_001, expected: true },
    { title: '한참 보면 읽은 것으로 본다', visibleMs: 30_000, expected: true },
  ])('$title', ({ visibleMs, expected }) => {
    // Given
    const display = { openedAtMs: 1_000_000 };

    // When
    const result = CoachmarkPolicy.isReadLongEnough(display, display.openedAtMs + visibleMs);

    // Then
    expect(result).toBe(expected);
  });
});
