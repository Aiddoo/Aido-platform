import { temporalOracle } from '@src/testing/temporal-oracle';

import { toInstant } from './instant';
import {
  addLocalDays,
  addLocalMonths,
  calculateCalendarDaysLeft,
  diffLocalMonths,
  moveToLocalMonth,
  startOfLocalDay,
  startOfLocalMonth,
  getZonedHour,
  hasSameWallClock,
  toDateKey,
  toHHmm,
  toZonedInstant,
} from './zoned';

describe('toDateKey', () => {
  it.each([
    ['서울 자정 직전', '2026-10-01T14:59:59.999Z', '2026-10-01', '2026-10-01'],
    ['서울 자정 정각', '2026-10-01T15:00:00.000Z', '2026-10-02', '2026-10-01'],
    ['LA 자정 정각', '2026-10-02T07:00:00.000Z', '2026-10-02', '2026-10-02'],
  ])('%s에는 같은 시각이어도 서울과 LA의 날짜가 다르다', (_name, iso, seoulKey, losAngelesKey) => {
    // Given
    const instant = new Date(iso);

    // When
    const seoul = toDateKey(instant, 'Asia/Seoul');
    const losAngeles = toDateKey(instant, 'America/Los_Angeles');

    // Then
    expect(seoul).toBe(seoulKey);
    expect(losAngeles).toBe(losAngelesKey);
  });

  it('윤일 경계에서 서울은 3월 1일, LA는 2월 29일이다', () => {
    // Given
    const instant = new Date('2028-02-29T15:00:00.000Z');

    // When
    const seoul = toDateKey(instant, 'Asia/Seoul');
    const losAngeles = toDateKey(instant, 'America/Los_Angeles');

    // Then
    expect(seoul).toBe('2028-03-01');
    expect(losAngeles).toBe('2028-02-29');
  });

  it('유효하지 않은 Date는 빈 문자열을 반환한다', () => {
    // Given
    const invalid = new Date(Number.NaN);

    // When
    const result = toDateKey(invalid, 'Asia/Seoul');

    // Then
    expect(result).toBe('');
  });
});

describe('getZonedHour', () => {
  it('지정 시간대의 0-23시를 반환한다', () => {
    // When
    const midnightHour = getZonedHour(new Date('2026-10-01T15:30:00Z'), 'Asia/Seoul');
    const lateNightHour = getZonedHour(new Date('2026-10-01T14:30:00Z'), 'Asia/Seoul');

    // Then
    expect(midnightHour).toBe(0);
    expect(lateNightHour).toBe(23);
  });
});

describe('toHHmm — 시간대 기준 HH:mm', () => {
  it('같은 순간을 서울과 LA의 24시간제 HH:mm으로 읽는다', () => {
    // Given
    const instant = new Date('2028-02-29T15:05:00Z');

    // When
    const seoul = toHHmm(instant, 'Asia/Seoul');
    const losAngeles = toHHmm(instant, 'America/Los_Angeles');

    // Then
    expect(seoul).toBe('00:05');
    expect(losAngeles).toBe('07:05');
  });
});

describe('hasSameWallClock', () => {
  const instant = new Date('2026-10-01T06:20:00Z');

  it('이름이 달라도 오프셋이 같은 시간대는 같은 벽시계로 본다', () => {
    // When
    const result = hasSameWallClock(instant, 'Asia/Seoul', 'Asia/Tokyo');

    // Then
    expect(result).toBe(true);
  });

  it('30분 차이도 다른 벽시계로 본다', () => {
    // When
    const result = hasSameWallClock(instant, 'Asia/Kolkata', 'Asia/Karachi');

    // Then
    expect(result).toBe(false);
  });

  it('서머타임으로 오프셋이 갈리는 날은 그날의 오프셋으로 판단한다', () => {
    // Given
    const beforeFallBack = new Date('2026-10-31T20:00:00Z');
    const afterFallBack = new Date('2026-11-02T20:00:00Z');

    // When
    const before = hasSameWallClock(beforeFallBack, 'America/Los_Angeles', 'America/Phoenix');
    const after = hasSameWallClock(afterFallBack, 'America/Los_Angeles', 'America/Phoenix');

    // Then
    // 서머타임 동안(-7)만 같고 해제 뒤(-8 대 -7)에는 다르다
    expect(before).toBe(true);
    expect(after).toBe(false);
  });
});

describe('Instant를 시간대로 읽기', () => {
  it('자정 직전·정각이 서울에서 다른 날짜가 된다', () => {
    // When
    const beforeMidnight = toDateKey(toInstant('2026-10-01T14:59:59.999Z'), 'Asia/Seoul');
    const atMidnight = toDateKey(toInstant('2026-10-01T15:00:00.000Z'), 'Asia/Seoul');

    // Then
    expect(beforeMidnight).toBe('2026-10-01');
    expect(atMidnight).toBe('2026-10-02');
  });

  it('오프셋 표기도 같은 순간이면 같은 날짜와 시각으로 읽는다', () => {
    // Given
    // 서울 자정은 UTC 전날 15시
    const seoulMidnight = toInstant('2026-10-02T00:00:00+09:00');

    // When
    const seoulKey = toDateKey(seoulMidnight, 'Asia/Seoul');
    const losAngelesKey = toDateKey(seoulMidnight, 'America/Los_Angeles');
    const losAngelesTime = toHHmm(seoulMidnight, 'America/Los_Angeles');

    // Then
    expect(seoulKey).toBe('2026-10-02');
    expect(losAngelesKey).toBe('2026-10-01');
    expect(losAngelesTime).toBe('08:00');
  });

  it('LA 서머타임 시작 때 01:59 다음이 03:00이다', () => {
    // When
    const before = toHHmm(toInstant('2026-03-08T09:59:59Z'), 'America/Los_Angeles');
    const after = toHHmm(toInstant('2026-03-08T10:00:00Z'), 'America/Los_Angeles');

    // Then
    expect(before).toBe('01:59');
    expect(after).toBe('03:00');
  });

  it('LA 서머타임 해제 때 01시가 두 번 지나가도 날짜는 그대로다', () => {
    // Given
    const first = toInstant('2026-11-01T08:30:00Z');
    const second = toInstant('2026-11-01T09:30:00Z');

    // When
    const firstTime = toHHmm(first, 'America/Los_Angeles');
    const secondTime = toHHmm(second, 'America/Los_Angeles');
    const firstKey = toDateKey(first, 'America/Los_Angeles');
    const secondKey = toDateKey(second, 'America/Los_Angeles');

    // Then
    expect(firstTime).toBe('01:30');
    expect(secondTime).toBe('01:30');
    expect(firstKey).toBe('2026-11-01');
    expect(secondKey).toBe('2026-11-01');
  });
});

describe('toZonedInstant', () => {
  it.each([
    [
      '뉴욕 서머타임 시작으로 없는 02:30',
      'America/New_York',
      '2026-03-08',
      '02:30',
      '2026-03-08T07:30:00.000Z',
    ],
    [
      '뉴욕 서머타임 해제로 두 번 오는 01:30',
      'America/New_York',
      '2026-11-01',
      '01:30',
      '2026-11-01T05:30:00.000Z',
    ],
    [
      '런던 서머타임 시작으로 없는 01:30',
      'Europe/London',
      '2026-03-29',
      '01:30',
      '2026-03-29T01:30:00.000Z',
    ],
    [
      '런던 서머타임 해제로 두 번 오는 01:30',
      'Europe/London',
      '2026-10-25',
      '01:30',
      '2026-10-25T00:30:00.000Z',
    ],
    [
      '산티아고 자정이 없는 날의 00:00',
      'America/Santiago',
      '2026-09-06',
      '00:00',
      '2026-09-06T04:00:00.000Z',
    ],
  ])('%s는 서버처럼 겹치면 앞쪽, 없으면 전환 뒤 순간이다', (_name, timeZone, date, time, iso) => {
    // When
    const instant = toZonedInstant({ date, time, timeZone });

    // Then
    expect(instant).toBe(iso);
  });

  it('서머타임·윤일 날짜의 모든 벽시계가 서버 규칙(Temporal compatible)과 같은 순간이다', () => {
    // Given
    const zones = [
      'Asia/Seoul',
      'America/New_York',
      'Europe/London',
      'America/Santiago',
      'Australia/Lord_Howe',
    ];
    const dates = [
      '2026-03-08',
      '2026-03-29',
      '2026-04-05',
      '2026-09-06',
      '2026-10-04',
      '2026-10-25',
      '2026-11-01',
      '2028-02-29',
    ];
    const times = ['00:00', '00:30', '01:00', '01:30', '02:00', '02:30', '03:00', '23:59'];
    const cases = zones.flatMap((timeZone) =>
      dates.flatMap((date) => times.map((time) => ({ timeZone, date, time }))),
    );

    // When
    const mismatches = cases.filter(
      ({ timeZone, date, time }) =>
        toZonedInstant({ date, time, timeZone }) !==
        temporalOracle.toZonedInstant(date, time, timeZone),
    );

    // Then
    expect(mismatches).toEqual([]);
  });

  it.each([
    ['서머타임 시작일 오후', '2026-03-08', '14:30', '2026-03-08T21:30:00.000Z'],
    ['서머타임 시작일 새벽', '2026-03-08', '00:30', '2026-03-08T08:30:00.000Z'],
    ['서머타임 끝나는 날 오후', '2026-11-01', '14:30', '2026-11-01T22:30:00.000Z'],
  ])('LA %s에도 벽시계 그대로의 순간이다', (_name, dateKey, hhmm, iso) => {
    // Given
    const timeZone = 'America/Los_Angeles';

    // When
    const instant = toZonedInstant({ date: dateKey, time: hhmm, timeZone });

    // Then
    expect(new Date(instant).toISOString()).toBe(iso);
  });

  it.each([
    ['Asia/Seoul', '2026-10-01T05:30:00.000Z'],
    ['America/Los_Angeles', '2026-10-01T21:30:00.000Z'],
  ])('같은 벽시계도 %s에서는 다른 순간이다', (timeZone, iso) => {
    // Given
    const dateKey = '2026-10-01';

    // When
    const instant = toZonedInstant({ date: dateKey, time: '14:30', timeZone });

    // Then
    expect(new Date(instant).toISOString()).toBe(iso);
  });
});

const SEOUL = 'Asia/Seoul';
const LOS_ANGELES = 'America/Los_Angeles';

describe('calculateCalendarDaysLeft', () => {
  it('자정 직전이면 끝나는 날까지 1일을 반환한다', () => {
    // Given
    const endsAt = toInstant('2026-11-01T05:30:00Z'); // 11월 1일 14:30 KST
    const now = toInstant('2026-10-31T14:59:59Z'); // 10월 31일 23:59:59 KST

    // When
    const result = calculateCalendarDaysLeft(endsAt, now, SEOUL);

    // Then
    // 11월 1일 - 10월 31일 = 1일
    expect(result).toBe(1);
  });

  it('자정이 지나 끝나는 날이 되면 0일을 반환한다', () => {
    // Given
    const endsAt = toInstant('2026-11-01T05:30:00Z');
    const now = toInstant('2026-10-31T15:00:00Z'); // 11월 1일 00:00 KST

    // When
    const result = calculateCalendarDaysLeft(endsAt, now, SEOUL);

    // Then
    // 11월 1일 - 11월 1일 = 0일
    expect(result).toBe(0);
  });

  it('서머타임이 끝나 25시간인 날을 지나도 달력 일수를 반환한다', () => {
    // Given
    // 2026-11-01 미국 서머타임 종료
    const now = toInstant('2026-10-31T19:00:00Z'); // 10월 31일 12:00 PDT
    const endsAt = toInstant('2026-11-02T20:00:00Z'); // 11월 2일 12:00 PST

    // When
    const result = calculateCalendarDaysLeft(endsAt, now, LOS_ANGELES);

    // Then
    // 49시간이 지나도 11월 2일 - 10월 31일 = 2일
    expect(result).toBe(2);
  });

  it('윤년 2월 29일을 하루로 센 일수를 반환한다', () => {
    // Given
    const now = toInstant('2028-02-28T03:00:00Z');
    const endsAt = toInstant('2028-03-01T03:00:00Z');

    // When
    const result = calculateCalendarDaysLeft(endsAt, now, SEOUL);

    // Then
    // 2월 28일 → 2월 29일 → 3월 1일 = 2일
    expect(result).toBe(2);
  });

  it('이미 지난 날이면 0일을 반환한다', () => {
    // Given
    const endsAt = toInstant('2026-10-20T00:00:00Z');
    const now = toInstant('2026-10-25T00:00:00Z');

    // When
    const result = calculateCalendarDaysLeft(endsAt, now, SEOUL);

    // Then
    // max(10월 20일 - 10월 25일, 0) = 0일
    expect(result).toBe(0);
  });

  it.each([
    // 2028-03-12 02:00 PST → 03:00 PDT (23시간인 날)
    ['LA 서머타임 시작일을 지나', LOS_ANGELES, '2028-03-11T20:00:00Z', '2028-03-13T19:00:00Z', 2],
    // 2028-11-05 02:00 PDT → 01:00 PST (25시간인 날)
    ['LA 서머타임 종료일을 지나', LOS_ANGELES, '2028-11-04T19:00:00Z', '2028-11-06T20:00:00Z', 2],
    // 2028-02-29T15:00Z = 서울 3월 1일 00:00, LA 2월 29일 07:00
    [
      '서울에서 2월 28일 정오에 3월 1일 자정까지',
      SEOUL,
      '2028-02-28T03:00:00Z',
      '2028-02-29T15:00:00Z',
      2,
    ],
    [
      'LA에서 2월 28일 정오에 2월 29일 아침까지',
      LOS_ANGELES,
      '2028-02-28T20:00:00Z',
      '2028-02-29T15:00:00Z',
      1,
    ],
    [
      'LA에서 2월 29일 밤에 3월 1일까지',
      LOS_ANGELES,
      '2028-03-01T07:00:00Z',
      '2028-03-01T20:00:00Z',
      1,
    ],
  ] as const)('%s 남은 달력 일수를 반환한다', (_case, timeZone, now, endsAt, expected) => {
    // When
    const result = calculateCalendarDaysLeft(toInstant(endsAt), toInstant(now), timeZone);

    // Then
    expect(result).toBe(expected);
  });
});

describe('설정 시간대 기준 달력 칸 계산', () => {
  it('자정 직전은 그 날이고 정각은 다음 날이다', () => {
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

  it('기기 시간대와 다른 시간대의 날짜를 따른다', () => {
    // Given
    const instant = new Date('2026-03-08T20:00:00.000Z');

    // When
    const losAngeles = startOfLocalDay(instant, LOS_ANGELES);
    const seoul = startOfLocalDay(instant, SEOUL);

    // Then
    expect(losAngeles).toEqual(new Date(2026, 2, 8));
    expect(seoul).toEqual(new Date(2026, 2, 9));
  });

  it('서머타임이 시작하는 날을 지나 하루씩 더해도 날이 밀리지 않는다', () => {
    // Given
    const saturday = new Date('2026-03-07T12:00:00.000Z');

    // When
    const sunday = addLocalDays(saturday, 1, LOS_ANGELES);
    const monday = addLocalDays(saturday, 2, LOS_ANGELES);

    // Then
    expect(sunday).toEqual(new Date(2026, 2, 8));
    expect(monday).toEqual(new Date(2026, 2, 9));
  });

  it('서머타임이 끝나는 날에도 일주일 뒤는 같은 요일이다', () => {
    // Given
    const sunday = new Date('2026-10-25T12:00:00.000Z');

    // When
    const result = addLocalDays(sunday, 7, LOS_ANGELES);

    // Then
    expect(result).toEqual(new Date(2026, 10, 1));
  });

  it('달의 첫날과 월 차이를 구한다', () => {
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

  it('31일에서 달을 옮기면 그 달의 마지막 날로 맞춘다', () => {
    // Given
    const jan31 = new Date(2026, 0, 31, 12);

    // When
    const next = addLocalMonths(jan31, 1, SEOUL);
    const previous = addLocalMonths(new Date(2026, 2, 31, 12), -1, SEOUL);

    // Then
    expect(next).toEqual(new Date(2026, 1, 28));
    expect(previous).toEqual(new Date(2026, 1, 28));
  });

  it('해를 넘겨 달을 옮긴다', () => {
    // Given
    const december = new Date(2026, 11, 15, 12);

    // When
    const next = addLocalMonths(december, 1, SEOUL);
    const previous = addLocalMonths(new Date(2026, 0, 15, 12), -1, SEOUL);

    // Then
    expect(next).toEqual(new Date(2027, 0, 15));
    expect(previous).toEqual(new Date(2025, 11, 15));
  });

  it('다른 달로 넘어가도 선택한 일을 지키고 없는 일은 마지막 날로 맞춘다', () => {
    // Given
    const selected = new Date(2026, 0, 31, 12);
    const february = new Date(2026, 1, 1);

    // When
    const result = moveToLocalMonth(selected, february, SEOUL);

    // Then
    expect(result).toEqual(new Date(2026, 1, 28));
  });

  it('윤년 2월 29일을 평년 2월로 옮기면 2월 28일이 된다', () => {
    // Given
    const leapDay = new Date(2028, 1, 29, 12);
    const commonFebruary = new Date(2029, 1, 1);

    // When
    const result = moveToLocalMonth(leapDay, commonFebruary, SEOUL);

    // Then
    expect(result).toEqual(new Date(2029, 1, 28));
  });
});

describe('diffLocalMonths', () => {
  it('같은 달 안이면 월 차이는 0이다', () => {
    // Given
    const day1 = new Date(2026, 3, 1);
    const day15 = new Date(2026, 3, 15);

    // When
    const result = diffLocalMonths(day15, day1, SEOUL);

    // Then
    expect(result).toBe(0);
  });

  it('다음 달이면 1, 이전 달이면 -1이다', () => {
    // Given
    const april = new Date(2026, 3, 15);
    const may = new Date(2026, 4, 15);
    const march = new Date(2026, 2, 15);

    // When
    const next = diffLocalMonths(may, april, SEOUL);
    const previous = diffLocalMonths(march, april, SEOUL);

    // Then
    expect(next).toBe(1);
    expect(previous).toBe(-1);
  });

  it('월말 경계를 넘어도 달의 첫날 기준으로 월 차이를 센다', () => {
    // Given
    const jan31 = new Date(2026, 0, 31);
    const feb1 = new Date(2026, 1, 1);

    // When
    const result = diffLocalMonths(feb1, jan31, SEOUL);

    // Then
    // 1/31 vs 2/1: 달력상 하루 차이지만 월 차이는 1
    expect(result).toBe(1);
  });
});
