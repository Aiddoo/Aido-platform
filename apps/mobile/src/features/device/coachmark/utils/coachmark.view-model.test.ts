import { fromEpochMs } from '@src/shared/date/instant';

import { isReadLongEnough } from './coachmark.view-model';

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
    const openedAtMs = 1_000_000;

    // When
    const result = isReadLongEnough(fromEpochMs(openedAtMs), fromEpochMs(openedAtMs + visibleMs));

    // Then
    expect(result).toBe(expected);
  });
});
