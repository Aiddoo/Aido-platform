import type { DayOfWeek } from '@aido/api';
import { fromEpochMs, toEpochMs, toInstant } from '@src/shared/date/instant';
import { i18n } from '@src/shared/i18n';

import {
  formatDaysOfWeek,
  formatIsoWeekOfMonthLabel,
  formatRelativeTimeLabel,
  formatWeekOfMonthLabel,
  getDayOfWeekLabel,
  getWeekdayLabels,
} from './date-labels';

afterEach(async () => {
  await i18n.changeLanguage('ko');
});

describe('formatDaysOfWeek', () => {
  it('여러 요일은 일~토 순서로 정렬해 한글로 바꾼다', () => {
    // Given
    const days: DayOfWeek[] = ['FRI', 'MON', 'WED'];

    // When
    const result = formatDaysOfWeek(days, 'ko');

    // Then
    expect(result).toBe('월, 수, 금');
  });

  it('요일 하나는 한글 한 글자로 바꾼다', () => {
    // Given
    const days: DayOfWeek[] = ['TUE'];

    // When
    const result = formatDaysOfWeek(days, 'ko');

    // Then
    expect(result).toBe('화');
  });

  it('순서가 뒤섞인 7개 요일은 일~토 순서로 이어 붙인다', () => {
    // Given
    const days: DayOfWeek[] = ['SUN', 'SAT', 'FRI', 'THU', 'WED', 'TUE', 'MON'];

    // When
    const result = formatDaysOfWeek(days, 'ko');

    // Then
    expect(result).toBe('일, 월, 화, 수, 목, 금, 토');
  });

  it('요일이 없으면 빈 문자열이다', () => {
    // Given
    const days: DayOfWeek[] = [];

    // When
    const result = formatDaysOfWeek(days, 'ko');

    // Then
    expect(result).toBe('');
  });

  it('정렬해도 넘겨받은 배열은 바뀌지 않는다', () => {
    // Given
    const days: DayOfWeek[] = ['FRI', 'MON'];

    // When
    formatDaysOfWeek(days, 'ko');

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
  ] as const)('%s 요일은 %s 한 글자로 쓴다', (day, expected) => {
    // When
    const result = getDayOfWeekLabel(day, 'ko');

    // Then
    expect(result).toBe(expected);
  });
});

describe('로케일 인지 포맷 (i18n)', () => {
  const KO_SEOUL = { locale: 'ko-KR', timeZone: 'Asia/Seoul' } as const;
  const EN_SEOUL = { locale: 'en-US', timeZone: 'Asia/Seoul' } as const;
  const TODAY_DATE_KEY = '2026-10-26';

  it('요일 라벨은 앱 언어를 따른다', async () => {
    // When
    const korean = getWeekdayLabels();

    // Then
    expect(korean).toEqual(['일', '월', '화', '수', '목', '금', '토']);

    // When
    await i18n.changeLanguage('en');

    // Then
    expect(getWeekdayLabels()).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(formatDaysOfWeek(['MON', 'WED'], 'en')).toBe('Mon, Wed');
    expect(getDayOfWeekLabel('SAT', 'en')).toBe('Sat');
  });

  it('요일 라벨은 넘겨받은 언어로 만든다', () => {
    // When
    const labels = getWeekdayLabels('en');

    // Then
    expect(labels[0]).toBe('Sun');
  });

  it('주 헤더는 넘겨받은 context의 언어로 만든다', () => {
    // Given
    // 앱 언어(i18n)는 ko
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
    // When
    const koreanLabel = formatWeekOfMonthLabel(dateKey, todayDateKey, KO_SEOUL);
    const englishLabel = formatWeekOfMonthLabel(dateKey, todayDateKey, EN_SEOUL);

    // Then
    // 올해가 아닌 주는 연도를 보여 몇 년 뒤로 튄 날짜를 알아챌 수 있어야 한다. 주가 시작한 달의 연도로 판단한다
    expect(koreanLabel).toBe(korean);
    expect(englishLabel).toBe(english);
  });

  it('상대 시간을 context의 언어와 복수형에 맞춰 포맷한다', () => {
    // Given
    const now = toInstant('2026-10-25T03:00:00Z');
    const oneMinuteAgo = fromEpochMs(toEpochMs(now) - 61_000);
    const twoHoursAgo = fromEpochMs(toEpochMs(now) - 2 * 3600_000);
    const twoDaysAgo = fromEpochMs(toEpochMs(now) - 2 * 86_400_000);

    // When
    const koreanLabels = [now, oneMinuteAgo, twoHoursAgo, twoDaysAgo].map((time) =>
      formatRelativeTimeLabel(time, now, KO_SEOUL),
    );

    // Then
    expect(koreanLabels).toEqual(['방금 전', '1분 전', '2시간 전', '2일 전']);

    // 영어는 단수/복수를 구분하고 앱 언어 ko와 무관하다
    expect(formatRelativeTimeLabel(now, now, EN_SEOUL)).toBe('Just now');
    expect(formatRelativeTimeLabel(oneMinuteAgo, now, EN_SEOUL)).toBe('1 minute ago');
    expect(formatRelativeTimeLabel(twoHoursAgo, now, EN_SEOUL)).toBe('2 hours ago');
    expect(formatRelativeTimeLabel(twoDaysAgo, now, EN_SEOUL)).toBe('2 days ago');
  });
});

describe('formatIsoWeekOfMonthLabel', () => {
  const KO = { locale: 'ko-KR', timeZone: 'Asia/Seoul' } as const;
  const EN = { locale: 'en-US', timeZone: 'Asia/Seoul' } as const;

  it('주의 목요일이 속한 달 기준으로 앱 언어에 맞는 주차를 만든다', () => {
    // Given
    // 2026-03-02 주의 목요일은 3월 5일이라 3월 1주차
    const mondayKey = '2026-03-02';

    // When
    const korean = formatIsoWeekOfMonthLabel(mondayKey, KO);
    const english = formatIsoWeekOfMonthLabel(mondayKey, EN);

    // Then
    expect(korean).toBe('3월 1주차');
    expect(english).toBe('Week 1 of Mar');
  });

  it('달이 걸치는 주는 목요일이 속한 달로 센다', () => {
    // Given
    // 2026-03-30 주의 목요일은 4월 2일
    const mondayKey = '2026-03-30';

    // When
    const label = formatIsoWeekOfMonthLabel(mondayKey, KO);

    // Then
    expect(label).toBe('4월 1주차');
  });
});

// dayjs를 지우기 전 구현이 만든 글자다. 계산을 바꿔도 화면 글자는 바이트 단위로 같아야 한다
describe('formatWeekOfMonthLabel', () => {
  it.each([
    ['ko-KR', '2027-01-01', '12월 4주차', '12월 5주차'],
    ['ko-KR', '2026-12-31', '12월 4주차', '12월 5주차'],
    ['ko-KR', '2026-03-01', '3월 1주차', '2월 4주차'],
    ['en-US', '2027-01-01', 'Week 4 of Dec', 'Week 5 of Dec'],
    ['en-US', '2026-12-31', 'Week 4 of Dec', 'Week 5 of Dec'],
    ['en-US', '2026-03-01', 'Week 1 of Mar', 'Week 4 of Feb'],
  ] as const)('%s %s의 주 라벨은 이전과 같은 글자다', (locale, dateKey, expected, expectedIso) => {
    // Given
    const context = { locale, timeZone: 'Asia/Seoul' };

    // When
    const week = formatWeekOfMonthLabel(dateKey, '2026-11-11', context);
    const isoWeek = formatIsoWeekOfMonthLabel(dateKey, context);

    // Then
    expect([week, isoWeek]).toEqual([expected, expectedIso]);
  });
});
