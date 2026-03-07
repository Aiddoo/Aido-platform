import type { DayOfWeek } from '@aido/validators';
import { formatDaysOfWeek, getDayOfWeekLabel } from './date';

describe('formatDaysOfWeek', () => {
  it('여러 요일을 순서대로 정렬하여 한글로 변환해야 한다', () => {
    // Given
    const days: DayOfWeek[] = ['FRI', 'MON', 'WED'];

    // When
    const result = formatDaysOfWeek(days);

    // Then
    expect(result).toBe('월, 수, 금');
  });

  it('단일 요일을 한글로 변환해야 한다', () => {
    // Given
    const days: DayOfWeek[] = ['TUE'];

    // When
    const result = formatDaysOfWeek(days);

    // Then
    expect(result).toBe('화');
  });

  it('전체 요일을 일~토 순서로 변환해야 한다', () => {
    // Given
    const days: DayOfWeek[] = ['SUN', 'SAT', 'FRI', 'THU', 'WED', 'TUE', 'MON'];

    // When
    const result = formatDaysOfWeek(days);

    // Then
    expect(result).toBe('일, 월, 화, 수, 목, 금, 토');
  });

  it('빈 배열이면 빈 문자열을 반환해야 한다', () => {
    // Given
    const days: DayOfWeek[] = [];

    // When
    const result = formatDaysOfWeek(days);

    // Then
    expect(result).toBe('');
  });

  it('원본 배열을 변경하지 않아야 한다', () => {
    // Given
    const days: DayOfWeek[] = ['FRI', 'MON'];

    // When
    formatDaysOfWeek(days);

    // Then
    expect(days).toEqual(['FRI', 'MON']);
  });
});

describe('getDayOfWeekLabel', () => {
  it.each([
    ['MON', '월'],
    ['TUE', '화'],
    ['WED', '수'],
    ['THU', '목'],
    ['FRI', '금'],
    ['SAT', '토'],
    ['SUN', '일'],
  ] as const)('%s → %s 한글 라벨을 반환해야 한다', (day, expected) => {
    // Given — day: %s

    // When
    const result = getDayOfWeekLabel(day);

    // Then
    expect(result).toBe(expected);
  });
});
