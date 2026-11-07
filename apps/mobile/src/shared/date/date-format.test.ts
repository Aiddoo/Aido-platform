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
} from './date-format';
import { fromEpochMs, toEpochMs, toInstant } from './instant';

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
    expect(result).toBe('오후 2:30');
  });

  it('ko 24시간제는 두 자리 시와 분만 표시한다', () => {
    // Given
    const morning = new Date('2026-10-01T00:05:00Z');

    // When
    const result = formatClockTime(morning, 'TWENTY_FOUR_HOUR', KO_SEOUL);

    // Then
    expect(result).toBe('09:05');
  });

  it('en 12시간제는 AM/PM을 시각 뒤에 둔다', () => {
    // Given
    const afternoon = new Date('2026-10-01T05:30:00Z');

    // When
    const result = formatClockTime(afternoon, 'TWELVE_HOUR', EN_SEOUL);

    // Then
    expect(result).toBe('2:30 PM');
  });

  it('24시간제 자정을 24:00이 아닌 00:05로 표시한다', () => {
    // When
    const result = formatClockTime(date, 'TWENTY_FOUR_HOUR', { locale: 'en-US', timeZone: 'UTC' });

    // Then
    expect(result).toBe('00:05');
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
    expect(ko).toBe('오후 6:30');
    expect(en).toBe('6:30 PM');
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
    expect(midnight).toBe('오전 12시');
    expect(afternoon).toBe('오후 3시');
    expect(twentyFour).toBe('15시');
    expect(en).toBe('3 PM');
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
    expect(ko).toBe('오후 3시');
    expect(en).toBe('3 PM');
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
});

describe('formatDateKeyRange', () => {
  it('같은 해의 기간은 월·일만 표시한다', () => {
    // When
    const ko = formatDateKeyRange('2026-10-19', '2026-10-25', KO_SEOUL);
    const en = formatDateKeyRange('2026-10-19', '2026-10-25', EN_SEOUL);

    // Then
    expect(ko).toBe('10월 19일 ~ 10월 25일');
    expect(en).toBe('Oct 19 ~ Oct 25');
  });

  it('해를 넘는 기간은 연도까지 표시한다', () => {
    // When
    const range = formatDateKeyRange('2026-12-28', '2027-01-03', KO_SEOUL);

    // Then
    expect(range).toBe('2026년 12월 28일 ~ 2027년 1월 3일');
  });
});

describe('formatDateKeyCompactRange', () => {
  it('같은 달이면 끝은 날만 쓴다', () => {
    // When
    const ko = formatDateKeyCompactRange('2026-11-05', '2026-11-07', KO_SEOUL);
    const en = formatDateKeyCompactRange('2026-11-05', '2026-11-07', EN_SEOUL);

    // Then
    expect(ko).toBe('11월 5일~7일');
    expect(en).toBe('Nov 5~7');
  });

  it('달이 다르면 끝에도 달을 쓰고 해가 다르면 연도까지 쓴다', () => {
    // When
    const otherMonth = formatDateKeyCompactRange('2026-11-30', '2026-12-02', KO_SEOUL);
    const otherYear = formatDateKeyCompactRange('2026-12-30', '2027-01-02', KO_SEOUL);

    // Then
    expect(otherMonth).toBe('11월 30일~12월 2일');
    expect(otherYear).toBe('2026년 12월 30일 ~ 2027년 1월 2일');
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
    expect(twelve).toBe('오후 2:30');
  });

  it('유효하지 않은 시간 문자열은 원본 그대로 돌려준다', () => {
    // When
    const result = formatHHmmTime('invalid', 'TWELVE_HOUR', koSeoul);

    // Then
    expect(result).toBe('invalid');
  });
});
