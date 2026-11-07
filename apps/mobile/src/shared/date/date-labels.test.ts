import type { DayOfWeek } from '@aido/api';
import { fromEpochMs, toEpochMs, toInstant } from '@src/shared/date/instant';
import { i18n } from '@src/shared/i18n';

import {
  formatDaysOfWeek,
  formatRelativeTimeLabel,
  formatWeekOfMonthLabel,
  getDayOfWeekLabel,
  getWeekdayLabels,
} from './date-labels';

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
  const TODAY_DATE_KEY = '2026-10-26';

  it('요일 라벨은 앱 언어를 따른다', async () => {
    expect(getWeekdayLabels()).toEqual(['일', '월', '화', '수', '목', '금', '토']);

    await i18n.changeLanguage('en');

    expect(getWeekdayLabels()).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(formatDaysOfWeek(['MON', 'WED'])).toBe('Mon, Wed');
    expect(getDayOfWeekLabel('SAT')).toBe('Sat');
  });

  it('요일 라벨은 넘겨받은 언어로 만든다', () => {
    // When
    const labels = getWeekdayLabels('en');

    // Then
    expect(labels[0]).toBe('Sun');
  });

  it('주 헤더는 넘겨받은 context의 언어로 만든다', () => {
    // Given: 앱 언어(i18n)는 ko
    const dateKey = '2026-07-07';

    // When
    const korean = formatWeekOfMonthLabel(dateKey, TODAY_DATE_KEY, KO_SEOUL);
    const english = formatWeekOfMonthLabel(dateKey, TODAY_DATE_KEY, EN_SEOUL);

    // Then
    expect(korean).toBe('7월 1주차');
    expect(english).toBe('Week 1 of Jul');
  });

  it.each([
    ['2031-10-20', '2026-10-26', '2031년 10월 3주차', 'Week 3 of Oct 2031'],
    ['2028-02-29', '2026-10-26', '2028년 2월 4주차', 'Week 4 of Feb 2028'],
    ['2027-01-01', '2026-10-26', '12월 4주차', 'Week 4 of Dec'],
    ['2027-01-01', '2027-01-01', '2026년 12월 4주차', 'Week 4 of Dec 2026'],
    ['2027-01-03', '2026-12-31', '2027년 1월 1주차', 'Week 1 of Jan 2027'],
  ])('%s 주 헤더는 오늘이 %s이면 %s / %s다', (dateKey, todayDateKey, korean, english) => {
    // Given: 올해가 아닌 주는 연도를 보여 몇 년 뒤로 튄 날짜를 알아챌 수 있어야 한다

    // When / Then: 주가 시작한 달의 연도로 판단한다
    expect(formatWeekOfMonthLabel(dateKey, todayDateKey, KO_SEOUL)).toBe(korean);
    expect(formatWeekOfMonthLabel(dateKey, todayDateKey, EN_SEOUL)).toBe(english);
  });

  it('상대 시간을 context의 언어와 복수형에 맞춰 포맷한다', () => {
    // Given
    const now = toInstant('2026-10-25T03:00:00Z');
    const oneMinuteAgo = fromEpochMs(toEpochMs(now) - 61_000);
    const twoHoursAgo = fromEpochMs(toEpochMs(now) - 2 * 3600_000);
    const twoDaysAgo = fromEpochMs(toEpochMs(now) - 2 * 86_400_000);

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
