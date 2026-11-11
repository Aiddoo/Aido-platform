import { DAY_OF_WEEK_MAP, type DayOfWeek, type SupportedLocale } from '@aido/api/vocabulary';
import { t } from '@src/shared/i18n';

import { getCalendarWeek, getIsoWeekOfMonth, isSameYearDateKey } from '../date-key';
import type { Instant } from '../instant';
import { type DateFormatContext, formatDateKeyLabel, formatRelativeTimeWith } from './date-format';

export function toCatalogLanguage(context: DateFormatContext): SupportedLocale {
  return context.locale === 'ko-KR' ? 'ko' : 'en';
}

export function formatDaysOfWeek(
  daysOfWeek: DayOfWeek[],
  language: string,
  separator = ', ',
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
  monthDateKey: string;
  weekOfMonth: number;
  hasYear: boolean;
}

/** "11월 2주차", 연도가 있으면 "2025년 12월 5주차" */
export function formatWeekHeaderLabel(
  { monthDateKey, weekOfMonth, hasYear }: WeekHeaderLabelInput,
  context: DateFormatContext,
): string {
  return t('common:calendar.weekHeader', {
    lng: toCatalogLanguage(context),
    month: formatDateKeyLabel(monthDateKey, hasYear ? 'yearShortMonth' : 'month', context),
    week: weekOfMonth,
  });
}

export function formatWeekOfMonthLabel(
  dateKey: string,
  todayDateKey: string,
  context: DateFormatContext,
): string {
  const week = getCalendarWeek(dateKey);
  return formatWeekHeaderLabel(
    {
      monthDateKey: week.startDateKey,
      weekOfMonth: week.weekOfMonth,
      hasYear: !isSameYearDateKey(week.startDateKey, todayDateKey),
    },
    context,
  );
}

/** 월요일 시작 주를 "3월 2주차"로 읽는다. 어느 날짜 key를 넘겨도 같은 주면 같은 라벨이다 */
export function formatIsoWeekOfMonthLabel(dateKey: string, context: DateFormatContext): string {
  const { thursdayDateKey, weekOfMonth } = getIsoWeekOfMonth(dateKey);
  return formatWeekHeaderLabel(
    { monthDateKey: thursdayDateKey, weekOfMonth, hasYear: false },
    context,
  );
}

export function formatRelativeTimeLabel(
  date: Instant,
  now: Instant,
  context: DateFormatContext,
): string {
  const lng = toCatalogLanguage(context);
  return formatRelativeTimeWith(
    date,
    now,
    {
      justNow: t('common:relativeTime.justNow', { lng }),
      minutesAgo: (count) => t('common:relativeTime.minutesAgo', { count, lng }),
      hoursAgo: (count) => t('common:relativeTime.hoursAgo', { count, lng }),
      daysAgo: (count) => t('common:relativeTime.daysAgo', { count, lng }),
    },
    context,
  );
}
