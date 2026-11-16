import { createDateKey } from '@src/testing/date-key';
import { range } from 'es-toolkit';

import { getRecentTrendWeeks, getTrendIsoWeekYears } from './report-chart.view-model';

describe('getTrendIsoWeekYears', () => {
  it.each([
    ['1월 초에는 추세 첫 주가 속한 지난해도 읽는다', '2027-01-12', 2026, 2027],
    ['연말 ISO 주가 다음 해면 그 해가 끝 해다', '2026-12-30', 2026, 2026],
    ['8주 전도 올해면 한 해만 읽는다', '2026-11-17', 2026, 2026],
  ] as const)('%s', (_name, today, startYear, endYear) => {
    // When
    const years = getTrendIsoWeekYears(createDateKey(today));

    // Then
    expect(years).toEqual({ startYear, endYear });
  });
});

describe('getRecentTrendWeeks', () => {
  it('지난해와 올해 목록을 합쳐 최근 8주를 오래된 주부터 둔다', () => {
    // Given
    const lastYear = [
      { startDate: createDateKey('2026-12-28'), completionRate: 70 },
      { startDate: createDateKey('2026-12-21'), completionRate: 60 },
      { startDate: createDateKey('2026-12-14'), completionRate: 50 },
      { startDate: createDateKey('2026-12-07'), completionRate: 40 },
      { startDate: createDateKey('2026-11-30'), completionRate: 30 },
      { startDate: createDateKey('2026-11-23'), completionRate: 20 },
      { startDate: createDateKey('2026-11-16'), completionRate: 10 },
    ];
    const thisYear = [
      { startDate: createDateKey('2027-01-11'), completionRate: 90 },
      { startDate: createDateKey('2027-01-04'), completionRate: 80 },
    ];

    // When
    const weeks = getRecentTrendWeeks([...thisYear, ...lastYear]);

    // Then
    expect(weeks.map((week) => week.completionRate)).toEqual([20, 30, 40, 50, 60, 70, 80, 90]);
  });

  it('두 해가 같아 같은 목록이 두 번 와도 주마다 한 번만 센다', () => {
    // Given
    const weeks = range(3).map((index) => ({
      startDate: createDateKey(`2026-11-0${index + 2}`),
      completionRate: index * 10,
    }));

    // When
    const recent = getRecentTrendWeeks([...weeks, ...weeks]);

    // Then
    expect(recent).toEqual(weeks);
  });
});
