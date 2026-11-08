import { DAY_OF_WEEK_MAP, type DayOfWeek } from '@aido/api/vocabulary';
import { t } from '@src/shared/i18n';

import { type DateFormatContext, formatDateKeyLabel, formatRelativeTimeWith } from './date-format';
import { getCalendarWeek, isSameYearDateKey } from './date-key';
import type { Instant } from './instant';

export function toCatalogLanguage(context: DateFormatContext): 'ko' | 'en' {
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

export function formatWeekOfMonthLabel(
  dateKey: string,
  todayDateKey: string,
  context: DateFormatContext,
): string {
  const week = getCalendarWeek(dateKey);
  const isCurrentYear = isSameYearDateKey(week.startDateKey, todayDateKey);
  return t('common:calendar.weekHeader', {
    lng: toCatalogLanguage(context),
    month: formatDateKeyLabel(
      week.startDateKey,
      isCurrentYear ? 'month' : 'yearShortMonth',
      context,
    ),
    week: week.weekOfMonth,
  });
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
