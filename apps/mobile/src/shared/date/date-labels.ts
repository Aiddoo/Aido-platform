import { DAY_OF_WEEK_MAP, type DayOfWeek } from '@aido/api';
import { t } from '@src/shared/i18n';

import { type DateFormatContext, formatDateKeyLabel, formatRelativeTime } from './date-format';
import { getCalendarWeek } from './date-key';

function toCatalogLanguage(context: DateFormatContext): 'ko' | 'en' {
  return context.locale === 'ko-KR' ? 'ko' : 'en';
}

/** DayOfWeek 배열을 요일 순서로 정렬 후 로케일 라벨로 변환 (예: "월, 수, 금") */
export function formatDaysOfWeek(daysOfWeek: DayOfWeek[], separator = ', '): string {
  return [...daysOfWeek]
    .sort((a, b) => DAY_OF_WEEK_MAP[a] - DAY_OF_WEEK_MAP[b])
    .map((day) => t(`common:daysOfWeek.${day}`))
    .join(separator);
}

export function getDayOfWeekLabel(day: DayOfWeek): string {
  return t(`common:daysOfWeek.${day}`);
}

/**
 * 캘린더 헤더용 요일 라벨 (일요일 시작, Date#getDay() 인덱스와 일치).
 * 컴포넌트는 `language`를 넘긴다. 인자가 없으면 React Compiler가 첫 언어의 결과를 계속 쓴다.
 */
export function getWeekdayLabels(language?: string): string[] {
  return (['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const).map((day) =>
    t(`common:daysOfWeek.${day}`, { lng: language }),
  );
}

/**
 * 달력 주 헤더. 주가 시작한 달 기준이며, 올해가 아니면 연도를 붙인다.
 * (ko: "10월 3주차" / "2031년 10월 3주차", en: "Week 3 of Oct" / "Week 3 of Oct 2031")
 */
export function formatWeekOfMonthLabel(
  dateKey: string,
  todayDateKey: string,
  context: DateFormatContext,
): string {
  const week = getCalendarWeek(dateKey);
  const isCurrentYear = week.startDateKey.slice(0, 4) === todayDateKey.slice(0, 4);
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

/** 상대 시간 ("방금 전", "5분 전", "3시간 전", "2일 전", "1월 5일", "2025. 1. 5.") */
export function formatRelativeTimeLabel(date: Date, now: Date, context: DateFormatContext): string {
  const lng = toCatalogLanguage(context);
  return formatRelativeTime(
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
