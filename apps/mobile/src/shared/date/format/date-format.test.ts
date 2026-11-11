import { fromEpochMs, toEpochMs, toInstant } from '../instant';
import {
  type DateFormatContext,
  formatClockTime,
  formatDateKeyLabel,
  formatDateKeyCompactRange,
  formatDateKeyRange,
  formatDateLabel,
  formatHourLabel,
  formatInstantHour,
  formatRelativeTimeWith,
  formatHHmmTime,
  formatTimeOfDay,
  formatYearAwareDateKeyLabel,
  formatYearAwareDateLabel,
} from './date-format';

const date = new Date('2026-10-01T00:05:00Z');
const KO_SEOUL: DateFormatContext = { locale: 'ko-KR', timeZone: 'Asia/Seoul' };
const EN_SEOUL: DateFormatContext = { locale: 'en-US', timeZone: 'Asia/Seoul' };

describe('native date formatting', () => {
  it('명시한 로케일과 시간대로 날짜를 표시한다', () => {
    // When
    const seoul = formatDateLabel(date, 'fullDate', KO_SEOUL);
    const losAngeles = formatDateLabel(date, 'fullDate', {
      locale: 'en-US',
      timeZone: 'America/Los_Angeles',
    });

    // Then
    expect(seoul).toBe('2026년 10월 1일');
    expect(losAngeles).toBe('September 30, 2026');
  });

  it('유효하지 않은 날짜는 렌더링 중 예외 없이 빈 문자열로 표시한다', () => {
    // When
    const label = formatDateLabel(new Date('invalid'), 'fullDate', {
      locale: 'ko-KR',
      timeZone: 'UTC',
    });

    // Then
    expect(label).toBe('');
  });
});

describe('formatClockTime', () => {
  it('ko 12시간제는 오전/오후를 시각 앞에 둔다', () => {
    // Given
    const afternoon = new Date('2026-10-01T05:30:00Z');

    // When
    const result = formatClockTime(afternoon, 'TWELVE_HOUR', KO_SEOUL);

    // Then
    expect(result).toBe('오후\u00A02:30');
  });

  it('ko 24시간제는 두 자리 시와 분만 표시한다', () => {
    // Given
    const morning = new Date('2026-10-01T00:05:00Z');

    // When
    const result = formatClockTime(morning, 'TWENTY_FOUR_HOUR', KO_SEOUL);

    // Then
    expect(result).toBe('09:05');
  });

  it('오전/오후와 시각 사이는 줄바꿈 없는 공백이라 큰 글꼴에서도 함께 줄을 바꾼다', () => {
    // When
    const result = formatClockTime(new Date('2026-01-01T10:00:00.000Z'), 'TWELVE_HOUR', KO_SEOUL);

    // Then
    expect(result).toBe('오후\u00A07:00');
    expect(result).not.toContain(' ');
  });

  it('en 12시간제는 AM/PM을 시각 뒤에 둔다', () => {
    // Given
    const afternoon = new Date('2026-10-01T05:30:00Z');

    // When
    const result = formatClockTime(afternoon, 'TWELVE_HOUR', EN_SEOUL);

    // Then
    expect(result).toBe('2:30\u00A0PM');
  });

  it('24시간제 자정을 24:00이 아닌 00:05로 표시한다', () => {
    // When
    const result = formatClockTime(date, 'TWENTY_FOUR_HOUR', { locale: 'en-US', timeZone: 'UTC' });

    // Then
    expect(result).toBe('00:05');
  });

  it.each([
    ['Asia/Seoul', 'ko-KR', '2026-03-08T10:00:00.000Z', 'TWELVE_HOUR', '오후\u00A07:00'],
    ['Asia/Seoul', 'ko-KR', '2026-03-08T10:00:00.000Z', 'TWENTY_FOUR_HOUR', '19:00'],
    ['Asia/Seoul', 'ko-KR', '2026-11-01T08:00:00.000Z', 'TWELVE_HOUR', '오후\u00A05:00'],
    ['Asia/Seoul', 'ko-KR', '2026-11-01T08:00:00.000Z', 'TWENTY_FOUR_HOUR', '17:00'],
    ['Asia/Seoul', 'ko-KR', '2026-12-31T13:15:00.000Z', 'TWELVE_HOUR', '오후\u00A010:15'],
    ['Asia/Seoul', 'ko-KR', '2026-12-31T13:15:00.000Z', 'TWENTY_FOUR_HOUR', '22:15'],
    ['Asia/Seoul', 'ko-KR', '2028-02-29T12:00:00.000Z', 'TWELVE_HOUR', '오후\u00A09:00'],
    ['Asia/Seoul', 'ko-KR', '2028-02-29T12:00:00.000Z', 'TWENTY_FOUR_HOUR', '21:00'],
    ['Asia/Seoul', 'en-US', '2026-03-08T10:00:00.000Z', 'TWELVE_HOUR', '7:00\u00A0PM'],
    ['Asia/Seoul', 'en-US', '2026-03-08T10:00:00.000Z', 'TWENTY_FOUR_HOUR', '19:00'],
    ['Asia/Seoul', 'en-US', '2026-11-01T08:00:00.000Z', 'TWELVE_HOUR', '5:00\u00A0PM'],
    ['Asia/Seoul', 'en-US', '2026-11-01T08:00:00.000Z', 'TWENTY_FOUR_HOUR', '17:00'],
    ['Asia/Seoul', 'en-US', '2026-12-31T13:15:00.000Z', 'TWELVE_HOUR', '10:15\u00A0PM'],
    ['Asia/Seoul', 'en-US', '2026-12-31T13:15:00.000Z', 'TWENTY_FOUR_HOUR', '22:15'],
    ['Asia/Seoul', 'en-US', '2028-02-29T12:00:00.000Z', 'TWELVE_HOUR', '9:00\u00A0PM'],
    ['Asia/Seoul', 'en-US', '2028-02-29T12:00:00.000Z', 'TWENTY_FOUR_HOUR', '21:00'],
    ['America/Los_Angeles', 'ko-KR', '2026-03-08T10:00:00.000Z', 'TWELVE_HOUR', '오전\u00A03:00'],
    ['America/Los_Angeles', 'ko-KR', '2026-03-08T10:00:00.000Z', 'TWENTY_FOUR_HOUR', '03:00'],
    ['America/Los_Angeles', 'ko-KR', '2026-11-01T08:00:00.000Z', 'TWELVE_HOUR', '오전\u00A01:00'],
    ['America/Los_Angeles', 'ko-KR', '2026-11-01T08:00:00.000Z', 'TWENTY_FOUR_HOUR', '01:00'],
    ['America/Los_Angeles', 'ko-KR', '2026-12-31T13:15:00.000Z', 'TWELVE_HOUR', '오전\u00A05:15'],
    ['America/Los_Angeles', 'ko-KR', '2026-12-31T13:15:00.000Z', 'TWENTY_FOUR_HOUR', '05:15'],
    ['America/Los_Angeles', 'ko-KR', '2028-02-29T12:00:00.000Z', 'TWELVE_HOUR', '오전\u00A04:00'],
    ['America/Los_Angeles', 'ko-KR', '2028-02-29T12:00:00.000Z', 'TWENTY_FOUR_HOUR', '04:00'],
    ['America/Los_Angeles', 'en-US', '2026-03-08T10:00:00.000Z', 'TWELVE_HOUR', '3:00\u00A0AM'],
    ['America/Los_Angeles', 'en-US', '2026-03-08T10:00:00.000Z', 'TWENTY_FOUR_HOUR', '03:00'],
    ['America/Los_Angeles', 'en-US', '2026-11-01T08:00:00.000Z', 'TWELVE_HOUR', '1:00\u00A0AM'],
    ['America/Los_Angeles', 'en-US', '2026-11-01T08:00:00.000Z', 'TWENTY_FOUR_HOUR', '01:00'],
    ['America/Los_Angeles', 'en-US', '2026-12-31T13:15:00.000Z', 'TWELVE_HOUR', '5:15\u00A0AM'],
    ['America/Los_Angeles', 'en-US', '2026-12-31T13:15:00.000Z', 'TWENTY_FOUR_HOUR', '05:15'],
    ['America/Los_Angeles', 'en-US', '2028-02-29T12:00:00.000Z', 'TWELVE_HOUR', '4:00\u00A0AM'],
    ['America/Los_Angeles', 'en-US', '2028-02-29T12:00:00.000Z', 'TWENTY_FOUR_HOUR', '04:00'],
  ] as const)('%s %s %s %s는 이전과 같은 글자다', (timeZone, locale, iso, timeFormat, expected) => {
    // When
    const label = formatClockTime(toInstant(iso), timeFormat, { locale, timeZone });

    // Then
    expect(label).toBe(expected);
  });
});

describe('formatTimeOfDay', () => {
  it('기기 시간대와 무관하게 HH:mm 시각을 로케일 순서로 표시한다', () => {
    // Given
    const time = { hour: 18, minute: 30 };

    // When
    const ko = formatTimeOfDay(time, 'TWELVE_HOUR', KO_SEOUL);
    const en = formatTimeOfDay(time, 'TWELVE_HOUR', EN_SEOUL);
    const twentyFour = formatTimeOfDay(time, 'TWENTY_FOUR_HOUR', KO_SEOUL);

    // Then
    expect(ko).toBe('오후\u00A06:30');
    expect(en).toBe('6:30\u00A0PM');
    expect(twentyFour).toBe('18:30');
  });
});

describe('formatHourLabel', () => {
  it('정시를 사용자 시간 형식과 로케일 순서로 표시한다', () => {
    // When
    const midnight = formatHourLabel(0, 'TWELVE_HOUR', KO_SEOUL);
    const afternoon = formatHourLabel(15, 'TWELVE_HOUR', KO_SEOUL);
    const twentyFour = formatHourLabel(15, 'TWENTY_FOUR_HOUR', KO_SEOUL);
    const en = formatHourLabel(15, 'TWELVE_HOUR', EN_SEOUL);

    // Then
    expect(midnight).toBe('오전\u00A012시');
    expect(afternoon).toBe('오후\u00A03시');
    expect(twentyFour).toBe('15시');
    expect(en).toBe('3\u00A0PM');
  });
});

describe('formatInstantHour', () => {
  it('순간을 context 시간대의 정시로 표시하고 언어는 글자 모양만 바꾼다', () => {
    // Given
    // 서울 15:20이자 LA 23:20인 순간
    const instant = new Date('2026-10-01T06:20:00Z');

    // When
    const ko = formatInstantHour(instant, 'TWELVE_HOUR', KO_SEOUL);
    const en = formatInstantHour(instant, 'TWELVE_HOUR', EN_SEOUL);
    const losAngeles = formatInstantHour(instant, 'TWENTY_FOUR_HOUR', {
      locale: 'ko-KR',
      timeZone: 'America/Los_Angeles',
    });

    // Then
    expect(ko).toBe('오후\u00A03시');
    expect(en).toBe('3\u00A0PM');
    expect(losAngeles).toBe('23시');
  });
});

describe('formatDateKeyLabel', () => {
  it('위젯용 숫자 일과 MM.DD 표기는 로케일과 무관하게 유지한다', () => {
    // When
    const dayNumber = formatDateKeyLabel('2026-09-07', 'dayNumber', KO_SEOUL);
    const koDotted = formatDateKeyLabel('2026-09-07', 'dottedMonthDay', KO_SEOUL);
    const enDotted = formatDateKeyLabel('2026-09-07', 'dottedMonthDay', EN_SEOUL);

    // Then
    expect(dayNumber).toBe('7');
    expect(koDotted).toBe('09.07');
    expect(enDotted).toBe('09.07');
  });

  it('Hermes처럼 ko-KR day 파트에 "일"이 붙어도 dayNumber는 숫자만 돌려준다', () => {
    // Given
    const originalFormatToParts = Intl.DateTimeFormat.prototype.formatToParts;
    const spy = jest
      .spyOn(Intl.DateTimeFormat.prototype, 'formatToParts')
      .mockImplementation(function (this: Intl.DateTimeFormat, target) {
        if (this.resolvedOptions().locale.startsWith('ko')) {
          return [{ type: 'day', value: '7일' }];
        }
        return originalFormatToParts.call(this, target);
      });

    try {
      // When
      const label = formatDateKeyLabel('2026-09-07', 'dayNumber', KO_SEOUL);

      // Then
      expect(label).toBe('7');
    } finally {
      spy.mockRestore();
    }
  });

  it('DateString은 기기 시간대와 무관하게 그 날짜로 표시한다', () => {
    // Given
    // 서울보다 하루 늦은 시간대
    const losAngeles = { locale: 'ko-KR', timeZone: 'America/Los_Angeles' } as const;

    // When
    const ko = formatDateKeyLabel('2026-10-20', 'fullDate', losAngeles);
    const en = formatDateKeyLabel('2028-02-29', 'fullDate', EN_SEOUL);

    // Then
    expect(ko).toBe('2026년 10월 20일');
    expect(en).toBe('February 29, 2028');
  });

  it.each([
    ['ko-KR', '2026-12-31', 'fullDate', '2026년 12월 31일'],
    ['ko-KR', '2026-12-31', 'yearShortMonth', '2026년 12월'],
    ['ko-KR', '2026-12-31', 'weekday', '목'],
    ['ko-KR', '2026-12-31', 'dayNumber', '31'],
    ['ko-KR', '2027-01-01', 'fullDate', '2027년 1월 1일'],
    ['ko-KR', '2027-01-01', 'yearShortMonth', '2027년 1월'],
    ['ko-KR', '2027-01-01', 'weekday', '금'],
    ['ko-KR', '2027-01-01', 'dayNumber', '1'],
    ['ko-KR', '2028-02-29', 'fullDate', '2028년 2월 29일'],
    ['ko-KR', '2028-02-29', 'yearShortMonth', '2028년 2월'],
    ['ko-KR', '2028-02-29', 'weekday', '화'],
    ['ko-KR', '2028-02-29', 'dayNumber', '29'],
    ['en-US', '2026-12-31', 'fullDate', 'December 31, 2026'],
    ['en-US', '2026-12-31', 'yearShortMonth', 'Dec 2026'],
    ['en-US', '2026-12-31', 'weekday', 'Thu'],
    ['en-US', '2026-12-31', 'dayNumber', '31'],
    ['en-US', '2027-01-01', 'fullDate', 'January 1, 2027'],
    ['en-US', '2027-01-01', 'yearShortMonth', 'Jan 2027'],
    ['en-US', '2027-01-01', 'weekday', 'Fri'],
    ['en-US', '2027-01-01', 'dayNumber', '1'],
    ['en-US', '2028-02-29', 'fullDate', 'February 29, 2028'],
    ['en-US', '2028-02-29', 'yearShortMonth', 'Feb 2028'],
    ['en-US', '2028-02-29', 'weekday', 'Tue'],
    ['en-US', '2028-02-29', 'dayNumber', '29'],
  ] as const)('%s %s %s는 이전과 같은 글자다', (locale, dateKey, kind, expected) => {
    // When
    const label = formatDateKeyLabel(dateKey, kind, { locale, timeZone: 'Asia/Seoul' });

    // Then
    expect(label).toBe(expected);
  });
});

describe('formatYearAwareDateLabel', () => {
  // 2026-12-31T16:00Z = 서울 2027-01-01 01:00, LA 2026-12-31 08:00
  const NEW_YEAR_BOUNDARY = toInstant('2026-12-31T16:00:00Z');
  const LA_EN: DateFormatContext = { locale: 'en-US', timeZone: 'America/Los_Angeles' };
  const LA_KO: DateFormatContext = { locale: 'ko-KR', timeZone: 'America/Los_Angeles' };

  it.each([
    ['서울에서 오늘이 2027-01-01이면 새해 첫날이라 연도를 뺀다', '2027-01-01', KO_SEOUL, '1월 1일'],
    [
      '서울에서 오늘이 2026-12-31이면 내년 날이라 연도를 붙인다',
      '2026-12-31',
      KO_SEOUL,
      '2027년 1월 1일',
    ],
    ['LA에서 오늘이 2026-12-31이면 같은 해라 연도를 뺀다', '2026-12-31', LA_EN, 'Dec 31'],
    [
      'LA에서 오늘이 2027-01-01이면 지난해라 연도를 붙인다',
      '2027-01-01',
      LA_EN,
      'December 31, 2026',
    ],
  ] as const)('%s', (_name, todayDateKey, context, expected) => {
    // When
    const label = formatYearAwareDateLabel(NEW_YEAR_BOUNDARY, todayDateKey, context);

    // Then
    expect(label).toBe(expected);
  });

  it('같은 순간도 사용자 시간대의 날짜로 해를 가른다', () => {
    // Given
    const seoulToday = '2027-01-01';
    const losAngelesToday = '2026-12-31';

    // When
    const seoul = formatYearAwareDateLabel(NEW_YEAR_BOUNDARY, seoulToday, KO_SEOUL);
    const losAngeles = formatYearAwareDateLabel(NEW_YEAR_BOUNDARY, losAngelesToday, LA_KO);

    // Then
    expect(seoul).toBe('1월 1일');
    expect(losAngeles).toBe('12월 31일');
  });

  it('유효하지 않은 날짜는 빈 문자열이다', () => {
    // When
    const label = formatYearAwareDateLabel(new Date('invalid'), '2026-11-09', KO_SEOUL);

    // Then
    expect(label).toBe('');
  });
});

describe('formatYearAwareDateKeyLabel', () => {
  it.each([
    ['ko 올해', 'ko-KR', '2028-01-15', '2월 29일'],
    ['en 올해', 'en-US', '2028-01-15', 'Feb 29'],
    ['ko 다른 해', 'ko-KR', '2027-12-31', '2028년 2월 29일'],
    ['en 다른 해', 'en-US', '2029-01-01', 'February 29, 2028'],
  ] as const)('윤일 2028-02-29를 %s에는 %s', (_name, locale, todayDateKey, expected) => {
    // When
    const label = formatYearAwareDateKeyLabel('2028-02-29', todayDateKey, {
      locale,
      timeZone: 'America/Los_Angeles',
    });

    // Then
    expect(label).toBe(expected);
  });
});

describe('formatDateKeyRange', () => {
  it('두 끝이 모두 올해면 월·일만 표시한다', () => {
    // When
    const ko = formatDateKeyRange('2026-10-19', '2026-10-25', '2026-11-09', KO_SEOUL);
    const en = formatDateKeyRange('2026-10-19', '2026-10-25', '2026-11-09', EN_SEOUL);

    // Then
    expect(ko).toBe('10월 19일 ~ 10월 25일');
    expect(en).toBe('Oct 19 ~ Oct 25');
  });

  it('같은 해라도 올해가 아니면 연도까지 표시한다', () => {
    // When
    const lastYear = formatDateKeyRange('2025-10-19', '2025-10-25', '2026-11-09', KO_SEOUL);

    // Then
    expect(lastYear).toBe('2025년 10월 19일 ~ 2025년 10월 25일');
  });

  it('해를 넘는 기간은 연도까지 표시한다', () => {
    // When
    const ko = formatDateKeyRange('2026-12-28', '2027-01-03', '2026-12-31', KO_SEOUL);
    const en = formatDateKeyRange('2026-12-28', '2027-01-03', '2027-01-01', EN_SEOUL);

    // Then
    expect(ko).toBe('2026년 12월 28일 ~ 2027년 1월 3일');
    expect(en).toBe('December 28, 2026 ~ January 3, 2027');
  });

  it.each([
    [
      'ko-KR',
      '2026-12-28',
      '2027-01-06',
      '2026-11-11',
      '2026년 12월 28일 ~ 2027년 1월 6일',
      '2026년 12월 28일 ~ 2027년 1월 6일',
    ],
    ['ko-KR', '2026-11-02', '2026-11-11', '2026-11-11', '11월 2일 ~ 11월 11일', '11월 2일~11일'],
    [
      'ko-KR',
      '2026-12-28',
      '2027-01-06',
      '2025-12-31',
      '2026년 12월 28일 ~ 2027년 1월 6일',
      '2026년 12월 28일 ~ 2027년 1월 6일',
    ],
    [
      'en-US',
      '2026-12-28',
      '2027-01-06',
      '2026-11-11',
      'December 28, 2026 ~ January 6, 2027',
      'December 28, 2026 ~ January 6, 2027',
    ],
    ['en-US', '2026-11-02', '2026-11-11', '2026-11-11', 'Nov 2 ~ Nov 11', 'Nov 2~11'],
    [
      'en-US',
      '2026-12-28',
      '2027-01-06',
      '2025-12-31',
      'December 28, 2026 ~ January 6, 2027',
      'December 28, 2026 ~ January 6, 2027',
    ],
  ] as const)(
    '%s %s~%s(오늘 %s)는 이전과 같은 글자다',
    (locale, startDateKey, endDateKey, todayDateKey, expected, expectedCompact) => {
      // Given
      const context = { locale, timeZone: 'Asia/Seoul' };

      // When
      const range = formatDateKeyRange(startDateKey, endDateKey, todayDateKey, context);
      const compact = formatDateKeyCompactRange(startDateKey, endDateKey, todayDateKey, context);

      // Then
      expect([range, compact]).toEqual([expected, expectedCompact]);
    },
  );
});

describe('formatDateKeyCompactRange', () => {
  it('올해 같은 달이면 끝은 날만 쓴다', () => {
    // When
    const ko = formatDateKeyCompactRange('2026-11-05', '2026-11-07', '2026-11-09', KO_SEOUL);
    const en = formatDateKeyCompactRange('2026-11-05', '2026-11-07', '2026-11-09', EN_SEOUL);

    // Then
    expect(ko).toBe('11월 5일~7일');
    expect(en).toBe('Nov 5~7');
  });

  it('달이 다르면 끝에도 달을 쓰고 올해가 아닌 끝이 있으면 연도까지 쓴다', () => {
    // When
    const otherMonth = formatDateKeyCompactRange(
      '2026-11-30',
      '2026-12-02',
      '2026-11-09',
      KO_SEOUL,
    );
    const otherYear = formatDateKeyCompactRange('2026-12-30', '2027-01-02', '2026-11-09', KO_SEOUL);
    const nextYear = formatDateKeyCompactRange('2027-01-05', '2027-01-07', '2026-11-09', KO_SEOUL);

    // Then
    expect(otherMonth).toBe('11월 30일~12월 2일');
    expect(otherYear).toBe('2026년 12월 30일 ~ 2027년 1월 2일');
    expect(nextYear).toBe('2027년 1월 5일 ~ 2027년 1월 7일');
  });
});

describe('formatRelativeTimeWith', () => {
  const now = toInstant('2026-10-25T03:00:00Z');
  const minutesAgo = (minutes: number) => fromEpochMs(toEpochMs(now) - minutes * 60_000);
  const labels = {
    justNow: 'justNow',
    minutesAgo: (count: number) => `minutes:${count}`,
    hoursAgo: (count: number) => `hours:${count}`,
    daysAgo: (count: number) => `days:${count}`,
  };

  it('7일 미만은 경과 구간에 맞는 주입 문구를 내림한 개수로 고른다', () => {
    // When
    const justNow = formatRelativeTimeWith(minutesAgo(0.5), now, labels, KO_SEOUL);
    const minutes = formatRelativeTimeWith(minutesAgo(59), now, labels, KO_SEOUL);
    const hours = formatRelativeTimeWith(minutesAgo(3 * 60 + 59), now, labels, KO_SEOUL);
    const days = formatRelativeTimeWith(minutesAgo(6 * 24 * 60), now, labels, KO_SEOUL);

    // Then
    expect(justNow).toBe('justNow');
    expect(minutes).toBe('minutes:59');
    expect(hours).toBe('hours:3');
    expect(days).toBe('days:6');
  });

  it('7일 이상은 같은 해면 월·일, 다른 해면 연도를 포함한 날짜로 표시한다', () => {
    // When
    const sameYear = formatRelativeTimeWith(
      toInstant('2026-01-05T03:00:00Z'),
      now,
      labels,
      KO_SEOUL,
    );
    const otherYear = formatRelativeTimeWith(
      toInstant('2025-01-05T03:00:00Z'),
      now,
      labels,
      EN_SEOUL,
    );

    // Then
    expect(sameYear).toBe('1월 5일');
    expect(otherYear).toBe('1/5/2025');
  });

  it('연도 경계는 context 시간대 기준으로 판단한다', () => {
    // Given
    // UTC로는 2025년이지만 서울로는 2026년 1월 1일
    const seoulNewYear = toInstant('2025-12-31T16:00:00Z');
    const later = toInstant('2026-02-01T00:00:00Z');

    // When
    const result = formatRelativeTimeWith(seoulNewYear, later, labels, KO_SEOUL);

    // Then
    expect(result).toBe('1월 1일');
  });
});

describe('formatDateLabel monthDay 윤일 경계', () => {
  // 2028-02-29T15:00Z = 서울 3월 1일 00:00, LA 2월 29일 07:00
  const LEAP_DAY_BOUNDARY = toInstant('2028-02-29T15:00:00Z');

  it.each([
    ['ko-KR', 'Asia/Seoul', '3월 1일'],
    ['ko-KR', 'America/Los_Angeles', '2월 29일'],
    ['en-US', 'Asia/Seoul', 'Mar 1'],
    ['en-US', 'America/Los_Angeles', 'Feb 29'],
  ] as const)('%s·%s에서는 %s로 표시한다', (locale, timeZone, expected) => {
    // When
    const result = formatDateLabel(LEAP_DAY_BOUNDARY, 'monthDay', { locale, timeZone });

    // Then
    expect(result).toBe(expected);
  });
});

describe('formatHHmmTime', () => {
  const koSeoul = { locale: 'ko-KR', timeZone: 'Asia/Seoul' } as const;

  it('HH:mm 시각을 사용자 시간 형식과 표시 언어로 바꾼다', () => {
    // When
    const twentyFour = formatHHmmTime('14:30', 'TWENTY_FOUR_HOUR', koSeoul);
    const twelve = formatHHmmTime('14:30', 'TWELVE_HOUR', koSeoul);

    // Then
    expect(twentyFour).toBe('14:30');
    expect(twelve).toBe('오후\u00A02:30');
  });

  it('유효하지 않은 시간 문자열은 원본 그대로 돌려준다', () => {
    // When
    const result = formatHHmmTime('invalid', 'TWELVE_HOUR', koSeoul);

    // Then
    expect(result).toBe('invalid');
  });

  it.each([
    ['ko-KR', '00:00', 'TWELVE_HOUR', '오전\u00A012:00'],
    ['ko-KR', '00:00', 'TWENTY_FOUR_HOUR', '00:00'],
    ['ko-KR', '09:05', 'TWELVE_HOUR', '오전\u00A09:05'],
    ['ko-KR', '09:05', 'TWENTY_FOUR_HOUR', '09:05'],
    ['ko-KR', '12:30', 'TWELVE_HOUR', '오후\u00A012:30'],
    ['ko-KR', '12:30', 'TWENTY_FOUR_HOUR', '12:30'],
    ['ko-KR', '23:59', 'TWELVE_HOUR', '오후\u00A011:59'],
    ['ko-KR', '23:59', 'TWENTY_FOUR_HOUR', '23:59'],
    ['en-US', '00:00', 'TWELVE_HOUR', '12:00\u00A0AM'],
    ['en-US', '00:00', 'TWENTY_FOUR_HOUR', '00:00'],
    ['en-US', '09:05', 'TWELVE_HOUR', '9:05\u00A0AM'],
    ['en-US', '09:05', 'TWENTY_FOUR_HOUR', '09:05'],
    ['en-US', '12:30', 'TWELVE_HOUR', '12:30\u00A0PM'],
    ['en-US', '12:30', 'TWENTY_FOUR_HOUR', '12:30'],
    ['en-US', '23:59', 'TWELVE_HOUR', '11:59\u00A0PM'],
    ['en-US', '23:59', 'TWENTY_FOUR_HOUR', '23:59'],
  ] as const)('%s %s %s는 이전과 같은 글자다', (locale, time, timeFormat, expected) => {
    // When
    const label = formatHHmmTime(time, timeFormat, { locale, timeZone: 'Asia/Seoul' });

    // Then
    expect(label).toBe(expected);
  });
});

// dayjs를 지우기 전 구현이 만든 글자다. 계산을 바꿔도 화면 글자는 바이트 단위로 같아야 한다
describe('formatDateLabel', () => {
  it.each([
    ['Asia/Seoul', 'ko-KR', '2026-03-08T10:00:00.000Z', 'fullDate', '2026년 3월 8일'],
    ['Asia/Seoul', 'ko-KR', '2026-03-08T10:00:00.000Z', 'monthDay', '3월 8일'],
    ['Asia/Seoul', 'ko-KR', '2026-03-08T10:00:00.000Z', 'numericDate', '2026. 3. 8.'],
    ['Asia/Seoul', 'ko-KR', '2026-03-08T10:00:00.000Z', 'dottedMonthDay', '03.08'],
    ['Asia/Seoul', 'ko-KR', '2026-03-08T10:00:00.000Z', 'dayNumber', '8'],
    ['Asia/Seoul', 'ko-KR', '2026-03-08T10:00:00.000Z', 'yearShortMonth', '2026년 3월'],
    ['Asia/Seoul', 'ko-KR', '2026-03-08T10:00:00.000Z', 'weekday', '일'],
    ['Asia/Seoul', 'ko-KR', '2026-11-01T08:00:00.000Z', 'fullDate', '2026년 11월 1일'],
    ['Asia/Seoul', 'ko-KR', '2026-11-01T08:00:00.000Z', 'monthDay', '11월 1일'],
    ['Asia/Seoul', 'ko-KR', '2026-11-01T08:00:00.000Z', 'numericDate', '2026. 11. 1.'],
    ['Asia/Seoul', 'ko-KR', '2026-11-01T08:00:00.000Z', 'dottedMonthDay', '11.01'],
    ['Asia/Seoul', 'ko-KR', '2026-11-01T08:00:00.000Z', 'dayNumber', '1'],
    ['Asia/Seoul', 'ko-KR', '2026-11-01T08:00:00.000Z', 'yearShortMonth', '2026년 11월'],
    ['Asia/Seoul', 'ko-KR', '2026-11-01T08:00:00.000Z', 'weekday', '일'],
    ['Asia/Seoul', 'ko-KR', '2026-12-31T13:15:00.000Z', 'fullDate', '2026년 12월 31일'],
    ['Asia/Seoul', 'ko-KR', '2026-12-31T13:15:00.000Z', 'monthDay', '12월 31일'],
    ['Asia/Seoul', 'ko-KR', '2026-12-31T13:15:00.000Z', 'numericDate', '2026. 12. 31.'],
    ['Asia/Seoul', 'ko-KR', '2026-12-31T13:15:00.000Z', 'dottedMonthDay', '12.31'],
    ['Asia/Seoul', 'ko-KR', '2026-12-31T13:15:00.000Z', 'dayNumber', '31'],
    ['Asia/Seoul', 'ko-KR', '2026-12-31T13:15:00.000Z', 'yearShortMonth', '2026년 12월'],
    ['Asia/Seoul', 'ko-KR', '2026-12-31T13:15:00.000Z', 'weekday', '목'],
    ['Asia/Seoul', 'ko-KR', '2028-02-29T12:00:00.000Z', 'fullDate', '2028년 2월 29일'],
    ['Asia/Seoul', 'ko-KR', '2028-02-29T12:00:00.000Z', 'monthDay', '2월 29일'],
    ['Asia/Seoul', 'ko-KR', '2028-02-29T12:00:00.000Z', 'numericDate', '2028. 2. 29.'],
    ['Asia/Seoul', 'ko-KR', '2028-02-29T12:00:00.000Z', 'dottedMonthDay', '02.29'],
    ['Asia/Seoul', 'ko-KR', '2028-02-29T12:00:00.000Z', 'dayNumber', '29'],
    ['Asia/Seoul', 'ko-KR', '2028-02-29T12:00:00.000Z', 'yearShortMonth', '2028년 2월'],
    ['Asia/Seoul', 'ko-KR', '2028-02-29T12:00:00.000Z', 'weekday', '화'],
    ['Asia/Seoul', 'en-US', '2026-03-08T10:00:00.000Z', 'fullDate', 'March 8, 2026'],
    ['Asia/Seoul', 'en-US', '2026-03-08T10:00:00.000Z', 'monthDay', 'Mar 8'],
    ['Asia/Seoul', 'en-US', '2026-03-08T10:00:00.000Z', 'numericDate', '3/8/2026'],
    ['Asia/Seoul', 'en-US', '2026-03-08T10:00:00.000Z', 'dottedMonthDay', '03.08'],
    ['Asia/Seoul', 'en-US', '2026-03-08T10:00:00.000Z', 'dayNumber', '8'],
    ['Asia/Seoul', 'en-US', '2026-03-08T10:00:00.000Z', 'yearShortMonth', 'Mar 2026'],
    ['Asia/Seoul', 'en-US', '2026-03-08T10:00:00.000Z', 'weekday', 'Sun'],
    ['Asia/Seoul', 'en-US', '2026-11-01T08:00:00.000Z', 'fullDate', 'November 1, 2026'],
    ['Asia/Seoul', 'en-US', '2026-11-01T08:00:00.000Z', 'monthDay', 'Nov 1'],
    ['Asia/Seoul', 'en-US', '2026-11-01T08:00:00.000Z', 'numericDate', '11/1/2026'],
    ['Asia/Seoul', 'en-US', '2026-11-01T08:00:00.000Z', 'dottedMonthDay', '11.01'],
    ['Asia/Seoul', 'en-US', '2026-11-01T08:00:00.000Z', 'dayNumber', '1'],
    ['Asia/Seoul', 'en-US', '2026-11-01T08:00:00.000Z', 'yearShortMonth', 'Nov 2026'],
    ['Asia/Seoul', 'en-US', '2026-11-01T08:00:00.000Z', 'weekday', 'Sun'],
    ['Asia/Seoul', 'en-US', '2026-12-31T13:15:00.000Z', 'fullDate', 'December 31, 2026'],
    ['Asia/Seoul', 'en-US', '2026-12-31T13:15:00.000Z', 'monthDay', 'Dec 31'],
    ['Asia/Seoul', 'en-US', '2026-12-31T13:15:00.000Z', 'numericDate', '12/31/2026'],
    ['Asia/Seoul', 'en-US', '2026-12-31T13:15:00.000Z', 'dottedMonthDay', '12.31'],
    ['Asia/Seoul', 'en-US', '2026-12-31T13:15:00.000Z', 'dayNumber', '31'],
    ['Asia/Seoul', 'en-US', '2026-12-31T13:15:00.000Z', 'yearShortMonth', 'Dec 2026'],
    ['Asia/Seoul', 'en-US', '2026-12-31T13:15:00.000Z', 'weekday', 'Thu'],
    ['Asia/Seoul', 'en-US', '2028-02-29T12:00:00.000Z', 'fullDate', 'February 29, 2028'],
    ['Asia/Seoul', 'en-US', '2028-02-29T12:00:00.000Z', 'monthDay', 'Feb 29'],
    ['Asia/Seoul', 'en-US', '2028-02-29T12:00:00.000Z', 'numericDate', '2/29/2028'],
    ['Asia/Seoul', 'en-US', '2028-02-29T12:00:00.000Z', 'dottedMonthDay', '02.29'],
    ['Asia/Seoul', 'en-US', '2028-02-29T12:00:00.000Z', 'dayNumber', '29'],
    ['Asia/Seoul', 'en-US', '2028-02-29T12:00:00.000Z', 'yearShortMonth', 'Feb 2028'],
    ['Asia/Seoul', 'en-US', '2028-02-29T12:00:00.000Z', 'weekday', 'Tue'],
    ['America/Los_Angeles', 'ko-KR', '2026-03-08T10:00:00.000Z', 'fullDate', '2026년 3월 8일'],
    ['America/Los_Angeles', 'ko-KR', '2026-03-08T10:00:00.000Z', 'monthDay', '3월 8일'],
    ['America/Los_Angeles', 'ko-KR', '2026-03-08T10:00:00.000Z', 'numericDate', '2026. 3. 8.'],
    ['America/Los_Angeles', 'ko-KR', '2026-03-08T10:00:00.000Z', 'dottedMonthDay', '03.08'],
    ['America/Los_Angeles', 'ko-KR', '2026-03-08T10:00:00.000Z', 'dayNumber', '8'],
    ['America/Los_Angeles', 'ko-KR', '2026-03-08T10:00:00.000Z', 'yearShortMonth', '2026년 3월'],
    ['America/Los_Angeles', 'ko-KR', '2026-03-08T10:00:00.000Z', 'weekday', '일'],
    ['America/Los_Angeles', 'ko-KR', '2026-11-01T08:00:00.000Z', 'fullDate', '2026년 11월 1일'],
    ['America/Los_Angeles', 'ko-KR', '2026-11-01T08:00:00.000Z', 'monthDay', '11월 1일'],
    ['America/Los_Angeles', 'ko-KR', '2026-11-01T08:00:00.000Z', 'numericDate', '2026. 11. 1.'],
    ['America/Los_Angeles', 'ko-KR', '2026-11-01T08:00:00.000Z', 'dottedMonthDay', '11.01'],
    ['America/Los_Angeles', 'ko-KR', '2026-11-01T08:00:00.000Z', 'dayNumber', '1'],
    ['America/Los_Angeles', 'ko-KR', '2026-11-01T08:00:00.000Z', 'yearShortMonth', '2026년 11월'],
    ['America/Los_Angeles', 'ko-KR', '2026-11-01T08:00:00.000Z', 'weekday', '일'],
    ['America/Los_Angeles', 'ko-KR', '2026-12-31T13:15:00.000Z', 'fullDate', '2026년 12월 31일'],
    ['America/Los_Angeles', 'ko-KR', '2026-12-31T13:15:00.000Z', 'monthDay', '12월 31일'],
    ['America/Los_Angeles', 'ko-KR', '2026-12-31T13:15:00.000Z', 'numericDate', '2026. 12. 31.'],
    ['America/Los_Angeles', 'ko-KR', '2026-12-31T13:15:00.000Z', 'dottedMonthDay', '12.31'],
    ['America/Los_Angeles', 'ko-KR', '2026-12-31T13:15:00.000Z', 'dayNumber', '31'],
    ['America/Los_Angeles', 'ko-KR', '2026-12-31T13:15:00.000Z', 'yearShortMonth', '2026년 12월'],
    ['America/Los_Angeles', 'ko-KR', '2026-12-31T13:15:00.000Z', 'weekday', '목'],
    ['America/Los_Angeles', 'ko-KR', '2028-02-29T12:00:00.000Z', 'fullDate', '2028년 2월 29일'],
    ['America/Los_Angeles', 'ko-KR', '2028-02-29T12:00:00.000Z', 'monthDay', '2월 29일'],
    ['America/Los_Angeles', 'ko-KR', '2028-02-29T12:00:00.000Z', 'numericDate', '2028. 2. 29.'],
    ['America/Los_Angeles', 'ko-KR', '2028-02-29T12:00:00.000Z', 'dottedMonthDay', '02.29'],
    ['America/Los_Angeles', 'ko-KR', '2028-02-29T12:00:00.000Z', 'dayNumber', '29'],
    ['America/Los_Angeles', 'ko-KR', '2028-02-29T12:00:00.000Z', 'yearShortMonth', '2028년 2월'],
    ['America/Los_Angeles', 'ko-KR', '2028-02-29T12:00:00.000Z', 'weekday', '화'],
    ['America/Los_Angeles', 'en-US', '2026-03-08T10:00:00.000Z', 'fullDate', 'March 8, 2026'],
    ['America/Los_Angeles', 'en-US', '2026-03-08T10:00:00.000Z', 'monthDay', 'Mar 8'],
    ['America/Los_Angeles', 'en-US', '2026-03-08T10:00:00.000Z', 'numericDate', '3/8/2026'],
    ['America/Los_Angeles', 'en-US', '2026-03-08T10:00:00.000Z', 'dottedMonthDay', '03.08'],
    ['America/Los_Angeles', 'en-US', '2026-03-08T10:00:00.000Z', 'dayNumber', '8'],
    ['America/Los_Angeles', 'en-US', '2026-03-08T10:00:00.000Z', 'yearShortMonth', 'Mar 2026'],
    ['America/Los_Angeles', 'en-US', '2026-03-08T10:00:00.000Z', 'weekday', 'Sun'],
    ['America/Los_Angeles', 'en-US', '2026-11-01T08:00:00.000Z', 'fullDate', 'November 1, 2026'],
    ['America/Los_Angeles', 'en-US', '2026-11-01T08:00:00.000Z', 'monthDay', 'Nov 1'],
    ['America/Los_Angeles', 'en-US', '2026-11-01T08:00:00.000Z', 'numericDate', '11/1/2026'],
    ['America/Los_Angeles', 'en-US', '2026-11-01T08:00:00.000Z', 'dottedMonthDay', '11.01'],
    ['America/Los_Angeles', 'en-US', '2026-11-01T08:00:00.000Z', 'dayNumber', '1'],
    ['America/Los_Angeles', 'en-US', '2026-11-01T08:00:00.000Z', 'yearShortMonth', 'Nov 2026'],
    ['America/Los_Angeles', 'en-US', '2026-11-01T08:00:00.000Z', 'weekday', 'Sun'],
    ['America/Los_Angeles', 'en-US', '2026-12-31T13:15:00.000Z', 'fullDate', 'December 31, 2026'],
    ['America/Los_Angeles', 'en-US', '2026-12-31T13:15:00.000Z', 'monthDay', 'Dec 31'],
    ['America/Los_Angeles', 'en-US', '2026-12-31T13:15:00.000Z', 'numericDate', '12/31/2026'],
    ['America/Los_Angeles', 'en-US', '2026-12-31T13:15:00.000Z', 'dottedMonthDay', '12.31'],
    ['America/Los_Angeles', 'en-US', '2026-12-31T13:15:00.000Z', 'dayNumber', '31'],
    ['America/Los_Angeles', 'en-US', '2026-12-31T13:15:00.000Z', 'yearShortMonth', 'Dec 2026'],
    ['America/Los_Angeles', 'en-US', '2026-12-31T13:15:00.000Z', 'weekday', 'Thu'],
    ['America/Los_Angeles', 'en-US', '2028-02-29T12:00:00.000Z', 'fullDate', 'February 29, 2028'],
    ['America/Los_Angeles', 'en-US', '2028-02-29T12:00:00.000Z', 'monthDay', 'Feb 29'],
    ['America/Los_Angeles', 'en-US', '2028-02-29T12:00:00.000Z', 'numericDate', '2/29/2028'],
    ['America/Los_Angeles', 'en-US', '2028-02-29T12:00:00.000Z', 'dottedMonthDay', '02.29'],
    ['America/Los_Angeles', 'en-US', '2028-02-29T12:00:00.000Z', 'dayNumber', '29'],
    ['America/Los_Angeles', 'en-US', '2028-02-29T12:00:00.000Z', 'yearShortMonth', 'Feb 2028'],
    ['America/Los_Angeles', 'en-US', '2028-02-29T12:00:00.000Z', 'weekday', 'Tue'],
  ] as const)('%s %s %s %s는 이전과 같은 글자다', (timeZone, locale, iso, kind, expected) => {
    // When
    const label = formatDateLabel(toInstant(iso), kind, { locale, timeZone });

    // Then
    expect(label).toBe(expected);
  });
});
