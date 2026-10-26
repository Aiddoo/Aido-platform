import { getDayOfWeekFromDate, hasSelectedDayInRange } from './day-of-week';

describe('getDayOfWeekFromDate', () => {
  test.each([
    [17, 'MON'],
    [18, 'TUE'],
    [19, 'WED'],
    [20, 'THU'],
    [21, 'FRI'],
    [22, 'SAT'],
    [23, 'SUN'],
  ])('2025-03-%s 로컬 날짜를 넘기면 %s를 반환해야 한다', (dayOfMonth, expectedDayOfWeek) => {
    // Given
    const targetDate = new Date(2025, 2, dayOfMonth);

    // When
    const result = getDayOfWeekFromDate(targetDate);

    // Then
    expect(result).toBe(expectedDayOfWeek);
  });
});

describe('hasSelectedDayInRange', () => {
  test('범위 안에 선택한 요일이 있으면 true를 반환해야 한다', () => {
    // Given: 2026-03-16(월) ~ 2026-03-22(일), 수요일 선택
    const startDate = new Date(2026, 2, 16);
    const endDate = new Date(2026, 2, 22);

    // When
    const result = hasSelectedDayInRange(startDate, endDate, ['WED']);

    // Then
    expect(result).toBe(true);
  });

  test('범위 안에 선택한 요일이 없으면 false를 반환해야 한다', () => {
    // Given: 2026-03-17(화) ~ 2026-03-18(수), 금요일 선택
    const startDate = new Date(2026, 2, 17);
    const endDate = new Date(2026, 2, 18);

    // When
    const result = hasSelectedDayInRange(startDate, endDate, ['FRI']);

    // Then
    expect(result).toBe(false);
  });

  test('시작일과 종료일이 같은 날이고 해당 요일이 선택되어 있으면 true를 반환해야 한다', () => {
    // Given: 2026-03-18(수) 하루, 수요일 선택
    const date = new Date(2026, 2, 18);

    // When
    const result = hasSelectedDayInRange(date, date, ['WED']);

    // Then
    expect(result).toBe(true);
  });

  test('시작일과 종료일이 같은 날이고 다른 요일이 선택되어 있으면 false를 반환해야 한다', () => {
    // Given: 2026-03-18(수) 하루, 목요일 선택
    const date = new Date(2026, 2, 18);

    // When
    const result = hasSelectedDayInRange(date, date, ['THU']);

    // Then
    expect(result).toBe(false);
  });

  test('선택된 요일이 비어있으면 false를 반환해야 한다', () => {
    // Given
    const startDate = new Date(2026, 2, 16);
    const endDate = new Date(2026, 2, 22);

    // When
    const result = hasSelectedDayInRange(startDate, endDate, []);

    // Then
    expect(result).toBe(false);
  });

  test('여러 요일 중 하나라도 범위에 포함되면 true를 반환해야 한다', () => {
    // Given: 2026-03-17(화) ~ 2026-03-18(수), 금/수 선택
    const startDate = new Date(2026, 2, 17);
    const endDate = new Date(2026, 2, 18);

    // When
    const result = hasSelectedDayInRange(startDate, endDate, ['FRI', 'WED']);

    // Then
    expect(result).toBe(true);
  });

  test('DST가 시작되는 날이 낀 범위도 마지막 날 요일을 포함한다', () => {
    // Given: 2026-03-08(일) ~ 2026-03-09(월). LA 등 DST 시간대에서는 두 자정 사이가 23시간이다
    const startDate = new Date(2026, 2, 8);
    const endDate = new Date(2026, 2, 9);

    // When
    const result = hasSelectedDayInRange(startDate, endDate, ['MON']);

    // Then
    expect(result).toBe(true);
  });
});
