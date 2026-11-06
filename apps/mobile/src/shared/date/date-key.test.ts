import { i18n } from '@src/shared/i18n';

import { diffDateKeysInDays, getCalendarWeek, getDayOfWeek } from './date-key';
import { toDateKey } from './instant';

afterEach(async () => {
  await i18n.changeLanguage('ko');
});

describe('diffDateKeysInDays — 두 날짜 key 사이의 달력 일수', () => {
  it.each([
    ['2028-02-28', '2028-03-01', 2],
    ['2026-03-07', '2026-03-09', 2],
    ['2026-12-31', '2027-01-01', 1],
    ['2026-10-05', '2026-10-01', -4],
  ])('%s부터 %s까지는 %s일이다', (from, to, expected) => {
    // When
    const days = diffDateKeysInDays(from, to);

    // Then
    expect(days).toBe(expected);
  });
});

describe('getDayOfWeek — 날짜 key의 요일', () => {
  it.each([
    ['2028-02-29', 2],
    ['2026-11-01', 0],
    ['2026-10-31', 6],
  ])('%s의 요일 인덱스는 %s다', (dateKey, expected) => {
    // When
    const weekday = getDayOfWeek(dateKey);

    // Then
    expect(weekday).toBe(expected);
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
    const week = getCalendarWeek(dateKey);

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
        const todayDateKey = toDateKey(instant, timeZone);
        return { todayDateKey, ...getCalendarWeek(todayDateKey) };
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
    const springDateKey = toDateKey(springForward, 'America/Los_Angeles');
    const fallDateKey = toDateKey(fallBack, 'America/Los_Angeles');

    // Then
    expect(springDateKey).toBe('2026-03-08');
    expect(getCalendarWeek(springDateKey).startDateKey).toBe('2026-03-08');
    expect(fallDateKey).toBe('2026-11-01');
    expect(getCalendarWeek(fallDateKey).startDateKey).toBe('2026-11-01');
  });
});
