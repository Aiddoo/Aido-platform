import { i18n } from '@src/shared/i18n';
import { createDateKey } from '@src/testing/date-key';
import { temporalOracle } from '@src/testing/temporal-oracle';
import { range } from 'es-toolkit';
import { z } from 'zod';

import weekCases from '../../../../../packages/api/test/fixtures/week-of-month-cases.json';
import {
  addDaysToDateKey,
  addMonthsToDateKey,
  dateKeySchema,
  diffDateKeysInMonths,
  getMonthStartDateKey,
  diffDateKeysInDays,
  getCalendarWeek,
  getDayOfWeek,
  getDaysInDateKeyMonth,
  getIsoWeekOfMonth,
  getIsoWeekYear,
  getMondayOfDateKey,
  getMonthEndDateKey,
  isDateKey,
  isSameMonthDateKey,
  isSameYearDateKey,
  parseDateKey,
} from './date-key';
import { toDateKey } from './zoned';

/** 서버 getIsoWeekOfMonth도 같은 표의 ISO 행을 읽는다. 두 구현이 어긋나면 어느 한쪽 테스트가 깨진다 */
const SHARED_WEEK_OF_MONTH_CASES = z
  .object({
    weekOfMonth: z.array(
      z.object({
        name: z.string(),
        system: z.enum(['SUNDAY_START', 'ISO']),
        date: z.iso.date(),
        expectedMiddleDate: z.iso.date(),
        expectedWeekOfMonth: z.int().min(1).max(5),
      }),
    ),
  })
  .parse(weekCases).weekOfMonth;

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
    const days = diffDateKeysInDays(createDateKey(from), createDateKey(to));

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
    const weekday = getDayOfWeek(createDateKey(dateKey));

    // Then
    expect(weekday).toBe(expected);
  });
});

describe('getCalendarWeek·getIsoWeekOfMonth', () => {
  it.each(SHARED_WEEK_OF_MONTH_CASES)(
    '주차는 주의 가운데 날이 속한 달의 몇째 주다(서버와 같은 표): $system $name',
    ({ system, date, expectedMiddleDate, expectedWeekOfMonth }) => {
      // When
      const dateKey = createDateKey(date);
      const { middleDateKey, weekOfMonth } =
        system === 'ISO' ? getIsoWeekOfMonth(dateKey) : getCalendarWeek(dateKey);

      // Then
      expect({ middleDateKey, weekOfMonth }).toEqual({
        middleDateKey: expectedMiddleDate,
        weekOfMonth: expectedWeekOfMonth,
      });
    },
  );
});

describe('날짜 key 기준 달력 주', () => {
  it.each([
    ['2026-03-08', '2026-03-08', '2026-03-14'],
    ['2026-11-01', '2026-11-01', '2026-11-07'],
    ['2028-02-29', '2028-02-27', '2028-03-04'],
    ['2026-12-28', '2026-12-27', '2027-01-02'],
    ['2027-01-03', '2027-01-03', '2027-01-09'],
  ])('%s의 주는 일요일 %s부터 토요일 %s까지다', (dateKey, startDateKey, endDateKey) => {
    // When
    const week = getCalendarWeek(createDateKey(dateKey));

    // Then
    // DST 전환일, 윤일, ISO 53주(12-28~01-03)에 걸친 날짜
    expect(week).toMatchObject({ startDateKey, endDateKey });
  });

  it.each([
    ['ko', 'en'],
    ['en', 'ko'],
  ] as const)('표시 언어를 %s→%s로 바꿔도 자정 근처의 오늘과 주는 그대로다', async (from, to) => {
    // Given
    // 서울은 일요일 0시, LA는 토요일 오전인 같은 순간
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
        middleDateKey: '2026-11-04',
        weekOfMonth: 1,
      },
      {
        todayDateKey: '2026-10-31',
        startDateKey: '2026-10-25',
        endDateKey: '2026-10-31',
        middleDateKey: '2026-10-28',
        weekOfMonth: 4,
      },
    ]);
  });

  it('DST 전환일 자정 직후도 그 시간대의 날짜와 주로 계산한다', () => {
    // Given
    // LA DST 시작(2026-03-08)과 종료(2026-11-01) 당일 0시 30분
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

describe('addDaysToDateKey — 날짜 key에 달력 일수 더하기', () => {
  it.each([
    ['2026-01-31', 1, '2026-02-01'],
    ['2026-02-28', 1, '2026-03-01'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2027-01-01', -1, '2026-12-31'],
    ['2026-03-08', 0, '2026-03-08'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2026-11-01', 365, '2027-11-01'],
  ])('%s에 %s일을 더하면 %s다', (dateKey, days, expected) => {
    // When
    const result = addDaysToDateKey(createDateKey(dateKey), days);

    // Then
    expect(result).toBe(expected);
  });

  it('DST 전환일을 지나도 하루씩 늘고 줄어든다', () => {
    // Given
    // 미국·유럽 DST 전환(3월, 10~11월)을 모두 지나는 두 해
    const start = createDateKey('2026-01-01');

    // When
    const keys = range(800).map((offset) => addDaysToDateKey(start, offset));

    // Then
    keys.forEach((key, offset) => {
      expect(diffDateKeysInDays(start, key)).toBe(offset);
    });
    expect(new Set(keys).size).toBe(800);
  });
});

describe('getMondayOfDateKey — 월요일 시작 주의 월요일', () => {
  it.each([
    ['2026-11-01', '2026-10-26'],
    ['2026-11-02', '2026-11-02'],
    ['2026-11-07', '2026-11-02'],
    ['2027-01-01', '2026-12-28'],
    ['2028-03-01', '2028-02-28'],
  ])('%s가 속한 주의 월요일은 %s다', (dateKey, expected) => {
    // When
    const monday = getMondayOfDateKey(createDateKey(dateKey));

    // Then
    expect(monday).toBe(expected);
  });
});

describe('날짜 key의 달 계산', () => {
  it.each([
    ['2026-02-10', 28, '2026-02-28'],
    ['2028-02-10', 29, '2028-02-29'],
    ['2026-12-01', 31, '2026-12-31'],
    ['2026-04-30', 30, '2026-04-30'],
  ])('%s의 달은 %s일이고 말일은 %s다', (dateKey, days, monthEnd) => {
    // When
    const result = {
      days: getDaysInDateKeyMonth(createDateKey(dateKey)),
      monthEnd: getMonthEndDateKey(createDateKey(dateKey)),
    };

    // Then
    expect(result).toEqual({ days, monthEnd });
  });

  it.each([
    ['2026-10-31', '2026-10-01', true],
    ['2026-10-31', '2026-11-01', false],
    ['2025-10-31', '2026-10-31', false],
  ])('%s와 %s의 같은 달 여부는 %s다', (first, second, expected) => {
    // When
    const result = isSameMonthDateKey(createDateKey(first), createDateKey(second));

    // Then
    expect(result).toBe(expected);
  });

  it.each([
    ['2026-01-01', '2026-12-31', true],
    ['2026-12-31', '2027-01-01', false],
  ])('%s와 %s의 같은 해 여부는 %s다', (first, second, expected) => {
    // When
    const result = isSameYearDateKey(createDateKey(first), createDateKey(second));

    // Then
    expect(result).toBe(expected);
  });
});

describe('getIsoWeekYear', () => {
  it.each([
    ['2026-12-29', 2026],
    ['2027-01-01', 2026],
    ['2025-12-29', 2026],
    ['2026-06-15', 2026],
  ])('%s는 ISO 주 연도 %i에 속한다', (dateKey, expected) => {
    // Given
    const key = dateKey;

    // When
    const year = getIsoWeekYear(createDateKey(key));

    // Then
    expect(year).toBe(expected);
  });
});

describe('달 단위 key 계산', () => {
  it('말일을 넘기면 그 달의 마지막 날로 맞춰 달을 더한다', () => {
    // When
    const common = addMonthsToDateKey(createDateKey('2026-01-31'), 1);
    const leap = addMonthsToDateKey(createDateKey('2028-01-31'), 1);
    const nextYear = addMonthsToDateKey(createDateKey('2026-12-15'), 1);
    const previousYear = addMonthsToDateKey(createDateKey('2026-01-15'), -1);

    // Then
    expect(common).toBe('2026-02-28');
    expect(leap).toBe('2028-02-29');
    expect(nextYear).toBe('2027-01-15');
    expect(previousYear).toBe('2025-12-15');
  });

  it('달의 첫날을 구한다', () => {
    // When
    const monthStart = getMonthStartDateKey(createDateKey('2026-06-15'));

    // Then
    expect(monthStart).toBe('2026-06-01');
  });

  it('일은 보지 않고 달 차이만 센다', () => {
    // When
    const acrossMonth = diffDateKeysInMonths(
      createDateKey('2026-01-31'),
      createDateKey('2026-02-01'),
    );
    const sameMonth = diffDateKeysInMonths(
      createDateKey('2026-04-15'),
      createDateKey('2026-04-01'),
    );
    const backwards = diffDateKeysInMonths(
      createDateKey('2026-04-15'),
      createDateKey('2026-03-15'),
    );

    // Then
    expect(acrossMonth).toBe(1);
    expect(sameMonth).toBe(0);
    expect(backwards).toBe(-1);
  });
});

describe('서버 Temporal과 같은 날짜 key 계산', () => {
  // 1900-01-01부터 2200-12-31까지 사흘마다. 월말·윤일·ISO 53주 해가 모두 들어간다
  const dateKeys = range(0, 109_938, 3).map((days) =>
    addDaysToDateKey(createDateKey('1900-01-01'), days),
  );

  it('1900~2200년 날짜 key의 더하기·차이·요일·달 길이·ISO 주 연도가 Node 26 Temporal과 같다', () => {
    // When
    const mismatches = dateKeys.filter(
      (dateKey) =>
        addDaysToDateKey(dateKey, 400) !== temporalOracle.addDays(dateKey, 400) ||
        addDaysToDateKey(dateKey, -31) !== temporalOracle.addDays(dateKey, -31) ||
        addMonthsToDateKey(dateKey, 1) !== temporalOracle.addMonths(dateKey, 1) ||
        addMonthsToDateKey(dateKey, -13) !== temporalOracle.addMonths(dateKey, -13) ||
        diffDateKeysInDays(createDateKey('2026-11-12'), dateKey) !==
          temporalOracle.diffDays('2026-11-12', dateKey) ||
        getDayOfWeek(dateKey) !== temporalOracle.dayOfWeek(dateKey) ||
        getDaysInDateKeyMonth(dateKey) !== temporalOracle.daysInMonth(dateKey) ||
        getIsoWeekYear(dateKey) !== temporalOracle.isoWeekYear(dateKey),
    );

    // Then
    expect({ checked: dateKeys.length, mismatches: mismatches.slice(0, 5) }).toEqual({
      checked: 36_646,
      mismatches: [],
    });
  });

  it.each([
    ['윤년 1월 말 + 1달', '2028-01-31', 1, '2028-02-29'],
    ['평년 1월 말 + 1달', '2026-01-31', 1, '2026-02-28'],
    ['3월 말 - 1달', '2026-03-31', -1, '2026-02-28'],
    ['윤일 + 12달', '2028-02-29', 12, '2029-02-28'],
    ['2100년은 윤년이 아니다', '2100-01-31', 1, '2100-02-28'],
    ['2000년은 윤년이다', '2000-01-31', 1, '2000-02-29'],
  ])('%s는 그 달의 마지막 날로 맞춘다', (_name, dateKey, months, expected) => {
    // When
    const result = addMonthsToDateKey(createDateKey(dateKey), months);

    // Then
    expect([result, temporalOracle.addMonths(dateKey, months)]).toEqual([expected, expected]);
  });

  it.each([
    ['2026-12-31', 2026],
    ['2027-01-03', 2026],
    ['2027-01-04', 2027],
    ['2032-12-31', 2032],
    ['2033-01-02', 2032],
    ['2027-12-31', 2027],
  ])('%s의 ISO 주 연도는 %s다(2026·2032는 53주)', (dateKey, expected) => {
    // When
    const result = getIsoWeekYear(createDateKey(dateKey));

    // Then
    expect([result, temporalOracle.isoWeekYear(dateKey)]).toEqual([expected, expected]);
  });

  it.each([
    '',
    'abc',
    '2026-13-01',
    '2026-02-30',
    '2027-02-29',
    '2026-2-3',
    '20261112',
    '2026-11-12T09:00',
    '2026-11-12T00:00:00.000Z',
  ])("계약 형식이 아닌 '%s'는 바깥 경계에서 날짜 key로 읽지 않는다", (value) => {
    // When
    const result = parseDateKey(value);

    // Then
    expect(result).toBeNull();
  });
});

describe('isDateKey — 계산 결과를 날짜 key로 좁히는 판정', () => {
  it.each([
    '2026-11-12',
    '2028-02-29',
    '2000-02-29',
    '0000-01-01',
    '9999-12-31',
    '',
    '2026-13-01',
    '2026-02-30',
    '2100-02-29',
    '2026-2-3',
    '10000-01-01',
    '2026-11-12T00:00:00.000Z',
  ])("'%s'를 계약 스키마와 같게 판정한다", (value) => {
    // When
    const result = isDateKey(value);

    // Then
    expect(result).toBe(dateKeySchema.safeParse(value).success);
  });
});
