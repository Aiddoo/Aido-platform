import { range } from 'es-toolkit';

import { getExponentialBackoffMs } from './get-exponential-backoff-ms';

describe('getExponentialBackoffMs', () => {
  it.each([
    [
      '조회 재시도는 1초에서 두 배씩 늘고 5초에서 멈춘다',
      { baseMs: 1000, maxMs: 5000 },
      [1000, 2000, 4000, 5000, 5000, 5000],
    ],
    ['댓글 재시도는 0.5초에서 1초로 늘고 멈춘다', { baseMs: 500, maxMs: 1000 }, [500, 1000, 1000]],
    [
      '요약 날짜 따라잡기는 상한 없이 5초에서 두 배씩 는다',
      { baseMs: 5000 },
      [5000, 10_000, 20_000, 40_000],
    ],
  ])('%s', (_case, backoff, expected) => {
    // When
    const delays = range(expected.length).map((attempt) =>
      getExponentialBackoffMs(attempt, backoff),
    );

    // Then
    expect(delays).toEqual(expected);
  });

  it('jitter를 주면 그 시도의 상한에 난수를 곱해 내림한다', () => {
    // Given
    const backoff = { baseMs: 1000, maxMs: 60_000, random: () => 0.5 };

    // When
    const delays = range(8).map((attempt) => getExponentialBackoffMs(attempt, backoff));

    // Then
    expect(delays).toEqual([500, 1000, 2000, 4000, 8000, 16_000, 30_000, 30_000]);
  });

  it.each([
    ['난수가 0이면 0이다', 0, 0],
    ['난수가 1에 가까워도 상한보다 짧다', 0.999, 59_940],
  ])('%s', (_case, randomValue, expected) => {
    // When
    const delayMs = getExponentialBackoffMs(10, {
      baseMs: 1000,
      maxMs: 60_000,
      random: () => randomValue,
    });

    // Then
    expect(delayMs).toBe(expected);
  });
});
