import { range } from 'es-toolkit';

import { findWeekRangeBand } from './repeat-calendar.geometry';

describe('findWeekRangeBand', () => {
  const day = (overrides: Partial<Parameters<typeof findWeekRangeBand>[0][number]> = {}) => ({
    isInRange: false,
    isRangeStart: false,
    isRangeEnd: false,
    ...overrides,
  });
  const week = (overrides: Record<number, Parameters<typeof day>[0]>) =>
    range(7).map((index) => day(overrides[index]));

  it('시작 칸 가운데부터 끝 칸 가운데까지 한 덩어리로 칠한다', () => {
    // Given
    const days = week({
      1: { isRangeStart: true },
      2: { isInRange: true },
      3: { isRangeEnd: true },
    });

    // When
    const band = findWeekRangeBand(days);

    // Then
    expect(band).toEqual({ startRatio: 1.5 / 7, endRatio: 3.5 / 7 });
  });

  it('주 전체가 기간 안이면 양 끝까지 칠한다', () => {
    // Given
    const days = range(7).map(() => day({ isInRange: true }));

    // When
    const band = findWeekRangeBand(days);

    // Then
    expect(band).toEqual({ startRatio: 0, endRatio: 1 });
  });

  it('기간에 걸리지 않는 주는 띠가 없다', () => {
    // Given
    const days = week({});

    // When
    const band = findWeekRangeBand(days);

    // Then
    expect(band).toBeNull();
  });
});
