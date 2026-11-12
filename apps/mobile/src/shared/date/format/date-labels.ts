import { DAY_OF_WEEK_MAP, type DayOfWeek } from '@aido/api/vocabulary';
import { t } from '@src/shared/i18n';
import { toLanguageOfIntlLocale } from '@src/shared/i18n/app-locales';

import { type DateKey, getCalendarWeek, getIsoWeekOfMonth, isSameYearDateKey } from '../date-key';
import type { Instant } from '../instant';
import { type DateFormatContext, formatDateKeyLabel, formatRelativeTimeWith } from './date-format';

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
      daysAgo: (count) => t('common:relativeTime.daysAgo', { count, lng }),
    },
    context,
  );
}
