import { findPartSeek, getRecordingIndexAt } from './voice-note-playback.model';

const PARTS = [{ startMs: 0 }, { startMs: 60_000 }];

describe('getRecordingIndexAt', () => {
  const recordings = [{ startMs: 0 }, { startMs: 30_000 }, { startMs: 90_000 }];

  it.each([
    [0, 0],
    [29_999, 0],
    [30_000, 1],
    [120_000, 2],
  ])('%dms는 %d번째 조각이다', (positionMs, index) => {
    // When
    const found = getRecordingIndexAt(recordings, positionMs);

    // Then
    expect(found).toBe(index);
  });
});

describe('findPartSeek', () => {
  it('위치가 속한 조각과 그 안의 초를 찾는다', () => {
    // When
    const seek = findPartSeek(PARTS, 70_000, 120_000);

    // Then
    expect(seek).toEqual({ index: 1, offsetSeconds: 10 });
  });

  it('전체 길이를 넘으면 끝으로 맞춘다', () => {
    // When
    const seek = findPartSeek(PARTS, 500_000, 120_000);

    // Then
    expect(seek).toEqual({ index: 1, offsetSeconds: 60 });
  });

  it('조각이 없으면 옮기지 않는다', () => {
    // When
    const seek = findPartSeek([], 1_000, 120_000);

    // Then
    expect(seek).toBeNull();
  });
});
