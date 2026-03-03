import { getDayOfWeekFromDate } from './day-of-week';

describe('getDayOfWeekFromDate', () => {
  test.each([
    ['2025-03-17', 'MON'],
    ['2025-03-18', 'TUE'],
    ['2025-03-19', 'WED'],
    ['2025-03-20', 'THU'],
    ['2025-03-21', 'FRI'],
    ['2025-03-22', 'SAT'],
    ['2025-03-23', 'SUN'],
  ])('%s Date를 넘기면 %s를 반환해야 한다', (dateString, expectedDayOfWeek) => {
    // Given
    const targetDate = new Date(dateString);

    // When
    const result = getDayOfWeekFromDate(targetDate);

    // Then
    expect(result).toBe(expectedDayOfWeek);
  });
});
