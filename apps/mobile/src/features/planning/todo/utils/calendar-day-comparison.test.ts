import { isAfterDay, isBeforeDay, isSameDay } from './calendar-day-comparison';

const SEOUL = 'Asia/Seoul';
const NEW_YORK = 'America/New_York';
const LOS_ANGELES = 'America/Los_Angeles';

describe('시간대에 따라 달라지는 날', () => {
  it('자정을 막 넘긴 서울의 순간은 로스앤젤레스에서는 전날이다', () => {
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

  it('시간대를 바꾸면 같은 순간의 오늘 판정이 새 시간대 기준으로 다시 된다', () => {
    // Given
    const now = new Date('2026-11-07T10:00:00Z');
    const instant = new Date('2026-11-07T16:00:00Z');

    // When
    const inSeoul = isSameDay(instant, now, SEOUL);
    const inNewYork = isSameDay(instant, now, NEW_YORK);

    // Then
    expect(inSeoul).toBe(false);
    expect(inNewYork).toBe(true);
  });

  it('날짜 앞뒤 비교도 주어진 시간대의 날짜로 한다', () => {
    // Given
    const instant = new Date('2026-11-06T15:30:00Z');
    const reference = new Date('2026-11-06T09:00:00Z');

    // When
    const afterInSeoul = isAfterDay(instant, reference, SEOUL);
    const afterInNewYork = isAfterDay(instant, reference, NEW_YORK);
    const beforeInNewYork = isBeforeDay(instant, reference, NEW_YORK);

    // Then
    expect(afterInSeoul).toBe(true);
    expect(afterInNewYork).toBe(false);
    expect(beforeInNewYork).toBe(false);
  });
});
