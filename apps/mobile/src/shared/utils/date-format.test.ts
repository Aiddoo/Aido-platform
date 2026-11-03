import {
  type DateFormatContext,
  formatClockTime,
  formatDateKey,
  formatDateKeyLabel,
  formatDateKeyRange,
  formatDateLabel,
  formatHourLabel,
  formatInstantHour,
  formatRelativeTime,
  formatTimeOfDay,
  formatZonedHHmm,
  getZonedHour,
  hasSameWallClock,
} from './date-format';

const date = new Date('2026-10-01T00:05:00Z');
const KO_SEOUL: DateFormatContext = { locale: 'ko-KR', timeZone: 'Asia/Seoul' };
const EN_SEOUL: DateFormatContext = { locale: 'en-US', timeZone: 'Asia/Seoul' };

describe('native date formatting', () => {
  it('uses the explicit locale and time zone', () => {
    expect(formatDateLabel(date, 'fullDate', KO_SEOUL)).toBe('2026년 10월 1일');
    expect(
      formatDateLabel(date, 'fullDate', { locale: 'en-US', timeZone: 'America/Los_Angeles' }),
    ).toBe('September 30, 2026');
  });

  it('rejects invalid dates without throwing during rendering', () => {
    expect(
      formatDateLabel(new Date('invalid'), 'fullDate', { locale: 'ko-KR', timeZone: 'UTC' }),
    ).toBe('');
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
    expect(formatClockTime(date, 'TWENTY_FOUR_HOUR', { locale: 'en-US', timeZone: 'UTC' })).toBe(
      '00:05',
    );
  });
});

describe('formatTimeOfDay', () => {
  it('기기 시간대와 무관하게 HH:mm 시각을 로케일 순서로 표시한다', () => {
    const time = { hour: 18, minute: 30 };

    expect(formatTimeOfDay(time, 'TWELVE_HOUR', KO_SEOUL)).toBe('오후 6:30');
    expect(formatTimeOfDay(time, 'TWELVE_HOUR', EN_SEOUL)).toBe('6:30 PM');
    expect(formatTimeOfDay(time, 'TWENTY_FOUR_HOUR', KO_SEOUL)).toBe('18:30');
  });
});

describe('formatHourLabel', () => {
  it('정시를 사용자 시간 형식과 로케일 순서로 표시한다', () => {
    expect(formatHourLabel(0, 'TWELVE_HOUR', KO_SEOUL)).toBe('오전 12시');
    expect(formatHourLabel(15, 'TWELVE_HOUR', KO_SEOUL)).toBe('오후 3시');
    expect(formatHourLabel(15, 'TWENTY_FOUR_HOUR', KO_SEOUL)).toBe('15시');
    expect(formatHourLabel(15, 'TWELVE_HOUR', EN_SEOUL)).toBe('3 PM');
  });
});

describe('formatInstantHour', () => {
  it('순간을 context 시간대의 정시로 표시하고 언어는 글자 모양만 바꾼다', () => {
    // Given 서울 15:20이자 LA 23:20인 순간
    const instant = new Date('2026-10-01T06:20:00Z');

    // When / Then
    expect(formatInstantHour(instant, 'TWELVE_HOUR', KO_SEOUL)).toBe('오후 3시');
    expect(formatInstantHour(instant, 'TWELVE_HOUR', EN_SEOUL)).toBe('3 PM');
    expect(
      formatInstantHour(instant, 'TWENTY_FOUR_HOUR', {
        locale: 'ko-KR',
        timeZone: 'America/Los_Angeles',
      }),
    ).toBe('23시');
  });
});

describe('formatDateKeyLabel', () => {
  it('위젯용 숫자 일과 MM.DD 표기는 로케일과 무관하게 유지한다', () => {
    expect(formatDateKeyLabel('2026-09-07', 'dayNumber', KO_SEOUL)).toBe('7');
    expect(formatDateKeyLabel('2026-09-07', 'dottedMonthDay', KO_SEOUL)).toBe('09.07');
    expect(formatDateKeyLabel('2026-09-07', 'dottedMonthDay', EN_SEOUL)).toBe('09.07');
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
    // Given: 서울보다 하루 늦은 시간대
    const losAngeles = { locale: 'ko-KR', timeZone: 'America/Los_Angeles' } as const;

    // When / Then
    expect(formatDateKeyLabel('2026-10-20', 'fullDate', losAngeles)).toBe('2026년 10월 20일');
    expect(formatDateKeyLabel('2028-02-29', 'fullDate', EN_SEOUL)).toBe('February 29, 2028');
  });
});

describe('formatDateKeyRange', () => {
  it('같은 해의 기간은 월·일만 표시한다', () => {
    expect(formatDateKeyRange('2026-10-19', '2026-10-25', KO_SEOUL)).toBe('10월 19일 ~ 10월 25일');
    expect(formatDateKeyRange('2026-10-19', '2026-10-25', EN_SEOUL)).toBe('Oct 19 ~ Oct 25');
  });

  it('해를 넘는 기간은 연도까지 표시한다', () => {
    expect(formatDateKeyRange('2026-12-28', '2027-01-03', KO_SEOUL)).toBe(
      '2026년 12월 28일 ~ 2027년 1월 3일',
    );
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-10-25T03:00:00Z');
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
  const labels = {
    justNow: 'justNow',
    minutesAgo: (count: number) => `minutes:${count}`,
    hoursAgo: (count: number) => `hours:${count}`,
    daysAgo: (count: number) => `days:${count}`,
  };

  it('7일 미만은 경과 구간에 맞는 주입 문구를 내림한 개수로 고른다', () => {
    expect(formatRelativeTime(minutesAgo(0.5), now, labels, KO_SEOUL)).toBe('justNow');
    expect(formatRelativeTime(minutesAgo(59), now, labels, KO_SEOUL)).toBe('minutes:59');
    expect(formatRelativeTime(minutesAgo(3 * 60 + 59), now, labels, KO_SEOUL)).toBe('hours:3');
    expect(formatRelativeTime(minutesAgo(6 * 24 * 60), now, labels, KO_SEOUL)).toBe('days:6');
  });

  it('7일 이상은 같은 해면 월·일, 다른 해면 연도를 포함한 날짜로 표시한다', () => {
    expect(formatRelativeTime(new Date('2026-01-05T03:00:00Z'), now, labels, KO_SEOUL)).toBe(
      '1월 5일',
    );
    expect(formatRelativeTime(new Date('2025-01-05T03:00:00Z'), now, labels, EN_SEOUL)).toBe(
      '1/5/2025',
    );
  });

  it('연도 경계는 context 시간대 기준으로 판단한다', () => {
    // Given: UTC로는 2025년이지만 서울로는 2026년 1월 1일
    const seoulNewYear = new Date('2025-12-31T16:00:00Z');
    const later = new Date('2026-02-01T00:00:00Z');

    // When
    const result = formatRelativeTime(seoulNewYear, later, labels, KO_SEOUL);

    // Then
    expect(result).toBe('1월 1일');
  });
});

describe('formatDateKey', () => {
  it.each([
    ['서울 자정 직전', '2026-10-01T14:59:59.999Z', '2026-10-01', '2026-10-01'],
    ['서울 자정 정각', '2026-10-01T15:00:00.000Z', '2026-10-02', '2026-10-01'],
    ['LA 자정 정각', '2026-10-02T07:00:00.000Z', '2026-10-02', '2026-10-02'],
  ])('%s에는 같은 시각이어도 서울과 LA의 날짜가 다르다', (_name, iso, seoulKey, losAngelesKey) => {
    // Given
    const instant = new Date(iso);

    // When
    const seoul = formatDateKey(instant, 'Asia/Seoul');
    const losAngeles = formatDateKey(instant, 'America/Los_Angeles');

    // Then
    expect(seoul).toBe(seoulKey);
    expect(losAngeles).toBe(losAngelesKey);
  });

  it('윤일 경계에서 서울은 3월 1일, LA는 2월 29일이다', () => {
    // Given
    const instant = new Date('2028-02-29T15:00:00.000Z');

    // When
    const seoul = formatDateKey(instant, 'Asia/Seoul');
    const losAngeles = formatDateKey(instant, 'America/Los_Angeles');

    // Then
    expect(seoul).toBe('2028-03-01');
    expect(losAngeles).toBe('2028-02-29');
  });

  it('유효하지 않은 Date는 빈 문자열을 반환한다', () => {
    // Given
    const invalid = new Date(Number.NaN);

    // When
    const result = formatDateKey(invalid, 'Asia/Seoul');

    // Then
    expect(result).toBe('');
  });
});

describe('getZonedHour', () => {
  it('지정 시간대의 0-23시를 반환한다', () => {
    expect(getZonedHour(new Date('2026-10-01T15:30:00Z'), 'Asia/Seoul')).toBe(0);
    expect(getZonedHour(new Date('2026-10-01T14:30:00Z'), 'Asia/Seoul')).toBe(23);
  });
});

describe('formatZonedHHmm — 시간대 기준 HH:mm', () => {
  it('같은 순간을 서울과 LA의 24시간제 HH:mm으로 읽는다', () => {
    // Given
    const instant = new Date('2028-02-29T15:05:00Z');

    // When
    const seoul = formatZonedHHmm(instant, 'Asia/Seoul');
    const losAngeles = formatZonedHHmm(instant, 'America/Los_Angeles');

    // Then
    expect(seoul).toBe('00:05');
    expect(losAngeles).toBe('07:05');
  });
});

describe('formatDateLabel monthDay 윤일 경계', () => {
  // 2028-02-29T15:00Z = 서울 3월 1일 00:00, LA 2월 29일 07:00
  const LEAP_DAY_BOUNDARY = new Date('2028-02-29T15:00:00Z');

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

describe('hasSameWallClock', () => {
  const instant = new Date('2026-10-01T06:20:00Z');

  it('이름이 달라도 오프셋이 같은 시간대는 같은 벽시계로 본다', () => {
    // Given 서울과 도쿄 When 비교하면 Then 같다
    expect(hasSameWallClock(instant, 'Asia/Seoul', 'Asia/Tokyo')).toBe(true);
  });

  it('30분 차이도 다른 벽시계로 본다', () => {
    // Given 인도(+5:30)와 파키스탄(+5:00) When 비교하면 Then 다르다
    expect(hasSameWallClock(instant, 'Asia/Kolkata', 'Asia/Karachi')).toBe(false);
  });

  it('서머타임으로 오프셋이 갈리는 날은 그날의 오프셋으로 판단한다', () => {
    // Given LA 서머타임 해제(11월 1일) 전후의 LA·피닉스
    const beforeFallBack = new Date('2026-10-31T20:00:00Z');
    const afterFallBack = new Date('2026-11-02T20:00:00Z');

    // When / Then 서머타임 동안(-7)만 같고 해제 뒤(-8 대 -7)에는 다르다
    expect(hasSameWallClock(beforeFallBack, 'America/Los_Angeles', 'America/Phoenix')).toBe(true);
    expect(hasSameWallClock(afterFallBack, 'America/Los_Angeles', 'America/Phoenix')).toBe(false);
  });
});
