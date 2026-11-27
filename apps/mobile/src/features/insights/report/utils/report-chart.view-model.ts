import { DAYS_PER_WEEK } from '@src/shared/constants/time-units';
import { addDaysToDateKey, type DateKey, getIsoWeekYear } from '@src/shared/date/date-key';
import { type DateFormatContext, formatDateKeyLabel } from '@src/shared/date/format/date-format';
import { t } from '@src/shared/i18n';
import { toLanguageOfIntlLocale } from '@src/shared/i18n/app-locales';
import { sortBy, takeRight, uniqBy } from 'es-toolkit';
import { match } from 'ts-pattern';

import { TREND_WEEK_COUNT } from '../constants/report-chart.constants';
import type { DailyCompletion, ReportType } from '../domains/report.model';

export interface TrendWeek {
  startDate: DateKey;
  completionRate: number;
}

interface DailyValue {
  date: DateKey;
  total: number;
  completed: number;
  isUpcoming?: boolean;
}

// 월간 막대는 칸이 좁아 라벨이 겹치므로 주마다 한 칸에만 날짜를 쓴다
export function getDailyCompletionLabels(
  type: ReportType,
  dailyCompletions: readonly DailyCompletion[],
  context: DateFormatContext,
): string[] {
  return match(type)
    .with('WEEKLY', () =>
      dailyCompletions.map((day) => formatDateKeyLabel(day.date, 'weekday', context)),
    )
    .with('MONTHLY', () =>
      dailyCompletions.map((day, index) =>
        index % DAYS_PER_WEEK === 0 ? formatDateKeyLabel(day.date, 'dayNumber', context) : '',
      ),
    )
    .exhaustive();
}

/** 날마다 막대 아래 한 줄. 고르기 전은 안내, 고른 날은 오지 않음·할 일 없음·n개 중 m개다 */
export function formatDailyValueLine(day: DailyValue | null, context: DateFormatContext): string {
  const lng = toLanguageOfIntlLocale(context.locale);
  if (day == null) {
    return t('ai:report.detail.dailyHint', { lng });
  }
  const date = formatDateKeyLabel(day.date, 'monthDay', context);
  if (day.isUpcoming === true) {
    return t('ai:report.thisWeek.dayUpcoming', { lng, date });
  }
  if (day.total === 0) {
    return t('ai:report.detail.dayEmpty', { lng, date });
  }
  return t('ai:report.detail.dayCompletions', {
    lng,
    date,
    completed: day.completed,
    total: day.total,
  });
}

/** 주간 성취 목록은 해 하나씩만 주어 1월 초에는 추세 첫 주가 속한 지난해도 읽는다 */
export function getTrendIsoWeekYears(todayKey: DateKey): { startYear: number; endYear: number } {
  return {
    startYear: getIsoWeekYear(addDaysToDateKey(todayKey, -TREND_WEEK_COUNT * DAYS_PER_WEEK)),
    endYear: getIsoWeekYear(todayKey),
  };
}

/** 해마다 받은 주를 합쳐 최근 주들을 오래된 주부터 둔다. 두 해가 같으면 같은 주가 두 번 와서 시작일로 한 번만 센다 */
export function getRecentTrendWeeks(weeks: readonly TrendWeek[]): TrendWeek[] {
  return takeRight(
    sortBy(
      uniqBy(weeks, (week) => week.startDate),
      [(week) => week.startDate],
    ),
    TREND_WEEK_COUNT,
  );
}
