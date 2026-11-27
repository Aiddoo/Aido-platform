import { createDateKey } from '@src/testing/date-key';

import { getWeeklyRecordDays } from './weekly-record.view-model';

describe('getWeeklyRecordDays', () => {
  it('일요일이면 그 주 월요일부터 7일이 모두 지난 날이다', () => {
    // When
    const days = getWeeklyRecordDays({}, createDateKey('2026-11-22'));

    // Then
    expect(days.map((day) => day.date)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ]);
    expect(days.some((day) => day.isUpcoming)).toBe(false);
  });

  it('윤일이 든 주는 2월 29일을 지나 3월로 이어진다', () => {
    // When
    const days = getWeeklyRecordDays({}, createDateKey('2028-02-29'));

    // Then
    expect(days.map((day) => day.date)).toContain('2028-02-29');
    expect(days.at(-1)?.date).toBe('2028-03-05');
  });

  it('아직 오지 않은 날은 기록이 없어도 0이 아니라 아직으로 구분한다', () => {
    // Given
    const completions = { '2026-11-16': { totalTodos: 3, completedTodos: 2 } };

    // When
    const days = getWeeklyRecordDays(completions, createDateKey('2026-11-18'));

    // Then
    expect(days.map((day) => day.isUpcoming)).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
      true,
    ]);
    expect(days[0]).toMatchObject({ total: 3, completed: 2 });
    expect(days[1]).toMatchObject({ total: 0, completed: 0, isUpcoming: false });
  });
});
