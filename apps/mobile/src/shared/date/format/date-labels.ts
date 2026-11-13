import { DAY_OF_WEEK_MAP, type DayOfWeek } from '@aido/api/vocabulary';
import { t } from '@src/shared/i18n';
import { toLanguageOfIntlLocale } from '@src/shared/i18n/app-locales';

import {
  type DateKey,
  diffDateKeysInDays,
  getCalendarWeek,
  getIsoWeekOfMonth,
  isSameMonthDateKey,
  isSameYearDateKey,
} from '../date-key';
import type { Instant } from '../instant';
import {
  type DateFormatContext,
  formatDateKeyLabel,
  formatRelativeTimeWith,
  getYearAwareDateLabel,
} from './date-format';

/** 요일 목록(ko "월·목", en "Mon, Thu"). 스크린리더처럼 다르게 읽혀야 하는 곳만 구분자를 넘긴다 */
export function formatDaysOfWeek(
  daysOfWeek: DayOfWeek[],
  language: string,
  separator = t('common:daysOfWeekSeparator', { lng: language }),
): string {
  return [...daysOfWeek]
    .sort((a, b) => DAY_OF_WEEK_MAP[a] - DAY_OF_WEEK_MAP[b])
    .map((day) => getDayOfWeekLabel(day, language))
    .join(separator);
}

/** `language`를 넘기지 않으면 React Compiler가 첫 언어의 결과를 계속 쓰므로 컴포넌트는 앱 언어를 넘긴다 */
export function getDayOfWeekLabel(day: DayOfWeek, language: string): string {
  return t(`common:daysOfWeek.${day}`, { lng: language });
}

/** `language`가 없으면 React Compiler가 첫 언어의 결과를 계속 쓴다 */
export function getWeekdayLabels(language?: string): string[] {
  return (['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const).map((day) =>
    t(`common:daysOfWeek.${day}`, { lng: language }),
  );
}

interface WeekHeaderLabelInput {
  /** 라벨의 달은 이 날의 달이다 */
  monthDateKey: DateKey;
  weekOfMonth: number;
  hasYear: boolean;
}

/** "11월 2주차", 연도가 있으면 "2025년 12월 5주차" */
export function formatWeekHeaderLabel(
  { monthDateKey, weekOfMonth, hasYear }: WeekHeaderLabelInput,
  context: DateFormatContext,
): string {
  return t('common:calendar.weekHeader', {
    lng: toLanguageOfIntlLocale(context.locale),
    month: formatDateKeyLabel(monthDateKey, hasYear ? 'yearShortMonth' : 'month', context),
    week: weekOfMonth,
  });
}

/** 일요일 시작 주의 라벨. 가운데 날(수요일)의 해가 올해가 아니면 연도를 붙인다 */
export function formatCalendarWeekLabel(
  dateKey: DateKey,
  todayDateKey: DateKey,
  context: DateFormatContext,
): string {
  const { middleDateKey, weekOfMonth } = getCalendarWeek(dateKey);
  return formatWeekHeaderLabel(
    {
      monthDateKey: middleDateKey,
      weekOfMonth,
      hasYear: !isSameYearDateKey(middleDateKey, todayDateKey),
    },
    context,
  );
}

/** ISO 주(월요일 시작)의 라벨. 가운데 날(목요일)의 해가 올해가 아니면 연도를 붙인다. 서버 formatIsoWeekLabel과 같은 글자다 */
export function formatIsoWeekLabel(
  dateKey: DateKey,
  todayDateKey: DateKey,
  context: DateFormatContext,
): string {
  const { middleDateKey, weekOfMonth } = getIsoWeekOfMonth(dateKey);
  return formatWeekHeaderLabel(
    {
      monthDateKey: middleDateKey,
      weekOfMonth,
      hasYear: !isSameYearDateKey(middleDateKey, todayDateKey),
    },
    context,
  );
}

/** 오늘·내일은 날짜 대신 말로 쓴다. 그 밖의 날은 null이다 */
export function formatRelativeDayLabel(
  dateKey: DateKey,
  todayDateKey: DateKey,
  context: DateFormatContext,
): string | null {
  const lng = toLanguageOfIntlLocale(context.locale);
  const daysFromToday = diffDateKeysInDays(todayDateKey, dateKey);
  if (daysFromToday === 0) {
    return t('common:relativeDay.today', { lng });
  }
  if (daysFromToday === 1) {
    return t('common:relativeDay.tomorrow', { lng });
  }
  return null;
}

export function formatRelativeTimeLabel(
  date: Instant,
  now: Instant,
  context: DateFormatContext,
): string {
  const lng = toLanguageOfIntlLocale(context.locale);
  return formatRelativeTimeWith(
    date,
    now,
    {
      justNow: t('common:relativeTime.justNow', { lng }),
      minutesAgo: (count) => t('common:relativeTime.minutesAgo', { count, lng }),
      hoursAgo: (count) => t('common:relativeTime.hoursAgo', { count, lng }),
      yesterday: t('common:relativeTime.yesterday', { lng }),
      daysAgo: (count) => t('common:relativeTime.daysAgo', { count, lng }),
    },
    context,
  );
}

/** 기간의 두 끝을 잇는다. 구분자는 언어마다 카탈로그 하나(ko "~", en "–")이고 날짜·시각 어느 끝이든 쓴다 */
export function formatRangeLabel(
  { start, end }: { start: string; end: string },
  kind: 'full' | 'compact',
  context: DateFormatContext,
): string {
  return t(`common:dateRange.${kind}`, { lng: toLanguageOfIntlLocale(context.locale), start, end });
}

/** 두 끝이 모두 올해면 월·일만, 하나라도 올해가 아니면 둘 다 연도까지 쓴다 */
export function formatDateKeyRange(
  startDateKey: DateKey,
  endDateKey: DateKey,
  todayDateKey: DateKey,
  context: DateFormatContext,
): string {
  const kind = getYearAwareDateLabel([startDateKey, endDateKey], todayDateKey);
  return formatRangeLabel(
    {
      start: formatDateKeyLabel(startDateKey, kind, context),
      end: formatDateKeyLabel(endDateKey, kind, context),
    },
    'full',
    context,
  );
}

/** 올해 기간을 짧게 쓴다(같은 달 "11월 5일~7일", 다른 달 "11월 30일~12월 2일"). 올해가 아닌 끝이 있으면 formatDateKeyRange다 */
export function formatDateKeyCompactRange(
  startDateKey: DateKey,
  endDateKey: DateKey,
  todayDateKey: DateKey,
  context: DateFormatContext,
): string {
  if (getYearAwareDateLabel([startDateKey, endDateKey], todayDateKey) === 'monthDayYear') {
    return formatDateKeyRange(startDateKey, endDateKey, todayDateKey, context);
  }
  return formatRangeLabel(
    {
      start: formatDateKeyLabel(startDateKey, 'monthDay', context),
      end: formatDateKeyLabel(
        endDateKey,
        isSameMonthDateKey(startDateKey, endDateKey) ? 'day' : 'monthDay',
        context,
      ),
    },
    'compact',
    context,
  );
}
