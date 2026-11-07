import { isAfterDay, isBeforeDay, isDateToday, isSameDay } from './calendar-day-comparison';
import { getWeekRange } from './calendar-grid';

const SEOUL = 'Asia/Seoul';
const NEW_YORK = 'America/New_York';
const LOS_ANGELES = 'America/Los_Angeles';

describe('시간대에 따라 달라지는 날', () => {
  test('자정을 막 넘긴 서울의 순간은 로스앤젤레스에서는 전날이다', () => {
    // Given
    const justAfterMidnightInSeoul = new Date('2026-11-06T15:30:00Z');
    const seoulNoon = new Date('2026-11-06T09:00:00Z');

    // When
    const seoul = isSameDay(justAfterMidnightInSeoul, seoulNoon, SEOUL);
    const losAngeles = isSameDay(justAfterMidnightInSeoul, seoulNoon, LOS_ANGELES);

    // Then
    expect(seoul).toBe(false);
    expect(losAngeles).toBe(true);
  });

  test('시간대를 바꾸면 같은 순간의 오늘 판정이 새 시간대 기준으로 다시 된다', () => {
    // Given
    const now = new Date('2026-11-07T10:00:00Z');
    const instant = new Date('2026-11-07T16:00:00Z');

    // When
    const inSeoul = isDateToday(instant, now, SEOUL);
    const inNewYork = isDateToday(instant, now, NEW_YORK);

    // Then
    expect(inSeoul).toBe(false);
    expect(inNewYork).toBe(true);
  });

  test('날짜 앞뒤 비교도 주어진 시간대의 날짜로 한다', () => {
    // Given
    const instant = new Date('2026-11-06T15:30:00Z');
    const reference = new Date('2026-11-06T09:00:00Z');

    // When / Then
    expect(isAfterDay(instant, reference, SEOUL)).toBe(true);
    expect(isAfterDay(instant, reference, NEW_YORK)).toBe(false);
    expect(isBeforeDay(instant, reference, NEW_YORK)).toBe(false);
  });

  test('서머타임이 시작되는 주도 일요일부터 토요일까지 7일이다', () => {
    // Given
    const springForwardDay = new Date('2026-03-08T12:00:00Z');

    // When
    const range = getWeekRange(springForwardDay, NEW_YORK);

    // Then
    expect(range).toEqual({ rangeStart: '2026-03-08', rangeEnd: '2026-03-14' });
  });

  test('서머타임이 끝나는 날 새벽의 순간도 같은 날짜 주에 속한다', () => {
    // Given
    const fallBackNight = new Date('2026-11-01T05:30:00Z');

    // When
    const range = getWeekRange(fallBackNight, NEW_YORK);

    // Then
    expect(range).toEqual({ rangeStart: '2026-11-01', rangeEnd: '2026-11-07' });
  });
});
