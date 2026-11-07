import {
  addLocalDays,
  addLocalMonths,
  diffLocalMonths,
  startOfLocalDay,
  startOfLocalMonth,
  withLocalMonthOf,
} from './local-day';

const SEOUL = 'Asia/Seoul';
const LOS_ANGELES = 'America/Los_Angeles';

describe('설정 시간대 기준 달력 칸 계산', () => {
  test('자정 직전은 그 날이고 정각은 다음 날이다', () => {
    // Given
    const beforeMidnight = new Date('2026-06-10T14:59:59.999Z');
    const atMidnight = new Date('2026-06-10T15:00:00.000Z');

    // When
    const before = startOfLocalDay(beforeMidnight, SEOUL);
    const at = startOfLocalDay(atMidnight, SEOUL);

    // Then
    expect(before).toEqual(new Date(2026, 5, 10));
    expect(at).toEqual(new Date(2026, 5, 11));
  });

  test('기기 시간대와 다른 시간대의 날짜를 따른다', () => {
    // Given
    const instant = new Date('2026-03-08T20:00:00.000Z');

    // When
    const losAngeles = startOfLocalDay(instant, LOS_ANGELES);
    const seoul = startOfLocalDay(instant, SEOUL);

    // Then
    expect(losAngeles).toEqual(new Date(2026, 2, 8));
    expect(seoul).toEqual(new Date(2026, 2, 9));
  });

  test('서머타임이 시작하는 날을 지나 하루씩 더해도 날이 밀리지 않는다', () => {
    // Given
    const saturday = new Date('2026-03-07T12:00:00.000Z');

    // When
    const sunday = addLocalDays(saturday, 1, LOS_ANGELES);
    const monday = addLocalDays(saturday, 2, LOS_ANGELES);

    // Then
    expect(sunday).toEqual(new Date(2026, 2, 8));
    expect(monday).toEqual(new Date(2026, 2, 9));
  });

  test('서머타임이 끝나는 날에도 일주일 뒤는 같은 요일이다', () => {
    // Given
    const sunday = new Date('2026-10-25T12:00:00.000Z');

    // When
    const result = addLocalDays(sunday, 7, LOS_ANGELES);

    // Then
    expect(result).toEqual(new Date(2026, 10, 1));
  });

  test('달의 첫날과 월 차이를 구한다', () => {
    // Given
    const date = new Date('2026-06-15T03:00:00.000Z');
    const other = new Date('2025-11-02T03:00:00.000Z');

    // When
    const first = startOfLocalMonth(date, SEOUL);
    const diff = diffLocalMonths(date, other, SEOUL);

    // Then
    expect(first).toEqual(new Date(2026, 5, 1));
    expect(diff).toBe(7);
  });

  test('31일에서 달을 옮기면 그 달의 마지막 날로 맞춘다', () => {
    // Given
    const jan31 = new Date(2026, 0, 31, 12);

    // When
    const next = addLocalMonths(jan31, 1, SEOUL);
    const previous = addLocalMonths(new Date(2026, 2, 31, 12), -1, SEOUL);

    // Then
    expect(next).toEqual(new Date(2026, 1, 28));
    expect(previous).toEqual(new Date(2026, 1, 28));
  });

  test('해를 넘겨 달을 옮긴다', () => {
    // Given
    const december = new Date(2026, 11, 15, 12);

    // When
    const next = addLocalMonths(december, 1, SEOUL);
    const previous = addLocalMonths(new Date(2026, 0, 15, 12), -1, SEOUL);

    // Then
    expect(next).toEqual(new Date(2027, 0, 15));
    expect(previous).toEqual(new Date(2025, 11, 15));
  });

  test('다른 달로 넘어가도 선택한 일을 지키고 없는 일은 마지막 날로 맞춘다', () => {
    // Given
    const selected = new Date(2026, 0, 31, 12);
    const february = new Date(2026, 1, 1);

    // When
    const result = withLocalMonthOf(selected, february, SEOUL);

    // Then
    expect(result).toEqual(new Date(2026, 1, 28));
  });
});
