import type { DayOfWeek } from '@aido/api';
import { i18n } from '@src/shared/i18n';

import {
  diffMonths,
  diffWeeks,
  formatDaysOfWeek,
  formatRelativeTimeLabel,
  getCalendarRange,
  getDateSectionKey,
  getDayOfWeekLabel,
  getMonthWeeks,
  getWeekdayLabels,
  formatWeekOfMonthLabel,
  getWeekRange,
} from './date';

afterEach(async () => {
  await i18n.changeLanguage('ko');
});

describe('formatDaysOfWeek', () => {
  it('여러 요일을 순서대로 정렬하여 한글로 변환해야 한다', () => {
    // Given
    const days: DayOfWeek[] = ['FRI', 'MON', 'WED'];

    // When
    const result = formatDaysOfWeek(days);

    // Then
    expect(result).toBe('월, 수, 금');
  });

  it('단일 요일을 한글로 변환해야 한다', () => {
    // Given
    const days: DayOfWeek[] = ['TUE'];

    // When
    const result = formatDaysOfWeek(days);

    // Then
    expect(result).toBe('화');
  });

  it('전체 요일을 일~토 순서로 변환해야 한다', () => {
    // Given
    const days: DayOfWeek[] = ['SUN', 'SAT', 'FRI', 'THU', 'WED', 'TUE', 'MON'];

    // When
    const result = formatDaysOfWeek(days);

    // Then
    expect(result).toBe('일, 월, 화, 수, 목, 금, 토');
  });

  it('빈 배열이면 빈 문자열을 반환해야 한다', () => {
    // Given
    const days: DayOfWeek[] = [];

    // When
    const result = formatDaysOfWeek(days);

    // Then
    expect(result).toBe('');
  });

  it('원본 배열을 변경하지 않아야 한다', () => {
    // Given
    const days: DayOfWeek[] = ['FRI', 'MON'];

    // When
    formatDaysOfWeek(days);

    // Then
    expect(days).toEqual(['FRI', 'MON']);
  });
});

describe('getMonthWeeks', () => {
  it('5주짜리 달은 5주를 반환해야 한다', () => {
    // Given — 2026년 7월 (5주)
    const july = new Date(2026, 6, 1);

    // When
    const weeks = getMonthWeeks(july);

    // Then
    expect(weeks).toHaveLength(5);
  });

  it('각 주는 7일이어야 한다', () => {
    // Given
    const april = new Date(2026, 3, 1);

    // When
    const weeks = getMonthWeeks(april);

    // Then
    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }
  });

  it('6주짜리 달은 6주를 반환해야 한다', () => {
    // Given — 2026년 8월 (6주)
    const august = new Date(2026, 7, 1);

    // When
    const weeks = getMonthWeeks(august);

    // Then
    expect(weeks).toHaveLength(6);
  });
});

describe('표시 언어와 무관한 달력 범위', () => {
  test.each(['ko', 'en'] as const)('%s에서도 주·월 범위는 일요일 시작이다', async (language) => {
    // Given
    await i18n.changeLanguage(language);
    const monday = new Date(2026, 9, 26);

    // When
    const weekRange = getWeekRange(monday);
    const monthRange = getCalendarRange(monday);
    const [firstWeek] = getMonthWeeks(monday);

    // Then
    expect(weekRange).toEqual({ rangeStart: '2026-10-25', rangeEnd: '2026-10-31' });
    expect(monthRange).toEqual({ rangeStart: '2026-09-27', rangeEnd: '2026-10-31' });
    expect(firstWeek?.[0]).toEqual(new Date(2026, 8, 27));
  });
});

describe('getDateSectionKey', () => {
  test('이번 주는 달력과 같은 일요일 시작 주다', () => {
    // Given: 일요일 오늘, ISO 주(월요일 시작)로는 같은 주였던 지난 수요일
    const sundayDateKey = '2026-10-25';

    // When
    const section = getDateSectionKey('2026-10-21', sundayDateKey);

    // Then
    expect(section).toBe('thisMonth');
    expect(getDateSectionKey('2026-10-26', '2026-10-31')).toBe('thisWeek');
  });

  test('연말을 넘는 주와 어제를 날짜 key로 판단한다', () => {
    // Given: 2026-12-27(일)~2027-01-02(토) 주
    const newYearDateKey = '2027-01-01';

    // When / Then
    expect(getDateSectionKey('2026-12-31', newYearDateKey)).toBe('yesterday');
    expect(getDateSectionKey('2026-12-27', newYearDateKey)).toBe('thisWeek');
    expect(getDateSectionKey('2026-12-26', newYearDateKey)).toBe('earlier');
    expect(getDateSectionKey('2028-02-28', '2028-02-29')).toBe('yesterday');
  });
});

describe('diffWeeks', () => {
  it('같은 주 안이면 0을 반환해야 한다', () => {
    // Given — 2026-04-13(월) 기준 같은 주 목요일
    const monday = new Date(2026, 3, 13);
    const thursday = new Date(2026, 3, 16);

    // When
    const result = diffWeeks(thursday, monday);

    // Then
    expect(result).toBe(0);
  });

  it('다음 주면 1, 이전 주면 -1을 반환해야 한다', () => {
    // Given
    const base = new Date(2026, 3, 13);
    const nextWeek = new Date(2026, 3, 20);
    const previousWeek = new Date(2026, 3, 6);

    // When / Then
    expect(diffWeeks(nextWeek, base)).toBe(1);
    expect(diffWeeks(previousWeek, base)).toBe(-1);
  });

  it('주 단위로 정규화되므로 요일이 달라도 같은 결과를 반환해야 한다', () => {
    // Given — 2주 차이(서로 다른 요일)
    const base = new Date(2026, 3, 13); // 월
    const twoWeeksLater = new Date(2026, 3, 30); // 목 (2주 + 3일)

    // When
    const result = diffWeeks(twoWeeksLater, base);

    // Then — startOf('week') 기준이므로 정확히 2
    expect(result).toBe(2);
  });
});

describe('diffMonths', () => {
  it('같은 달 안이면 0을 반환해야 한다', () => {
    // Given
    const day1 = new Date(2026, 3, 1);
    const day15 = new Date(2026, 3, 15);

    // When
    const result = diffMonths(day15, day1);

    // Then
    expect(result).toBe(0);
  });

  it('다음 달이면 1, 이전 달이면 -1을 반환해야 한다', () => {
    // Given
    const april = new Date(2026, 3, 15);
    const may = new Date(2026, 4, 15);
    const march = new Date(2026, 2, 15);

    // When / Then
    expect(diffMonths(may, april)).toBe(1);
    expect(diffMonths(march, april)).toBe(-1);
  });

  it('월말 경계를 넘어도 startOf month 기준으로 정규화되어야 한다', () => {
    // Given — 1/31 vs 2/1: 달력상 하루 차이지만 월 차이는 1
    const jan31 = new Date(2026, 0, 31);
    const feb1 = new Date(2026, 1, 1);

    // When
    const result = diffMonths(feb1, jan31);

    // Then
    expect(result).toBe(1);
  });
});

describe('getDayOfWeekLabel', () => {
  it.each([
    ['MON', '월'],
    ['TUE', '화'],
    ['WED', '수'],
    ['THU', '목'],
    ['FRI', '금'],
    ['SAT', '토'],
    ['SUN', '일'],
  ] as const)('%s → %s 한글 라벨을 반환해야 한다', (day, expected) => {
    // Given — day: %s

    // When
    const result = getDayOfWeekLabel(day);

    // Then
    expect(result).toBe(expected);
  });
});

describe('로케일 인지 포맷 (i18n)', () => {
  const KO_SEOUL = { locale: 'ko-KR', timeZone: 'Asia/Seoul' } as const;
  const EN_SEOUL = { locale: 'en-US', timeZone: 'Asia/Seoul' } as const;

  it('요일 라벨은 앱 언어를 따른다', async () => {
    expect(getWeekdayLabels()).toEqual(['일', '월', '화', '수', '목', '금', '토']);

    await i18n.changeLanguage('en');

    expect(getWeekdayLabels()).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(formatDaysOfWeek(['MON', 'WED'])).toBe('Mon, Wed');
    expect(getDayOfWeekLabel('SAT')).toBe('Sat');
  });

  it('주 헤더는 넘겨받은 context의 언어로 만든다', () => {
    // Given: 앱 언어(i18n)는 ko
    const dateKey = '2026-07-07';

    // When
    const korean = formatWeekOfMonthLabel(dateKey, KO_SEOUL);
    const english = formatWeekOfMonthLabel(dateKey, EN_SEOUL);

    // Then
    expect(korean).toBe('7월 1주차');
    expect(english).toBe('Week 1 of Jul');
  });

  it('상대 시간을 context의 언어와 복수형에 맞춰 포맷한다', () => {
    // Given
    const now = new Date('2026-10-25T03:00:00Z');
    const oneMinuteAgo = new Date(now.getTime() - 61_000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 3600_000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 86_400_000);

    // Then (ko)
    expect(formatRelativeTimeLabel(now, now, KO_SEOUL)).toBe('방금 전');
    expect(formatRelativeTimeLabel(oneMinuteAgo, now, KO_SEOUL)).toBe('1분 전');
    expect(formatRelativeTimeLabel(twoHoursAgo, now, KO_SEOUL)).toBe('2시간 전');
    expect(formatRelativeTimeLabel(twoDaysAgo, now, KO_SEOUL)).toBe('2일 전');

    // Then (en — 단수/복수, 앱 언어 ko와 무관)
    expect(formatRelativeTimeLabel(now, now, EN_SEOUL)).toBe('Just now');
    expect(formatRelativeTimeLabel(oneMinuteAgo, now, EN_SEOUL)).toBe('1 minute ago');
    expect(formatRelativeTimeLabel(twoHoursAgo, now, EN_SEOUL)).toBe('2 hours ago');
    expect(formatRelativeTimeLabel(twoDaysAgo, now, EN_SEOUL)).toBe('2 days ago');
  });
});
