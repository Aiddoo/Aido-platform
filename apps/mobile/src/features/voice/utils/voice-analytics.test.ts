import { getDurationBucket, toCaptureOutcome } from './voice-analytics';

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

describe('toCaptureOutcome', () => {
  it('정리 단계로 갔으면 completed, 아니면 empty다', () => {
    // When
    const planning = toCaptureOutcome({ status: 'planning' });
    const idle = toCaptureOutcome({ status: 'idle' });

    // Then
    expect(planning).toBe('completed');
    expect(idle).toBe('empty');
  });
});
