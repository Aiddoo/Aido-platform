import { i18n } from '@src/shared/i18n';

import { getCalendarWeek, getCalendarWeekOfDateKey } from './calendar-week';
import { formatDateKey } from './date-format';

afterEach(async () => {
  await i18n.changeLanguage('ko');
});

describe('일요일을 기준으로 한 달력 주', () => {
  test.each([
    [new Date(2026, 9, 3), new Date(2026, 8, 27), 4],
    [new Date(2026, 9, 4), new Date(2026, 9, 4), 1],
    [new Date(2027, 0, 1), new Date(2026, 11, 27), 4],
    [new Date(2028, 1, 29), new Date(2028, 1, 27), 4],
  ])('날짜 %s의 주는 %s부터 시작하는 %s주차다', (date, expectedStart, expectedWeek) => {
    // Given
    const originalTimestamp = date.getTime();

    // When
    const week = getCalendarWeek(date);

    // Then
    expect(week.start).toEqual(expectedStart);
    expect(week.weekOfMonth).toBe(expectedWeek);
    expect(week.end.getDay()).toBe(6);
    expect(week.end.getHours()).toBe(23);
    expect(date.getTime()).toBe(originalTimestamp);
  });
});

describe('날짜 key 기준 달력 주', () => {
  test.each([
    ['2026-03-08', '2026-03-08', '2026-03-14', 2],
    ['2026-11-01', '2026-11-01', '2026-11-07', 1],
    ['2028-02-29', '2028-02-27', '2028-03-04', 4],
    ['2026-12-28', '2026-12-27', '2027-01-02', 4],
    ['2027-01-03', '2027-01-03', '2027-01-09', 1],
    ['2031-10-20', '2031-10-19', '2031-10-25', 3],
  ])('%s의 주는 %s~%s, 시작한 달의 %s주차다', (dateKey, startDateKey, endDateKey, weekOfMonth) => {
    // Given: DST 전환일, 윤일, ISO 53주(12-28~01-03)에 걸친 날짜

    // When
    const week = getCalendarWeekOfDateKey(dateKey);

    // Then
    expect(week).toEqual({ startDateKey, endDateKey, weekOfMonth });
  });

  test.each([
    ['ko', 'en'],
    ['en', 'ko'],
  ] as const)('표시 언어를 %s→%s로 바꿔도 자정 근처의 오늘과 주는 그대로다', async (from, to) => {
    // Given: 서울은 일요일 0시, LA는 토요일 오전인 같은 순간
    const instant = new Date('2026-10-31T15:00:00Z');
    const readWeeks = () =>
      ['Asia/Seoul', 'America/Los_Angeles'].map((timeZone) => {
        const todayDateKey = formatDateKey(instant, timeZone);
        return { todayDateKey, ...getCalendarWeekOfDateKey(todayDateKey) };
      });
    await i18n.changeLanguage(from);
    const before = readWeeks();

    // When
    await i18n.changeLanguage(to);

    // Then
    expect(readWeeks()).toEqual(before);
    expect(before).toEqual([
      {
        todayDateKey: '2026-11-01',
        startDateKey: '2026-11-01',
        endDateKey: '2026-11-07',
        weekOfMonth: 1,
      },
      {
        todayDateKey: '2026-10-31',
        startDateKey: '2026-10-25',
        endDateKey: '2026-10-31',
        weekOfMonth: 4,
      },
    ]);
  });

  test('DST 전환일 자정 직후도 그 시간대의 날짜와 주로 계산한다', () => {
    // Given: LA DST 시작(2026-03-08)과 종료(2026-11-01) 당일 0시 30분
    const springForward = new Date('2026-03-08T08:30:00Z');
    const fallBack = new Date('2026-11-01T07:30:00Z');

    // When
    const springDateKey = formatDateKey(springForward, 'America/Los_Angeles');
    const fallDateKey = formatDateKey(fallBack, 'America/Los_Angeles');

    // Then
    expect(springDateKey).toBe('2026-03-08');
    expect(getCalendarWeekOfDateKey(springDateKey).startDateKey).toBe('2026-03-08');
    expect(fallDateKey).toBe('2026-11-01');
    expect(getCalendarWeekOfDateKey(fallDateKey).startDateKey).toBe('2026-11-01');
  });
});
