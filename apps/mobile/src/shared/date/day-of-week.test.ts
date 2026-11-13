import type { DayOfWeek } from '@aido/api/vocabulary';
import { createDateKey } from '@src/testing/date-key';

import { getDateKeyDayOfWeek, hasSameDaysOfWeek, sortDaysOfWeek } from './day-of-week';

describe('sortDaysOfWeek', () => {
  it('저장 순서와 상관없이 월요일부터 일요일 순서로 정렬한다', () => {
    // Given
    const days: DayOfWeek[] = ['SUN', 'WED', 'MON'];

    // When
    const result = sortDaysOfWeek(days);

    // Then
    expect(result).toEqual(['MON', 'WED', 'SUN']);
  });

  it('겹친 요일은 한 번만 남긴다', () => {
    // Given
    const days: DayOfWeek[] = ['FRI', 'FRI', 'TUE'];

    // When
    const result = sortDaysOfWeek(days);

    // Then
    expect(result).toEqual(['TUE', 'FRI']);
  });

  it('요일이 없으면 빈 목록이다', () => {
    // When
    const result = sortDaysOfWeek([]);

    // Then
    expect(result).toEqual([]);
  });
});

describe('hasSameDaysOfWeek', () => {
  it.each<{ title: string; days: DayOfWeek[]; expected: DayOfWeek[]; result: boolean }>([
    {
      title: '순서만 다르면 같은 요일들이다',
      days: ['FRI', 'MON'],
      expected: ['MON', 'FRI'],
      result: true,
    },
    {
      title: '요일 하나가 빠지면 다르다',
      days: ['MON', 'TUE', 'WED', 'THU'],
      expected: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      result: false,
    },
    {
      title: '요일 하나가 더 있으면 다르다',
      days: ['SAT', 'SUN', 'MON'],
      expected: ['SAT', 'SUN'],
      result: false,
    },
    {
      title: '개수가 같아도 요일이 다르면 다르다',
      days: ['SAT', 'MON'],
      expected: ['SAT', 'SUN'],
      result: false,
    },
    { title: '둘 다 비어 있으면 같다', days: [], expected: [], result: true },
  ])('$title', ({ days, expected, result }) => {
    // When
    const isSame = hasSameDaysOfWeek(days, expected);

    // Then
    expect(isSame).toBe(result);
  });
});

describe('getDateKeyDayOfWeek', () => {
  it.each<{ dateKey: string; expected: DayOfWeek }>([
    // 2026-11-01은 일요일이다
    { dateKey: '2026-11-01', expected: 'SUN' },
    { dateKey: '2026-11-02', expected: 'MON' },
    { dateKey: '2026-11-07', expected: 'SAT' },
    // 해가 바뀌어도 이어진다: 2026-12-31 목요일 → 2027-01-01 금요일
    { dateKey: '2026-12-31', expected: 'THU' },
    { dateKey: '2027-01-01', expected: 'FRI' },
  ])('$dateKey는 $expected다', ({ dateKey, expected }) => {
    // When
    const result = getDateKeyDayOfWeek(createDateKey(dateKey));

    // Then
    expect(result).toBe(expected);
  });
});
