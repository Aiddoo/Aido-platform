import { getDurationBucket } from './voice-analytics';

describe('getDurationBucket', () => {
  it.each([
    [0, 'lt_30s'],
    [29_999, 'lt_30s'],
    [30_000, '30s_3m'],
    [180_000, '3m_10m'],
    [600_000, '10m_30m'],
  ] as const)('%dms는 %s 구간이다', (elapsedMs, bucket) => {
    // When
    const result = getDurationBucket(elapsedMs);

    // Then
    expect(result).toBe(bucket);
  });
});
